-- Migration: Message Queue for WhatsApp 24h Window Management
-- Tabla para encolar mensajes que no se pueden enviar por ventana cerrada

-- Crear tabla de cola de mensajes
CREATE TABLE IF NOT EXISTS message_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    message_type TEXT NOT NULL CHECK (message_type IN ('template', 'text', 'interactive')),
    content JSONB NOT NULL DEFAULT '{}',
    template_name TEXT,
    template_variables JSONB DEFAULT '{}',
    scheduled_for TIMESTAMPTZ,
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),
    max_retries INTEGER NOT NULL DEFAULT 3,
    retry_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'expired')),
    expires_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_message_queue_tenant_id ON message_queue(tenant_id);
CREATE INDEX IF NOT EXISTS idx_message_queue_contact_id ON message_queue(contact_id);
CREATE INDEX IF NOT EXISTS idx_message_queue_status ON message_queue(status);
CREATE INDEX IF NOT EXISTS idx_message_queue_scheduled_for ON message_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_message_queue_priority_created ON message_queue(priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_message_queue_expires_at ON message_queue(expires_at);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_message_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_message_queue_updated_at
    BEFORE UPDATE ON message_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_message_queue_updated_at();

-- RLS Policies
ALTER TABLE message_queue ENABLE ROW LEVEL SECURITY;

-- Los usuarios solo pueden ver mensajes de su tenant
CREATE POLICY "Users can view message queue for their tenant" ON message_queue
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM users
            WHERE auth_user_id = auth.uid()
        )
    );

-- Los usuarios pueden insertar mensajes en la cola de su tenant
CREATE POLICY "Users can insert message queue for their tenant" ON message_queue
    FOR INSERT WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM users
            WHERE auth_user_id = auth.uid()
        )
    );

-- Los usuarios pueden actualizar mensajes de su tenant
CREATE POLICY "Users can update message queue for their tenant" ON message_queue
    FOR UPDATE USING (
        tenant_id IN (
            SELECT tenant_id FROM users
            WHERE auth_user_id = auth.uid()
        )
    );

-- Solo el sistema puede eliminar mensajes (a través de Service Role)
CREATE POLICY "Service role can delete message queue" ON message_queue
    FOR DELETE USING (auth.role() = 'service_role');

-- Función para limpiar mensajes expirados (llamada por cron job)
CREATE OR REPLACE FUNCTION cleanup_expired_message_queue()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM message_queue
    WHERE status = 'expired'
       OR (expires_at IS NOT NULL AND expires_at < NOW())
       OR (status = 'failed' AND updated_at < NOW() - INTERVAL '7 days');

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    INSERT INTO events (tenant_id, event_type, payload)
    SELECT DISTINCT tenant_id, 'system_cleanup'::event_type,
           jsonb_build_object('cleaned_messages', deleted_count, 'timestamp', NOW())
    FROM message_queue
    WHERE tenant_id IS NOT NULL
    LIMIT 1;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para estadísticas de cola de mensajes
CREATE OR REPLACE FUNCTION get_message_queue_stats(p_tenant_id UUID)
RETURNS TABLE (
    total_queued BIGINT,
    high_priority BIGINT,
    normal_priority BIGINT,
    low_priority BIGINT,
    pending_count BIGINT,
    failed_count BIGINT,
    expired_count BIGINT,
    avg_retry_count NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_queued,
        COUNT(CASE WHEN priority = 'high' THEN 1 END)::BIGINT as high_priority,
        COUNT(CASE WHEN priority = 'normal' THEN 1 END)::BIGINT as normal_priority,
        COUNT(CASE WHEN priority = 'low' THEN 1 END)::BIGINT as low_priority,
        COUNT(CASE WHEN status = 'pending' THEN 1 END)::BIGINT as pending_count,
        COUNT(CASE WHEN status = 'failed' THEN 1 END)::BIGINT as failed_count,
        COUNT(CASE WHEN status = 'expired' THEN 1 END)::BIGINT as expired_count,
        COALESCE(AVG(retry_count), 0) as avg_retry_count
    FROM message_queue
    WHERE tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grants para las nuevas funciones
GRANT EXECUTE ON FUNCTION cleanup_expired_message_queue() TO service_role;
GRANT EXECUTE ON FUNCTION get_message_queue_stats(UUID) TO authenticated;

-- Comentarios para documentación
COMMENT ON TABLE message_queue IS 'Cola de mensajes para gestionar envíos de WhatsApp respetando la ventana de 24 horas';
COMMENT ON COLUMN message_queue.message_type IS 'Tipo de mensaje: template (HSM), text (texto libre), interactive (botones)';
COMMENT ON COLUMN message_queue.priority IS 'Prioridad del mensaje: high (conversaciones), normal (recordatorios), low (marketing)';
COMMENT ON COLUMN message_queue.scheduled_for IS 'Fecha/hora programada para envío (NULL = enviar ASAP)';
COMMENT ON COLUMN message_queue.expires_at IS 'Fecha/hora de expiración del mensaje (NULL = no expira)';
COMMENT ON FUNCTION cleanup_expired_message_queue() IS 'Limpia mensajes expirados y fallidos de más de 7 días';
COMMENT ON FUNCTION get_message_queue_stats(UUID) IS 'Obtiene estadísticas de la cola de mensajes para un tenant';