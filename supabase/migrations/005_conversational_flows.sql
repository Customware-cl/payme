-- Migración 005: Flujos Conversacionales MVP
-- Agrega tablas y campos necesarios para manejo de estados conversacionales

-- ACTUALIZAR ENUMS EXISTENTES

-- Ampliar agreement_status para incluir nuevos estados
ALTER TYPE agreement_status ADD VALUE 'overdue';
ALTER TYPE agreement_status ADD VALUE 'returned';

-- Ampliar event_type para nuevos eventos conversacionales
ALTER TYPE event_type ADD VALUE 'flow_started';
ALTER TYPE event_type ADD VALUE 'flow_completed';
ALTER TYPE event_type ADD VALUE 'intent_detected';
ALTER TYPE event_type ADD VALUE 'date_rescheduled';

-- NUEVOS TIPOS PARA FLUJOS CONVERSACIONALES

CREATE TYPE flow_type AS ENUM (
    'new_loan',
    'new_service',
    'reschedule',
    'confirm_return',
    'confirm_payment',
    'general_inquiry'
);

CREATE TYPE flow_step AS ENUM (
    'init',
    'awaiting_contact',
    'awaiting_item',
    'awaiting_due_date',
    'awaiting_confirmation',
    'awaiting_reschedule_date',
    'awaiting_service_details',
    'awaiting_recurrence',
    'confirming',
    'complete',
    'cancelled'
);

-- 1. CONVERSATION_STATES - Manejo de estados conversacionales
CREATE TABLE conversation_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) NOT NULL,

    -- Estado del flujo
    flow_type flow_type NOT NULL,
    current_step flow_step NOT NULL DEFAULT 'init',

    -- Contexto y datos temporales
    context JSONB DEFAULT '{}',

    -- TTL para limpiar conversaciones abandonadas
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),

    -- Auditoría
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Solo una conversación activa por contacto
    UNIQUE(contact_id)
);

-- 2. PAYMENT_LINKS - Enlaces de pago (MVP básico)
CREATE TABLE payment_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agreement_id UUID NOT NULL REFERENCES agreements(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Datos del enlace
    url TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'MXN',
    description TEXT,

    -- Estado y validez
    status VARCHAR(20) DEFAULT 'active', -- active, used, expired
    expires_at TIMESTAMPTZ,
    used_at TIMESTAMPTZ,

    -- Metadatos
    metadata JSONB DEFAULT '{}',

    -- Auditoría
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. METRICS_DAILY - Métricas diarias por tenant
CREATE TABLE metrics_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    date DATE NOT NULL,

    -- Métricas de opt-in
    opt_in_sent INTEGER DEFAULT 0,
    opt_in_accepted INTEGER DEFAULT 0,
    opt_in_rejected INTEGER DEFAULT 0,

    -- Métricas de mensajes
    reminders_sent INTEGER DEFAULT 0,
    reminders_delivered INTEGER DEFAULT 0,
    reminders_read INTEGER DEFAULT 0,
    reminders_failed INTEGER DEFAULT 0,

    -- Métricas de interacción
    buttons_clicked INTEGER DEFAULT 0,
    flows_started INTEGER DEFAULT 0,
    flows_completed INTEGER DEFAULT 0,
    flows_abandoned INTEGER DEFAULT 0,

    -- Métricas de préstamos
    loans_created INTEGER DEFAULT 0,
    loans_returned_ontime INTEGER DEFAULT 0,
    loans_overdue INTEGER DEFAULT 0,

    -- Métricas de servicios
    services_created INTEGER DEFAULT 0,
    payments_confirmed INTEGER DEFAULT 0,
    payments_overdue INTEGER DEFAULT 0,

    -- Auditoría
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Una fila por tenant por día
    UNIQUE(tenant_id, date)
);

-- MODIFICAR TABLA AGREEMENTS EXISTENTE

-- Agregar campos para recurrencia avanzada
ALTER TABLE agreements
ADD COLUMN rrule TEXT, -- Regla de recurrencia iCalendar
ADD COLUMN exdates JSONB DEFAULT '[]', -- Fechas excluidas por reprogramaciones
ADD COLUMN target_date DATE, -- Fecha objetivo actual (puede diferir de due_date por reprogramaciones)
ADD COLUMN last_reminder_sent TIMESTAMPTZ, -- Último recordatorio enviado
ADD COLUMN reminder_count INTEGER DEFAULT 0; -- Cantidad de recordatorios enviados

-- Actualizar target_date con due_date existente para datos actuales
UPDATE agreements SET target_date = due_date WHERE target_date IS NULL AND due_date IS NOT NULL;

-- MODIFICAR TABLA TEMPLATES PARA PLANTILLAS HSM

-- Agregar campos específicos para templates de Meta
ALTER TABLE templates
ADD COLUMN hsm_template_id VARCHAR(50), -- ID del template en Meta
ADD COLUMN hsm_status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
ADD COLUMN variable_count INTEGER DEFAULT 0,
ADD COLUMN has_buttons BOOLEAN DEFAULT FALSE,
ADD COLUMN button_config JSONB DEFAULT '[]';

-- ÍNDICES PARA PERFORMANCE

-- Conversation states
CREATE INDEX idx_conversation_states_contact_id ON conversation_states(contact_id);
CREATE INDEX idx_conversation_states_tenant_id ON conversation_states(tenant_id);
CREATE INDEX idx_conversation_states_expires_at ON conversation_states(expires_at);
CREATE INDEX idx_conversation_states_flow_type ON conversation_states(flow_type);

-- Payment links
CREATE INDEX idx_payment_links_agreement_id ON payment_links(agreement_id);
CREATE INDEX idx_payment_links_tenant_id ON payment_links(tenant_id);
CREATE INDEX idx_payment_links_status ON payment_links(status);
CREATE INDEX idx_payment_links_expires_at ON payment_links(expires_at);

-- Metrics daily
CREATE INDEX idx_metrics_daily_tenant_date ON metrics_daily(tenant_id, date);
CREATE INDEX idx_metrics_daily_date ON metrics_daily(date);

-- Agreements - nuevos índices
CREATE INDEX idx_agreements_target_date ON agreements(target_date);
CREATE INDEX idx_agreements_last_reminder_sent ON agreements(last_reminder_sent);

-- TRIGGERS DE AUDITORÍA

CREATE TRIGGER update_conversation_states_updated_at
    BEFORE UPDATE ON conversation_states
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_links_updated_at
    BEFORE UPDATE ON payment_links
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_metrics_daily_updated_at
    BEFORE UPDATE ON metrics_daily
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- FUNCIONES AUXILIARES PARA FLUJOS CONVERSACIONALES

-- Función para limpiar conversaciones expiradas
CREATE OR REPLACE FUNCTION cleanup_expired_conversations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM conversation_states
    WHERE expires_at < NOW();

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN deleted_count;
END;
$$;

-- Función para obtener o crear estado de conversación
CREATE OR REPLACE FUNCTION get_or_create_conversation_state(
    p_tenant_id UUID,
    p_contact_id UUID,
    p_phone_number VARCHAR(20),
    p_flow_type flow_type
)
RETURNS conversation_states
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    state_record conversation_states;
BEGIN
    -- Intentar obtener estado existente
    SELECT * INTO state_record
    FROM conversation_states
    WHERE contact_id = p_contact_id
    AND expires_at > NOW();

    -- Si existe, actualizar expiración y retornar
    IF FOUND THEN
        UPDATE conversation_states
        SET expires_at = NOW() + INTERVAL '30 minutes',
            updated_at = NOW()
        WHERE id = state_record.id;

        RETURN state_record;
    END IF;

    -- Si no existe, crear nuevo
    INSERT INTO conversation_states (
        tenant_id,
        contact_id,
        phone_number,
        flow_type,
        current_step,
        expires_at
    )
    VALUES (
        p_tenant_id,
        p_contact_id,
        p_phone_number,
        p_flow_type,
        'init',
        NOW() + INTERVAL '30 minutes'
    )
    RETURNING * INTO state_record;

    RETURN state_record;
END;
$$;

-- Función para actualizar paso de conversación
CREATE OR REPLACE FUNCTION update_conversation_step(
    p_conversation_id UUID,
    p_new_step flow_step,
    p_context JSONB DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE conversation_states
    SET current_step = p_new_step,
        context = COALESCE(p_context, context),
        expires_at = NOW() + INTERVAL '30 minutes',
        updated_at = NOW()
    WHERE id = p_conversation_id
    AND expires_at > NOW();

    RETURN FOUND;
END;
$$;

-- Función para finalizar conversación
CREATE OR REPLACE FUNCTION complete_conversation(
    p_conversation_id UUID,
    p_success BOOLEAN DEFAULT TRUE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE conversation_states
    SET current_step = CASE WHEN p_success THEN 'complete' ELSE 'cancelled' END,
        expires_at = NOW(), -- Expira inmediatamente
        updated_at = NOW()
    WHERE id = p_conversation_id;

    RETURN FOUND;
END;
$$;

-- Función para registrar métricas diarias
CREATE OR REPLACE FUNCTION increment_daily_metric(
    p_tenant_id UUID,
    p_metric_name VARCHAR(50),
    p_increment INTEGER DEFAULT 1,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    update_sql TEXT;
BEGIN
    -- Insertar registro si no existe
    INSERT INTO metrics_daily (tenant_id, date)
    VALUES (p_tenant_id, p_date)
    ON CONFLICT (tenant_id, date) DO NOTHING;

    -- Construir SQL dinámico para incrementar la métrica específica
    update_sql := format('UPDATE metrics_daily SET %I = %I + %s WHERE tenant_id = %L AND date = %L',
                        p_metric_name, p_metric_name, p_increment, p_tenant_id, p_date);

    EXECUTE update_sql;

    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$;

-- Función para programar recordatorios con offset
CREATE OR REPLACE FUNCTION schedule_reminder_with_offset(
    p_agreement_id UUID,
    p_target_date DATE,
    p_offset_days INTEGER,
    p_reminder_type reminder_type,
    p_template_name VARCHAR(100)
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    reminder_id UUID;
    template_record templates;
    agreement_record agreements;
    contact_tz TEXT;
    scheduled_datetime TIMESTAMPTZ;
BEGIN
    -- Obtener datos del acuerdo
    SELECT * INTO agreement_record
    FROM agreements
    WHERE id = p_agreement_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agreement not found: %', p_agreement_id;
    END IF;

    -- Obtener timezone del contacto
    SELECT timezone INTO contact_tz
    FROM contacts
    WHERE id = agreement_record.contact_id;

    -- Obtener template
    SELECT * INTO template_record
    FROM templates
    WHERE name = p_template_name
    AND (tenant_id = agreement_record.tenant_id OR tenant_id IS NULL)
    ORDER BY tenant_id NULLS LAST
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Template not found: %', p_template_name;
    END IF;

    -- Calcular fecha/hora programada
    scheduled_datetime := (p_target_date + p_offset_days * INTERVAL '1 day' + TIME '09:00:00')
                         AT TIME ZONE COALESCE(contact_tz, 'America/Mexico_City');

    -- Solo crear si está en el futuro
    IF scheduled_datetime > NOW() THEN
        INSERT INTO reminder_instances (
            reminder_id,
            scheduled_for,
            status,
            rendered_variables
        )
        SELECT
            r.id,
            scheduled_datetime,
            'pending',
            jsonb_build_object(
                'agreement_id', p_agreement_id,
                'template_name', p_template_name,
                'reminder_type', p_reminder_type
            )
        FROM reminders r
        WHERE r.agreement_id = p_agreement_id
        AND r.reminder_type = p_reminder_type
        AND r.is_active = true
        LIMIT 1
        RETURNING id INTO reminder_id;
    END IF;

    RETURN reminder_id;
END;
$$;

-- INSERTAR PLANTILLAS HSM PREDEFINIDAS

-- Limpiar templates anteriores y agregar las nuevas HSM
DELETE FROM templates WHERE tenant_id IS NULL;

INSERT INTO templates (
    id,
    tenant_id,
    name,
    category,
    language,
    header,
    body,
    footer,
    buttons_config,
    meta_template_name,
    variables,
    approval_status,
    hsm_template_id,
    hsm_status,
    variable_count,
    has_buttons,
    button_config
) VALUES

-- 1. Template de Opt-in
(
    uuid_generate_v4(),
    NULL,
    'recordatorio_optin_v1',
    'utility',
    'es',
    NULL,
    'Hola {{1}}, {{2}} quiere enviarte recordatorios sobre {{3}} por WhatsApp. ¿Aceptas?',
    'Responde para confirmar tu preferencia.',
    '[{"type": "quick_reply", "buttons": [{"type": "text", "text": "Aceptar", "id": "opt_in_yes"}]}]'::jsonb,
    'recordatorio_optin_v1',
    '["contact_name", "business_name", "reminder_type"]'::jsonb,
    'pending',
    NULL,
    'pending',
    3,
    true,
    '[{"id": "opt_in_yes", "text": "Aceptar"}]'::jsonb
),

-- 2. Devolución 24h
(
    uuid_generate_v4(),
    NULL,
    'devolucion_24h_v1',
    'utility',
    'es',
    '⏰ Recordatorio',
    'Recordatorio: mañana {{1}} debes devolver {{2}} a {{3}}.',
    NULL,
    '[{"type": "quick_reply", "buttons": [{"type": "text", "text": "Confirmaré al devolver", "id": "confirm_will_return"}, {"type": "text", "text": "Reprogramar", "id": "reschedule_return"}]}]'::jsonb,
    'devolucion_24h_v1',
    '["due_time", "item_description", "business_name"]'::jsonb,
    'pending',
    NULL,
    'pending',
    3,
    true,
    '[{"id": "confirm_will_return", "text": "Confirmaré al devolver"}, {"id": "reschedule_return", "text": "Reprogramar"}]'::jsonb
),

-- 3. Devolución hoy
(
    uuid_generate_v4(),
    NULL,
    'devolucion_hoy_v1',
    'utility',
    'es',
    '📅 Vencimiento HOY',
    'Hoy {{1}} vence la devolución de {{2}}. ¿Listo?',
    NULL,
    '[{"type": "quick_reply", "buttons": [{"type": "text", "text": "Ya lo devolví", "id": "loan_returned"}, {"type": "text", "text": "Reprogramar", "id": "reschedule_return"}]}]'::jsonb,
    'devolucion_hoy_v1',
    '["due_time", "item_description"]'::jsonb,
    'pending',
    NULL,
    'pending',
    2,
    true,
    '[{"id": "loan_returned", "text": "Ya lo devolví"}, {"id": "reschedule_return", "text": "Reprogramar"}]'::jsonb
),

-- 4. Devolución vencida
(
    uuid_generate_v4(),
    NULL,
    'devolucion_vencida_v1',
    'utility',
    'es',
    '⚠️ Préstamo Vencido',
    'La devolución de {{1}} venció el {{2}}. ¿Qué deseas hacer?',
    NULL,
    '[{"type": "quick_reply", "buttons": [{"type": "text", "text": "Reprogramar", "id": "reschedule_return"}, {"type": "text", "text": "Ya lo devolví", "id": "loan_returned"}]}]'::jsonb,
    'devolucion_vencida_v1',
    '["item_description", "due_date"]'::jsonb,
    'pending',
    NULL,
    'pending',
    2,
    true,
    '[{"id": "reschedule_return", "text": "Reprogramar"}, {"id": "loan_returned", "text": "Ya lo devolví"}]'::jsonb
),

-- 5. Cobro mensual
(
    uuid_generate_v4(),
    NULL,
    'cobro_mensual_v1',
    'utility',
    'es',
    '💰 Pago Pendiente',
    '{{1}}: el servicio de {{2}} se cobra el {{3}}.',
    NULL,
    '[{"type": "quick_reply", "buttons": [{"type": "text", "text": "Pagar ahora", "id": "pay_online"}, {"type": "text", "text": "Pagado efectivo", "id": "paid_cash"}, {"type": "text", "text": "Reagendar", "id": "reschedule_payment"}]}]'::jsonb,
    'cobro_mensual_v1',
    '["business_name", "service_description", "due_date"]'::jsonb,
    'pending',
    NULL,
    'pending',
    3,
    true,
    '[{"id": "pay_online", "text": "Pagar ahora"}, {"id": "paid_cash", "text": "Pagado efectivo"}, {"id": "reschedule_payment", "text": "Reagendar"}]'::jsonb
);

-- GRANTS Y PERMISOS

-- Permitir acceso a las nuevas funciones
GRANT EXECUTE ON FUNCTION cleanup_expired_conversations() TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_conversation_state(UUID, UUID, VARCHAR, flow_type) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION update_conversation_step(UUID, flow_step, JSONB) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION complete_conversation(UUID, BOOLEAN) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION increment_daily_metric(UUID, VARCHAR, INTEGER, DATE) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION schedule_reminder_with_offset(UUID, DATE, INTEGER, reminder_type, VARCHAR) TO service_role, authenticated;

-- COMENTARIOS DE DOCUMENTACIÓN

COMMENT ON TABLE conversation_states IS 'Estados de conversaciones activas para flujos multi-paso';
COMMENT ON TABLE payment_links IS 'Enlaces de pago generados para servicios';
COMMENT ON TABLE metrics_daily IS 'Métricas diarias agregadas por tenant';

COMMENT ON FUNCTION cleanup_expired_conversations() IS 'Limpia conversaciones expiradas (ejecutar cada hora)';
COMMENT ON FUNCTION get_or_create_conversation_state(UUID, UUID, VARCHAR, flow_type) IS 'Obtiene o crea estado de conversación activa';
COMMENT ON FUNCTION update_conversation_step(UUID, flow_step, JSONB) IS 'Actualiza paso actual de conversación';
COMMENT ON FUNCTION complete_conversation(UUID, BOOLEAN) IS 'Finaliza conversación como completada o cancelada';
COMMENT ON FUNCTION increment_daily_metric(UUID, VARCHAR, INTEGER, DATE) IS 'Incrementa métrica diaria específica';
COMMENT ON FUNCTION schedule_reminder_with_offset(UUID, DATE, INTEGER, reminder_type, VARCHAR) IS 'Programa recordatorio con offset de días';