-- Datos semilla para el sistema
-- Templates globales que serán usadas por todos los tenants

-- TEMPLATES GLOBALES DEL SISTEMA
-- Estas templates deben ser aprobadas en Meta Business Manager antes de usar

INSERT INTO templates (
    id,
    tenant_id, -- NULL = global
    name,
    category,
    language,
    header,
    body,
    footer,
    buttons_config,
    meta_template_name,
    variables,
    approval_status
) VALUES

-- 1. Template de Opt-in
(
    uuid_generate_v4(),
    NULL,
    'opt_in_request',
    'utility',
    'es',
    NULL,
    'Hola {{1}}! {{2}} te quiere enviar recordatorios sobre {{3}}. ¿Aceptas recibir estos avisos por WhatsApp?',
    'Responde para confirmar tu preferencia.',
    '[
        {
            "type": "quick_reply",
            "buttons": [
                {
                    "type": "text",
                    "text": "Sí, acepto",
                    "id": "opt_in_yes"
                },
                {
                    "type": "text",
                    "text": "No, gracias",
                    "id": "opt_in_no"
                }
            ]
        }
    ]'::jsonb,
    'opt_in_request_es',
    '["contact_name", "business_name", "agreement_description"]'::jsonb,
    'pending'
),

-- 2. Template de recordatorio 24h antes (préstamo)
(
    uuid_generate_v4(),
    NULL,
    'loan_reminder_24h',
    'utility',
    'es',
    '⏰ Recordatorio',
    'Hola {{1}}! Te recordamos que mañana {{2}} vence el préstamo de: {{3}}. Por favor, coordina la devolución.',
    'Gracias por tu atención.',
    NULL,
    'loan_reminder_24h_es',
    '["contact_name", "due_date", "item_description"]'::jsonb,
    'pending'
),

-- 3. Template de día de vencimiento (préstamo)
(
    uuid_generate_v4(),
    NULL,
    'loan_due_today',
    'utility',
    'es',
    '📅 Vencimiento HOY',
    'Hola {{1}}! Hoy {{2}} vence el préstamo de: {{3}}. ¿Ya lo devolviste?',
    NULL,
    '[
        {
            "type": "quick_reply",
            "buttons": [
                {
                    "type": "text",
                    "text": "✅ Ya lo devolví",
                    "id": "loan_returned"
                },
                {
                    "type": "text",
                    "text": "🔄 Reprogramar",
                    "id": "loan_reschedule"
                }
            ]
        }
    ]'::jsonb,
    'loan_due_today_es',
    '["contact_name", "due_date", "item_description"]'::jsonb,
    'pending'
),

-- 4. Template de préstamo vencido
(
    uuid_generate_v4(),
    NULL,
    'loan_overdue',
    'utility',
    'es',
    '⚠️ Préstamo Vencido',
    'Hola {{1}}! El préstamo de {{2}} venció el {{3}}. Por favor, contacta para coordinar la devolución.',
    NULL,
    '[
        {
            "type": "quick_reply",
            "buttons": [
                {
                    "type": "text",
                    "text": "✅ Ya lo devolví",
                    "id": "loan_returned"
                },
                {
                    "type": "text",
                    "text": "📞 Contactar",
                    "id": "contact_owner"
                }
            ]
        }
    ]'::jsonb,
    'loan_overdue_es',
    '["contact_name", "item_description", "due_date"]'::jsonb,
    'pending'
),

-- 5. Template de cobro mensual (servicio)
(
    uuid_generate_v4(),
    NULL,
    'service_payment_due',
    'utility',
    'es',
    '💰 Pago Pendiente',
    'Hola {{1}}! Tu servicio de {{2}} por ${{3}} vence hoy {{4}}.',
    NULL,
    '[
        {
            "type": "quick_reply",
            "buttons": [
                {
                    "type": "text",
                    "text": "💳 Pagar ahora",
                    "id": "pay_online"
                },
                {
                    "type": "text",
                    "text": "💵 Pagué en efectivo",
                    "id": "paid_cash"
                },
                {
                    "type": "text",
                    "text": "📅 Reagendar",
                    "id": "reschedule_payment"
                }
            ]
        }
    ]'::jsonb,
    'service_payment_due_es',
    '["contact_name", "service_description", "amount", "due_date"]'::jsonb,
    'pending'
),

-- 6. Template de confirmación de devolución
(
    uuid_generate_v4(),
    NULL,
    'loan_return_confirmed',
    'utility',
    'es',
    '✅ Confirmado',
    '¡Perfecto {{1}}! Hemos registrado que devolviste {{2}}. ¡Gracias!',
    NULL,
    NULL,
    'loan_return_confirmed_es',
    '["contact_name", "item_description"]'::jsonb,
    'pending'
),

-- 7. Template de confirmación de pago
(
    uuid_generate_v4(),
    NULL,
    'payment_confirmed',
    'utility',
    'es',
    '✅ Pago Confirmado',
    '¡Gracias {{1}}! Hemos registrado tu pago de ${{2}} por {{3}}.',
    NULL,
    NULL,
    'payment_confirmed_es',
    '["contact_name", "amount", "service_description"]'::jsonb,
    'pending'
),

-- 8. Template para notificar al dueño sobre devolución
(
    uuid_generate_v4(),
    NULL,
    'owner_notification_return',
    'utility',
    'es',
    '📢 Devolución Confirmada',
    '{{1}} confirmó que devolvió: {{2}} (prestado el {{3}}).',
    NULL,
    NULL,
    'owner_notification_return_es',
    '["contact_name", "item_description", "loan_date"]'::jsonb,
    'pending'
),

-- 9. Template para notificar al dueño sobre pago
(
    uuid_generate_v4(),
    NULL,
    'owner_notification_payment',
    'utility',
    'es',
    '💰 Pago Recibido',
    '{{1}} confirmó el pago de ${{2}} por {{3}} (vencimiento: {{4}}).',
    NULL,
    NULL,
    'owner_notification_payment_es',
    '["contact_name", "amount", "service_description", "due_date"]'::jsonb,
    'pending'
),

-- 10. Template de recordatorio para servicios 24h antes
(
    uuid_generate_v4(),
    NULL,
    'service_reminder_24h',
    'utility',
    'es',
    '⏰ Recordatorio de Pago',
    'Hola {{1}}! Te recordamos que mañana {{2}} vence el pago de ${{3}} por {{4}}.',
    NULL,
    NULL,
    'service_reminder_24h_es',
    '["contact_name", "due_date", "amount", "service_description"]'::jsonb,
    'pending'
);

-- FUNCIONES AUXILIARES PARA RECORDATORIOS

-- Función para calcular la próxima fecha de recurrencia
CREATE OR REPLACE FUNCTION calculate_next_recurrence(
    input_date DATE,
    recurrence_rule TEXT
)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    next_date DATE;
BEGIN
    -- Implementación básica para FREQ=MONTHLY;INTERVAL=1
    -- Se puede extender para otras frecuencias
    IF recurrence_rule ILIKE '%FREQ=MONTHLY%' THEN
        next_date := input_date + INTERVAL '1 month';
    ELSIF recurrence_rule ILIKE '%FREQ=WEEKLY%' THEN
        next_date := input_date + INTERVAL '1 week';
    ELSIF recurrence_rule ILIKE '%FREQ=DAILY%' THEN
        next_date := input_date + INTERVAL '1 day';
    ELSE
        -- Default monthly
        next_date := input_date + INTERVAL '1 month';
    END IF;

    RETURN next_date;
END;
$$;

-- Función para generar instancias de recordatorios
CREATE OR REPLACE FUNCTION generate_reminder_instances(
    p_reminder_id UUID,
    p_due_date DATE,
    p_timezone TEXT DEFAULT 'America/Mexico_City'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    reminder_record RECORD;
    scheduled_datetime TIMESTAMPTZ;
    instances_created INTEGER := 0;
BEGIN
    -- Obtener el recordatorio
    SELECT * INTO reminder_record
    FROM reminders
    WHERE id = p_reminder_id AND is_active = true;

    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    -- Calcular la fecha/hora programada
    scheduled_datetime := (p_due_date + reminder_record.days_offset * INTERVAL '1 day' + reminder_record.time_of_day) AT TIME ZONE p_timezone;

    -- Solo crear si está en el futuro
    IF scheduled_datetime > NOW() THEN
        INSERT INTO reminder_instances (
            reminder_id,
            scheduled_for,
            status
        )
        VALUES (
            p_reminder_id,
            scheduled_datetime,
            'pending'
        );

        instances_created := 1;
    END IF;

    RETURN instances_created;
END;
$$;

-- Función para procesar una confirmación de devolución/pago
CREATE OR REPLACE FUNCTION process_confirmation(
    p_tenant_id UUID,
    p_agreement_id UUID,
    p_contact_id UUID,
    p_event_type event_type,
    p_whatsapp_message_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    agreement_record RECORD;
    contact_record RECORD;
BEGIN
    -- Obtener el acuerdo
    SELECT * INTO agreement_record
    FROM agreements
    WHERE id = p_agreement_id AND tenant_id = p_tenant_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Obtener el contacto
    SELECT * INTO contact_record
    FROM contacts
    WHERE id = p_contact_id AND tenant_id = p_tenant_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Registrar el evento
    INSERT INTO events (
        tenant_id,
        contact_id,
        agreement_id,
        event_type,
        payload,
        whatsapp_message_id
    )
    VALUES (
        p_tenant_id,
        p_contact_id,
        p_agreement_id,
        p_event_type,
        jsonb_build_object(
            'contact_name', contact_record.name,
            'agreement_title', agreement_record.title,
            'confirmed_at', NOW()
        ),
        p_whatsapp_message_id
    );

    -- Si es un préstamo y se confirma devolución, marcar como completado
    IF agreement_record.type = 'loan' AND p_event_type = 'confirmed_returned' THEN
        UPDATE agreements
        SET status = 'completed',
            completed_at = NOW()
        WHERE id = p_agreement_id;
    END IF;

    -- Cancelar instancias pendientes de este acuerdo
    UPDATE reminder_instances
    SET status = 'cancelled'
    WHERE reminder_id IN (
        SELECT id FROM reminders WHERE agreement_id = p_agreement_id
    )
    AND status = 'pending';

    RETURN TRUE;
END;
$$;

-- GRANTS PARA LAS NUEVAS FUNCIONES
GRANT EXECUTE ON FUNCTION calculate_next_recurrence(DATE, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION generate_reminder_instances(UUID, DATE, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION process_confirmation(UUID, UUID, UUID, event_type, TEXT) TO authenticated, service_role;

-- COMENTARIOS
COMMENT ON FUNCTION calculate_next_recurrence(DATE, TEXT) IS 'Calcula la próxima fecha basada en regla de recurrencia RRULE';
COMMENT ON FUNCTION generate_reminder_instances(UUID, DATE, TEXT) IS 'Genera instancias de recordatorios para una fecha específica';
COMMENT ON FUNCTION process_confirmation(UUID, UUID, UUID, event_type, TEXT) IS 'Procesa confirmaciones de devolución/pago y actualiza estados';