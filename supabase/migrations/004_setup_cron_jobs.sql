-- Configuración de cron jobs para el sistema de recordatorios
-- Requiere la extensión pg_cron que debe estar habilitada en Supabase Pro/Team

-- Habilitar la extensión pg_cron (solo funciona en producción)
-- En desarrollo local, esto se manejará manualmente o con scripts

-- FUNCIÓN PARA LLAMAR AL SCHEDULER VÍA HTTP
CREATE OR REPLACE FUNCTION trigger_scheduler_dispatch()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    response_status integer;
    response_content text;
    scheduler_url text;
    auth_token text;
BEGIN
    -- Obtener URL del scheduler desde variables de entorno o configuración
    scheduler_url := current_setting('app.scheduler_url', true);
    auth_token := current_setting('app.scheduler_auth_token', true);

    -- Fallback URLs para diferentes entornos
    IF scheduler_url IS NULL THEN
        -- Local development
        scheduler_url := 'http://localhost:54321/functions/v1/scheduler_dispatch';
    END IF;

    -- Realizar llamada HTTP al scheduler
    -- Nota: Esto requiere la extensión http para PostgreSQL
    -- En Supabase, se puede usar pg_net para llamadas HTTP

    PERFORM net.http_post(
        url := scheduler_url,
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || COALESCE(auth_token, 'local-dev-token'),
            'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
            'trigger', 'cron',
            'timestamp', NOW()
        )
    );

    -- Log la ejecución
    INSERT INTO events (
        tenant_id,
        event_type,
        payload
    ) VALUES (
        NULL, -- Sistema
        'reminder_sent', -- Reuso del tipo existente, TODO: agregar 'scheduler_triggered'
        jsonb_build_object(
            'trigger_type', 'cron',
            'timestamp', NOW(),
            'function', 'trigger_scheduler_dispatch'
        )
    );

EXCEPTION
    WHEN OTHERS THEN
        -- Log error pero no fallar
        INSERT INTO events (
            tenant_id,
            event_type,
            payload
        ) VALUES (
            NULL,
            'reminder_sent', -- TODO: agregar 'system_error'
            jsonb_build_object(
                'error_type', 'scheduler_trigger_failed',
                'error_message', SQLERRM,
                'error_state', SQLSTATE,
                'timestamp', NOW()
            )
        );
END;
$$;

-- CONFIGURACIÓN DE CRON JOBS
-- Estos comandos solo funcionan en entornos donde pg_cron está disponible

-- Scheduler principal: cada hora al minuto 5 (ej: 08:05, 09:05, 10:05, etc.)
-- Hora oficial: 09:05 Chile (procesamiento completo)
-- Otras horas: solo catch-up de mensajes atrasados >1 hora
-- SELECT cron.schedule('scheduler-dispatch', '5 * * * *', 'SELECT trigger_scheduler_dispatch();');

-- Cleanup de datos antiguos: diario a las 2 AM
-- SELECT cron.schedule('cleanup-old-data', '0 2 * * *', 'SELECT cleanup_old_data();');

-- FUNCIÓN DE CLEANUP
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Limpiar eventos antiguos (más de 90 días)
    DELETE FROM events
    WHERE created_at < NOW() - INTERVAL '90 days';

    -- Limpiar mensajes de WhatsApp antiguos (más de 30 días)
    DELETE FROM whatsapp_messages
    WHERE created_at < NOW() - INTERVAL '30 days'
    AND direction = 'inbound'; -- Mantener outbound para métricas

    -- Limpiar reminder_instances completadas viejas (más de 60 días)
    DELETE FROM reminder_instances
    WHERE created_at < NOW() - INTERVAL '60 days'
    AND status IN ('delivered', 'read', 'cancelled');

    -- Log cleanup
    INSERT INTO events (
        tenant_id,
        event_type,
        payload
    ) VALUES (
        NULL,
        'reminder_sent', -- TODO: agregar 'system_maintenance'
        jsonb_build_object(
            'maintenance_type', 'data_cleanup',
            'timestamp', NOW()
        )
    );

    RAISE NOTICE 'Old data cleanup completed';
END;
$$;

-- FUNCIÓN PARA GENERAR RECORDATORIOS RECURRENTES
-- Se ejecuta diariamente para generar las próximas instancias de servicios recurrentes
CREATE OR REPLACE FUNCTION generate_recurring_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    agreement_record RECORD;
    reminder_record RECORD;
    instances_created integer := 0;
    next_due_date date;
BEGIN
    -- Buscar acuerdos de servicios activos con próximo vencimiento dentro de 7 días
    FOR agreement_record IN
        SELECT *
        FROM agreements
        WHERE type = 'service'
        AND status = 'active'
        AND next_due_date IS NOT NULL
        AND next_due_date <= CURRENT_DATE + INTERVAL '7 days'
        AND next_due_date >= CURRENT_DATE
    LOOP
        -- Generar instancias para todos los recordatorios de este acuerdo
        FOR reminder_record IN
            SELECT *
            FROM reminders
            WHERE agreement_id = agreement_record.id
            AND is_active = true
        LOOP
            -- Verificar que no existe ya una instancia para esta fecha
            IF NOT EXISTS (
                SELECT 1
                FROM reminder_instances ri
                JOIN reminders r ON r.id = ri.reminder_id
                WHERE r.agreement_id = agreement_record.id
                AND ri.scheduled_for::date = agreement_record.next_due_date + reminder_record.days_offset
                AND ri.status IN ('pending', 'sent', 'delivered', 'read')
            ) THEN
                -- Generar la instancia
                instances_created := instances_created + generate_reminder_instances(
                    reminder_record.id,
                    agreement_record.next_due_date::text,
                    (SELECT timezone FROM tenants WHERE id = agreement_record.tenant_id)
                );
            END IF;
        END LOOP;

        -- Calcular próxima fecha de recurrencia
        next_due_date := calculate_next_recurrence(
            agreement_record.next_due_date,
            agreement_record.recurrence_rule
        );

        -- Actualizar el acuerdo con la próxima fecha
        UPDATE agreements
        SET next_due_date = next_due_date
        WHERE id = agreement_record.id;
    END LOOP;

    -- Log la generación
    INSERT INTO events (
        tenant_id,
        event_type,
        payload
    ) VALUES (
        NULL,
        'reminder_sent', -- TODO: agregar 'recurring_reminders_generated'
        jsonb_build_object(
            'instances_created', instances_created,
            'timestamp', NOW()
        )
    );

    RETURN instances_created;
END;
$$;

-- Programar generación de recordatorios recurrentes: diario a las 6 AM
-- SELECT cron.schedule('generate-recurring', '0 6 * * *', 'SELECT generate_recurring_reminders();');

-- FUNCIÓN PARA VERIFICAR SALUD DEL SISTEMA
CREATE OR REPLACE FUNCTION system_health_check()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    health_status jsonb;
    pending_instances integer;
    failed_instances integer;
    recent_errors integer;
BEGIN
    -- Contar instancias pendientes
    SELECT COUNT(*) INTO pending_instances
    FROM reminder_instances
    WHERE status = 'pending'
    AND scheduled_for <= NOW();

    -- Contar instancias fallidas en las últimas 24 horas
    SELECT COUNT(*) INTO failed_instances
    FROM reminder_instances
    WHERE status = 'failed'
    AND updated_at >= NOW() - INTERVAL '24 hours';

    -- Contar errores recientes
    SELECT COUNT(*) INTO recent_errors
    FROM events
    WHERE payload->>'error_type' IS NOT NULL
    AND created_at >= NOW() - INTERVAL '1 hour';

    health_status := jsonb_build_object(
        'timestamp', NOW(),
        'pending_instances', pending_instances,
        'failed_instances_24h', failed_instances,
        'recent_errors_1h', recent_errors,
        'status', CASE
            WHEN pending_instances > 100 THEN 'warning'
            WHEN failed_instances > 50 THEN 'warning'
            WHEN recent_errors > 10 THEN 'warning'
            ELSE 'healthy'
        END
    );

    -- Log health status
    INSERT INTO events (
        tenant_id,
        event_type,
        payload
    ) VALUES (
        NULL,
        'reminder_sent', -- TODO: agregar 'health_check'
        health_status
    );

    RETURN health_status;
END;
$$;

-- Health check cada 15 minutos
-- SELECT cron.schedule('health-check', '*/15 * * * *', 'SELECT system_health_check();');

-- GRANTS PARA SERVICE ROLE
GRANT EXECUTE ON FUNCTION trigger_scheduler_dispatch() TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_data() TO service_role;
GRANT EXECUTE ON FUNCTION generate_recurring_reminders() TO service_role;
GRANT EXECUTE ON FUNCTION system_health_check() TO service_role;

-- COMENTARIOS
COMMENT ON FUNCTION trigger_scheduler_dispatch() IS 'Trigger del scheduler via HTTP call cada minuto';
COMMENT ON FUNCTION cleanup_old_data() IS 'Limpieza de datos antiguos del sistema';
COMMENT ON FUNCTION generate_recurring_reminders() IS 'Genera instancias de recordatorios para servicios recurrentes';
COMMENT ON FUNCTION system_health_check() IS 'Verifica la salud del sistema y genera métricas';

-- NOTA IMPORTANTE:
-- Para habilitar los cron jobs en producción, ejecutar manualmente:
--
-- SELECT cron.schedule('scheduler-dispatch', '5 * * * *', 'SELECT trigger_scheduler_dispatch();');
-- SELECT cron.schedule('cleanup-old-data', '0 2 * * *', 'SELECT cleanup_old_data();');
-- SELECT cron.schedule('generate-recurring', '0 6 * * *', 'SELECT generate_recurring_reminders();');
-- SELECT cron.schedule('health-check', '*/15 * * * *', 'SELECT system_health_check();');
--
-- Para ver cron jobs activos:
-- SELECT * FROM cron.job;
--
-- Para eliminar un cron job:
-- SELECT cron.unschedule('job-name');