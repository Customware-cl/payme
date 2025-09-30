-- Migration: Sistema PrestaBot Refinado
-- Implementa estados granulares, opt-in robusto y notificaciones al dueño

-- 1. Agregar nuevos valores a enums existentes
-- Nuevos estados para acuerdos
ALTER TYPE agreement_status ADD VALUE IF NOT EXISTS 'due_soon';
ALTER TYPE agreement_status ADD VALUE IF NOT EXISTS 'overdue';
ALTER TYPE agreement_status ADD VALUE IF NOT EXISTS 'paused';

-- Nuevos pasos de flujo
ALTER TYPE flow_step ADD VALUE IF NOT EXISTS 'opt_in_pending';
ALTER TYPE flow_step ADD VALUE IF NOT EXISTS 'due_soon';
ALTER TYPE flow_step ADD VALUE IF NOT EXISTS 'dia_d';
ALTER TYPE flow_step ADD VALUE IF NOT EXISTS 'vencido';
ALTER TYPE flow_step ADD VALUE IF NOT EXISTS 'reprogramacion';
ALTER TYPE flow_step ADD VALUE IF NOT EXISTS 'devuelto_pagado';

-- 2. Crear tabla de notificaciones al dueño
CREATE TABLE IF NOT EXISTS owner_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agreement_id UUID REFERENCES agreements(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL CHECK (notification_type IN (
        'opt_in_rejected',
        'agreement_completed',
        'agreement_overdue',
        'payment_confirmed',
        'return_confirmed',
        'reschedule_requested',
        'daily_summary'
    )),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    read_at TIMESTAMPTZ,
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Agregar campos mejorados a agreements
ALTER TABLE agreements ADD COLUMN IF NOT EXISTS opt_in_required BOOLEAN DEFAULT true;
ALTER TABLE agreements ADD COLUMN IF NOT EXISTS opt_in_sent_at TIMESTAMPTZ;
ALTER TABLE agreements ADD COLUMN IF NOT EXISTS owner_notified_at TIMESTAMPTZ;
ALTER TABLE agreements ADD COLUMN IF NOT EXISTS last_reminder_sent TIMESTAMPTZ;
ALTER TABLE agreements ADD COLUMN IF NOT EXISTS reminder_sequence_step INTEGER DEFAULT 0;

-- 4. Agregar campos mejorados a contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS opt_in_message_id TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS opt_in_response_at TIMESTAMPTZ;

-- 5. Crear índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_owner_notifications_tenant_owner ON owner_notifications(tenant_id, owner_id);
CREATE INDEX IF NOT EXISTS idx_owner_notifications_type ON owner_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_owner_notifications_read ON owner_notifications(read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_owner_notifications_created ON owner_notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agreements_due_soon ON agreements(due_date) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_agreements_overdue ON agreements(due_date) WHERE status = 'overdue';
CREATE INDEX IF NOT EXISTS idx_agreements_opt_in ON agreements(opt_in_required, opt_in_sent_at);

-- 6. Trigger para updated_at en owner_notifications
CREATE OR REPLACE FUNCTION update_owner_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_owner_notifications_updated_at
    BEFORE UPDATE ON owner_notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_owner_notifications_updated_at();

-- 7. RLS Policies para owner_notifications
ALTER TABLE owner_notifications ENABLE ROW LEVEL SECURITY;

-- Los owners pueden ver sus notificaciones
CREATE POLICY "Owners can view their notifications" ON owner_notifications
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM users
            WHERE auth_user_id = auth.uid()
        )
    );

-- Los owners pueden marcar como leídas sus notificaciones
CREATE POLICY "Owners can update their notifications" ON owner_notifications
    FOR UPDATE USING (
        tenant_id IN (
            SELECT tenant_id FROM users
            WHERE auth_user_id = auth.uid()
        )
    );

-- Service role puede insertar notificaciones
CREATE POLICY "Service role can insert notifications" ON owner_notifications
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Service role puede eliminar notificaciones antiguas
CREATE POLICY "Service role can delete old notifications" ON owner_notifications
    FOR DELETE USING (auth.role() = 'service_role');

-- 8. Función para crear notificación al dueño
CREATE OR REPLACE FUNCTION create_owner_notification(
    p_tenant_id UUID,
    p_notification_type TEXT,
    p_title TEXT,
    p_message TEXT,
    p_agreement_id UUID DEFAULT NULL,
    p_contact_id UUID DEFAULT NULL,
    p_priority TEXT DEFAULT 'normal',
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    notification_id UUID;
    owner_user_id UUID;
BEGIN
    -- Encontrar el owner del tenant
    SELECT id INTO owner_user_id
    FROM users
    WHERE tenant_id = p_tenant_id
      AND role = 'owner'
      AND auth_user_id IS NOT NULL
    LIMIT 1;

    IF owner_user_id IS NULL THEN
        -- Si no hay owner específico, usar el primer admin
        SELECT id INTO owner_user_id
        FROM users
        WHERE tenant_id = p_tenant_id
          AND role IN ('owner', 'admin')
        LIMIT 1;
    END IF;

    IF owner_user_id IS NULL THEN
        RAISE EXCEPTION 'No owner/admin found for tenant %', p_tenant_id;
    END IF;

    -- Crear notificación
    INSERT INTO owner_notifications (
        tenant_id,
        owner_id,
        agreement_id,
        contact_id,
        notification_type,
        title,
        message,
        priority,
        metadata
    ) VALUES (
        p_tenant_id,
        owner_user_id,
        p_agreement_id,
        p_contact_id,
        p_notification_type,
        p_title,
        p_message,
        p_priority,
        p_metadata
    ) RETURNING id INTO notification_id;

    RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Función para actualizar estado de acuerdo basado en tiempo
CREATE OR REPLACE FUNCTION update_agreement_status_by_time()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER := 0;
    agreement_record RECORD;
    notification_id UUID;
BEGIN
    -- Marcar acuerdos como due_soon (24h antes)
    UPDATE agreements
    SET status = 'due_soon',
        updated_at = NOW()
    WHERE status = 'active'
      AND due_date IS NOT NULL
      AND due_date <= (NOW() + INTERVAL '24 hours')
      AND due_date > NOW();

    GET DIAGNOSTICS updated_count = ROW_COUNT;

    -- Marcar acuerdos como overdue (después de la fecha)
    FOR agreement_record IN
        SELECT a.id, a.tenant_id, a.title, a.due_date, a.contact_id
        FROM agreements a
        WHERE a.status IN ('active', 'due_soon')
          AND a.due_date IS NOT NULL
          AND a.due_date < NOW()
    LOOP
        -- Actualizar estado
        UPDATE agreements
        SET status = 'overdue',
            updated_at = NOW()
        WHERE id = agreement_record.id;

        -- Notificar al dueño
        SELECT create_owner_notification(
            agreement_record.tenant_id,
            'agreement_overdue',
            'Acuerdo Vencido',
            format('El acuerdo "%s" venció el %s y no se ha completado.',
                agreement_record.title,
                to_char(agreement_record.due_date, 'DD/MM/YYYY HH24:MI')
            ),
            agreement_record.id,
            agreement_record.contact_id,
            'high'
        ) INTO notification_id;

        updated_count := updated_count + 1;
    END LOOP;

    RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Función para estadísticas de notificaciones
CREATE OR REPLACE FUNCTION get_owner_notification_stats(p_tenant_id UUID)
RETURNS TABLE (
    unread_count BIGINT,
    high_priority_count BIGINT,
    today_count BIGINT,
    total_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(CASE WHEN read_at IS NULL THEN 1 END) as unread_count,
        COUNT(CASE WHEN priority = 'high' AND read_at IS NULL THEN 1 END) as high_priority_count,
        COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as today_count,
        COUNT(*) as total_count
    FROM owner_notifications
    WHERE tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Grants para las nuevas funciones
GRANT EXECUTE ON FUNCTION create_owner_notification(UUID, TEXT, TEXT, TEXT, UUID, UUID, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION update_agreement_status_by_time() TO service_role;
GRANT EXECUTE ON FUNCTION get_owner_notification_stats(UUID) TO authenticated;

-- 12. Comentarios para documentación
COMMENT ON TABLE owner_notifications IS 'Notificaciones para dueños/administradores del sistema';
COMMENT ON COLUMN owner_notifications.notification_type IS 'Tipo de notificación: opt_in_rejected, agreement_completed, etc.';
COMMENT ON COLUMN owner_notifications.priority IS 'Prioridad: high (inmediata), normal (diaria), low (semanal)';
COMMENT ON FUNCTION create_owner_notification(UUID, TEXT, TEXT, TEXT, UUID, UUID, TEXT, JSONB) IS 'Crea notificación para el dueño del tenant';
COMMENT ON FUNCTION update_agreement_status_by_time() IS 'Actualiza estados de acuerdos basado en tiempo (due_soon, overdue)';

-- 13. Log del upgrade del sistema (usando event_type válido)
-- Commented out - will add via separate script if needed
-- System upgrade completed successfully