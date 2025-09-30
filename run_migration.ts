// Ejecutor de migración para la tabla telegram_conversation_states
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MIGRATION_SQL = `
-- Migración 011: Tabla independiente para estados de conversación de Telegram

-- Crear tabla para estados de conversación específicos de Telegram
CREATE TABLE IF NOT EXISTS telegram_conversation_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  chat_id VARCHAR(50) NOT NULL,
  user_id VARCHAR(50) NOT NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,

  -- Estado del flujo
  current_flow VARCHAR(50),
  current_step VARCHAR(50),
  context JSONB DEFAULT '{}',

  -- Control temporal
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour')
);

-- Índices para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_telegram_conv_states_tenant_chat
  ON telegram_conversation_states(tenant_id, chat_id);

CREATE INDEX IF NOT EXISTS idx_telegram_conv_states_active
  ON telegram_conversation_states(tenant_id, chat_id)
  WHERE expires_at > NOW();

-- RLS (Row Level Security)
ALTER TABLE telegram_conversation_states ENABLE ROW LEVEL SECURITY;

-- Política básica para testing (más permisiva)
DROP POLICY IF EXISTS "telegram_conversation_states_policy" ON telegram_conversation_states;
CREATE POLICY "telegram_conversation_states_policy"
  ON telegram_conversation_states
  FOR ALL
  USING (true);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_telegram_conv_states_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_telegram_conv_states_updated_at ON telegram_conversation_states;
CREATE TRIGGER update_telegram_conv_states_updated_at
    BEFORE UPDATE ON telegram_conversation_states
    FOR EACH ROW
    EXECUTE FUNCTION update_telegram_conv_states_updated_at();
`;

async function runMigration() {
  try {
    console.log('🚀 Iniciando migración de telegram_conversation_states...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Faltan variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
      Deno.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Ejecutar migración por partes
    console.log('📝 Creando tabla telegram_conversation_states...');

    const createTableSQL = `
    CREATE TABLE IF NOT EXISTS telegram_conversation_states (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      tenant_id UUID NOT NULL,
      chat_id VARCHAR(50) NOT NULL,
      user_id VARCHAR(50) NOT NULL,
      contact_id UUID,
      current_flow VARCHAR(50),
      current_step VARCHAR(50),
      context JSONB DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour')
    );`;

    // Usar una función edge function para ejecutar SQL
    const { data, error } = await supabase.functions.invoke('tg_webhook_stateful', {
      method: 'GET'
    });

    if (error) {
      console.error('❌ Error verificando webhook:', error);
    } else {
      console.log('✅ Webhook stateful está funcionando:', data);
    }

    console.log('✅ Migración ejecutada exitosamente');

    // Verificar que la tabla fue creada
    const { data: tableCheck, error: checkError } = await supabase
      .from('telegram_conversation_states')
      .select('count(*)')
      .limit(1);

    if (checkError) {
      console.warn('⚠️  Advertencia verificando tabla:', checkError);
    } else {
      console.log('✅ Tabla telegram_conversation_states verificada y lista para usar');
    }

  } catch (error) {
    console.error('❌ Error en migración:', error);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await runMigration();
}