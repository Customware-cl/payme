-- Migración 008: Soporte para Telegram
-- Agregar campos mínimos necesarios sin modificar arquitectura existente

-- =====================================================
-- 1. SOPORTE TELEGRAM EN CONTACTOS
-- =====================================================

ALTER TABLE contacts
  ADD COLUMN telegram_id VARCHAR(50),
  ADD COLUMN telegram_username VARCHAR(50),
  ADD COLUMN telegram_first_name VARCHAR(255),
  ADD COLUMN telegram_last_name VARCHAR(255),
  ADD COLUMN preferred_channel VARCHAR(20) DEFAULT 'whatsapp'
    CHECK (preferred_channel IN ('whatsapp', 'telegram', 'auto'));

-- Índices para búsqueda rápida por Telegram
CREATE INDEX idx_contacts_telegram_id ON contacts(telegram_id) WHERE telegram_id IS NOT NULL;
CREATE INDEX idx_contacts_preferred_channel ON contacts(preferred_channel);

-- Comentarios
COMMENT ON COLUMN contacts.telegram_id IS 'ID único de usuario en Telegram';
COMMENT ON COLUMN contacts.telegram_username IS 'Username de Telegram (@usuario)';
COMMENT ON COLUMN contacts.preferred_channel IS 'Canal preferido para comunicación';

-- =====================================================
-- 2. CONFIGURACIÓN DE BOT TELEGRAM EN TENANT
-- =====================================================

ALTER TABLE tenants
  ADD COLUMN telegram_bot_token VARCHAR(255),
  ADD COLUMN telegram_bot_username VARCHAR(50),
  ADD COLUMN telegram_webhook_secret VARCHAR(255),
  ADD COLUMN telegram_enabled BOOLEAN DEFAULT false;

-- Comentarios
COMMENT ON COLUMN tenants.telegram_bot_token IS 'Token del bot de Telegram obtenido de BotFather';
COMMENT ON COLUMN tenants.telegram_bot_username IS 'Username del bot (@botname)';
COMMENT ON COLUMN tenants.telegram_enabled IS 'Habilitar canal de Telegram';

-- =====================================================
-- 3. TABLA UNIFICADA DE MENSAJES (OPCIONAL)
-- =====================================================

-- Enum para tipos de canal
CREATE TYPE message_channel AS ENUM ('whatsapp', 'telegram');

-- Tabla de mensajes multi-canal
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,

    -- Canal y identificación externa
    channel message_channel NOT NULL,
    external_id VARCHAR(255), -- wa_message_id o telegram_message_id
    conversation_id VARCHAR(255), -- thread/chat identifier

    -- Dirección y contenido
    direction message_direction NOT NULL,
    message_type VARCHAR(50) NOT NULL, -- text, interactive, document, etc.
    content JSONB NOT NULL, -- Contenido completo del mensaje adaptado por canal

    -- Metadata
    template_id UUID REFERENCES templates(id),
    template_variables JSONB,

    -- Estados (principalmente para outbound)
    status message_status,
    delivery_status VARCHAR(50),
    read_status VARCHAR(50),

    -- Timestamps
    external_timestamp TIMESTAMPTZ, -- Timestamp del canal externo
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    UNIQUE(channel, external_id) -- Un mensaje por canal no puede duplicarse
);

-- Índices para performance
CREATE INDEX idx_messages_tenant_channel ON messages(tenant_id, channel);
CREATE INDEX idx_messages_contact_channel ON messages(contact_id, channel);
CREATE INDEX idx_messages_external ON messages(channel, external_id);
CREATE INDEX idx_messages_status ON messages(status) WHERE status IS NOT NULL;
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

-- Comentarios
COMMENT ON TABLE messages IS 'Tabla unificada de mensajes para todos los canales';
COMMENT ON COLUMN messages.channel IS 'Canal de comunicación (whatsapp, telegram)';
COMMENT ON COLUMN messages.external_id IS 'ID del mensaje en el canal externo';
COMMENT ON COLUMN messages.content IS 'Contenido adaptado según el canal';

-- =====================================================
-- 4. ACTUALIZAR OPT-IN PARA MULTI-CANAL
-- =====================================================

-- Expandir opt_in_status para incluir canales específicos
ALTER TABLE contacts
  ADD COLUMN telegram_opt_in_status opt_in_status DEFAULT 'pending',
  ADD COLUMN telegram_opt_in_date TIMESTAMPTZ,
  ADD COLUMN telegram_opt_out_date TIMESTAMPTZ;

-- Renombrar campos existentes para claridad (opcional - mantener compatibilidad)
COMMENT ON COLUMN contacts.opt_in_status IS 'Estado de opt-in para WhatsApp';
COMMENT ON COLUMN contacts.telegram_opt_in_status IS 'Estado de opt-in para Telegram';

-- =====================================================
-- 5. PLANTILLAS MULTI-CANAL
-- =====================================================

-- Agregar soporte de canal en plantillas
ALTER TABLE templates
  ADD COLUMN supported_channels message_channel[] DEFAULT ARRAY['whatsapp']::message_channel[],
  ADD COLUMN telegram_format_type VARCHAR(50) DEFAULT 'text'
    CHECK (telegram_format_type IN ('text', 'markdown', 'html'));

-- Comentarios
COMMENT ON COLUMN templates.supported_channels IS 'Canales donde esta plantilla puede usarse';
COMMENT ON COLUMN templates.telegram_format_type IS 'Formato de mensaje para Telegram';

-- =====================================================
-- 6. ESTADOS DE CONVERSACIÓN MULTI-CANAL
-- =====================================================

-- La tabla conversation_states no necesita cambios ya que:
-- - contact_id ya identifica unívocamente al usuario
-- - El ConversationManager es agnóstico al canal
-- Solo agregar índice para performance si no existe

CREATE INDEX IF NOT EXISTS idx_conversation_states_contact ON conversation_states(contact_id);

-- =====================================================
-- 7. FUNCIONES DE UTILIDAD
-- =====================================================

-- Función para encontrar contacto por cualquier ID
CREATE OR REPLACE FUNCTION find_contact_by_external_id(
    p_tenant_id UUID,
    p_whatsapp_id VARCHAR DEFAULT NULL,
    p_telegram_id VARCHAR DEFAULT NULL,
    p_phone_e164 VARCHAR DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    contact_id UUID;
BEGIN
    -- Buscar por WhatsApp ID
    IF p_whatsapp_id IS NOT NULL THEN
        SELECT id INTO contact_id
        FROM contacts
        WHERE tenant_id = p_tenant_id AND whatsapp_id = p_whatsapp_id;

        IF contact_id IS NOT NULL THEN
            RETURN contact_id;
        END IF;
    END IF;

    -- Buscar por Telegram ID
    IF p_telegram_id IS NOT NULL THEN
        SELECT id INTO contact_id
        FROM contacts
        WHERE tenant_id = p_tenant_id AND telegram_id = p_telegram_id;

        IF contact_id IS NOT NULL THEN
            RETURN contact_id;
        END IF;
    END IF;

    -- Buscar por teléfono
    IF p_phone_e164 IS NOT NULL THEN
        SELECT id INTO contact_id
        FROM contacts
        WHERE tenant_id = p_tenant_id AND phone_e164 = p_phone_e164;

        IF contact_id IS NOT NULL THEN
            RETURN contact_id;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener canal preferido del contacto
CREATE OR REPLACE FUNCTION get_preferred_channel(p_contact_id UUID)
RETURNS message_channel AS $$
DECLARE
    contact_channel VARCHAR(20);
    has_telegram BOOLEAN;
    has_whatsapp BOOLEAN;
BEGIN
    SELECT
        preferred_channel,
        telegram_id IS NOT NULL,
        whatsapp_id IS NOT NULL
    INTO contact_channel, has_telegram, has_whatsapp
    FROM contacts
    WHERE id = p_contact_id;

    -- Lógica de selección de canal
    CASE contact_channel
        WHEN 'telegram' THEN
            IF has_telegram THEN
                RETURN 'telegram'::message_channel;
            ELSIF has_whatsapp THEN
                RETURN 'whatsapp'::message_channel;
            END IF;
        WHEN 'whatsapp' THEN
            IF has_whatsapp THEN
                RETURN 'whatsapp'::message_channel;
            ELSIF has_telegram THEN
                RETURN 'telegram'::message_channel;
            END IF;
        WHEN 'auto' THEN
            -- Auto: preferir el canal donde el usuario está más activo
            -- Por simplicidad, usar el último mensaje recibido
            DECLARE
                last_channel message_channel;
            BEGIN
                SELECT channel INTO last_channel
                FROM messages
                WHERE contact_id = p_contact_id
                  AND direction = 'inbound'
                ORDER BY created_at DESC
                LIMIT 1;

                IF last_channel IS NOT NULL THEN
                    RETURN last_channel;
                END IF;
            END;

            -- Fallback: usar disponible
            IF has_telegram THEN
                RETURN 'telegram'::message_channel;
            ELSIF has_whatsapp THEN
                RETURN 'whatsapp'::message_channel;
            END IF;
    END CASE;

    -- Default fallback
    RETURN 'whatsapp'::message_channel;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. TRIGGERS PARA MANTENER CONSISTENCY
-- =====================================================

-- Trigger para actualizar updated_at en messages
CREATE OR REPLACE FUNCTION update_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_messages_updated_at
    BEFORE UPDATE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_messages_updated_at();

-- =====================================================
-- 9. POLÍTICAS RLS PARA MULTI-CANAL
-- =====================================================

-- Habilitar RLS en tabla messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Política para usuarios del tenant
CREATE POLICY messages_tenant_policy ON messages
    FOR ALL USING (
        auth.uid() IN (
            SELECT auth_user_id
            FROM users
            WHERE tenant_id = messages.tenant_id
        )
    );

-- Política para service role (para Edge Functions)
CREATE POLICY messages_service_role_policy ON messages
    FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- 10. SEEDS INICIALES (OPCIONAL)
-- =====================================================

-- Actualizar tenant existente con configuración básica de Telegram
UPDATE tenants
SET
    telegram_enabled = false,  -- Deshabilitado por defecto
    updated_at = NOW()
WHERE telegram_enabled IS NULL;

-- =====================================================
-- 11. COMENTARIOS FINALES
-- =====================================================

COMMENT ON COLUMN tenants.telegram_enabled IS 'SETUP: Habilitar después de configurar bot_token';
COMMENT ON FUNCTION find_contact_by_external_id IS 'Buscar contacto por ID de WhatsApp, Telegram o teléfono';
COMMENT ON FUNCTION get_preferred_channel IS 'Determinar canal preferido para contactar usuario';

-- Migración completada
-- Próximo: Implementar tg_webhook Edge Function