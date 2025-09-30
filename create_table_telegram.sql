-- Crear tabla para estados de conversación de Telegram
-- EJECUTAR MANUALMENTE EN LA CONSOLA DE SUPABASE

-- Crear la tabla
CREATE TABLE IF NOT EXISTS telegram_conversation_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  chat_id VARCHAR(50) NOT NULL,
  user_id VARCHAR(50) NOT NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,

  -- Estado del flujo
  current_flow VARCHAR(50), -- 'new_loan', 'reschedule', 'new_service'
  current_step VARCHAR(50), -- 'init', 'awaiting_contact', etc.
  context JSONB DEFAULT '{}', -- Datos del flujo

  -- Control temporal
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour')
);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_telegram_conv_states_tenant_chat
  ON telegram_conversation_states(tenant_id, chat_id);

CREATE INDEX IF NOT EXISTS idx_telegram_conv_states_active
  ON telegram_conversation_states(tenant_id, chat_id)
  WHERE expires_at > NOW();

-- Habilitar RLS
ALTER TABLE telegram_conversation_states ENABLE ROW LEVEL SECURITY;

-- Crear política permisiva para testing
CREATE POLICY "telegram_conversation_states_policy"
  ON telegram_conversation_states
  FOR ALL
  USING (true);

-- Función para trigger de updated_at
CREATE OR REPLACE FUNCTION update_telegram_conv_states_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Crear trigger
CREATE TRIGGER update_telegram_conv_states_updated_at
    BEFORE UPDATE ON telegram_conversation_states
    FOR EACH ROW
    EXECUTE FUNCTION update_telegram_conv_states_updated_at();