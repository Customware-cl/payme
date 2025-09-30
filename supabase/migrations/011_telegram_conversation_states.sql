-- Migración 011: Tabla independiente para estados de conversación de Telegram
-- Sistema minimalista y aislado que no afecta WhatsApp

-- =====================================================
-- TABLA TELEGRAM_CONVERSATION_STATES
-- =====================================================

-- Crear tabla para estados de conversación específicos de Telegram
CREATE TABLE telegram_conversation_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  chat_id VARCHAR(50) NOT NULL, -- Telegram chat ID
  user_id VARCHAR(50) NOT NULL, -- Telegram user ID
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,

  -- Estado del flujo
  current_flow VARCHAR(50), -- 'new_loan', 'reschedule', 'new_service', etc.
  current_step VARCHAR(50), -- 'awaiting_contact', 'awaiting_item', etc.
  context JSONB DEFAULT '{}', -- Datos acumulados del flujo

  -- Control temporal
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour')
);

-- Índices para búsquedas eficientes
CREATE INDEX idx_telegram_conv_states_tenant_chat
  ON telegram_conversation_states(tenant_id, chat_id);

CREATE INDEX idx_telegram_conv_states_active
  ON telegram_conversation_states(tenant_id, chat_id)
  WHERE expires_at > NOW();

CREATE INDEX idx_telegram_conv_states_user
  ON telegram_conversation_states(tenant_id, user_id);

-- RLS (Row Level Security)
ALTER TABLE telegram_conversation_states ENABLE ROW LEVEL SECURITY;

-- Política para acceso por tenant
CREATE POLICY "telegram_conversation_states_tenant_policy"
  ON telegram_conversation_states
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_telegram_conv_states_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_telegram_conv_states_updated_at
    BEFORE UPDATE ON telegram_conversation_states
    FOR EACH ROW
    EXECUTE FUNCTION update_telegram_conv_states_updated_at();

-- Función para limpiar estados expirados
CREATE OR REPLACE FUNCTION cleanup_expired_telegram_conversations()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM telegram_conversation_states
    WHERE expires_at < NOW();

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comentarios
COMMENT ON TABLE telegram_conversation_states IS 'Estados de conversación específicos para Telegram - Sistema aislado del ConversationManager de WhatsApp';
COMMENT ON COLUMN telegram_conversation_states.chat_id IS 'ID del chat de Telegram';
COMMENT ON COLUMN telegram_conversation_states.user_id IS 'ID del usuario de Telegram';
COMMENT ON COLUMN telegram_conversation_states.current_flow IS 'Tipo de flujo actual (new_loan, reschedule, etc.)';
COMMENT ON COLUMN telegram_conversation_states.current_step IS 'Paso actual del flujo';
COMMENT ON COLUMN telegram_conversation_states.context IS 'Datos acumulados durante el flujo conversacional';

-- Fin de migración 011