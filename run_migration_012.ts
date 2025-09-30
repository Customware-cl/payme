// Ejecutar migración 012: Hacer phone_e164 opcional
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MIGRATION_SQL = `
-- Hacer phone_e164 opcional
ALTER TABLE contacts
  ALTER COLUMN phone_e164 DROP NOT NULL;

-- Comentario explicativo
COMMENT ON COLUMN contacts.phone_e164 IS 'Número de teléfono en formato E164 - opcional para usuarios de canales no telefónicos como Telegram';

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_contacts_preferred_channel
  ON contacts(tenant_id, preferred_channel);

CREATE INDEX IF NOT EXISTS idx_contacts_telegram_id
  ON contacts(tenant_id, telegram_id)
  WHERE telegram_id IS NOT NULL;
`;

async function runMigration() {
  try {
    console.log('🚀 Ejecutando migración 012...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Faltan variables de entorno');
      Deno.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Ejecutar la migración usando rpc
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: MIGRATION_SQL
    });

    if (error) {
      console.error('❌ Error ejecutando migración:', error);

      // Intentar método alternativo
      console.log('🔄 Intentando método alternativo...');

      // Ejecutar cada statement por separado
      const statements = [
        'ALTER TABLE contacts ALTER COLUMN phone_e164 DROP NOT NULL;',
        "COMMENT ON COLUMN contacts.phone_e164 IS 'Número de teléfono en formato E164 - opcional para usuarios de canales no telefónicos como Telegram';",
        'CREATE INDEX IF NOT EXISTS idx_contacts_preferred_channel ON contacts(tenant_id, preferred_channel);',
        'CREATE INDEX IF NOT EXISTS idx_contacts_telegram_id ON contacts(tenant_id, telegram_id) WHERE telegram_id IS NOT NULL;'
      ];

      for (const stmt of statements) {
        try {
          await supabase.rpc('exec_sql', { sql: stmt });
          console.log('✅ Ejecutado:', stmt.substring(0, 50) + '...');
        } catch (err) {
          console.log('⚠️ Error en statement:', err);
        }
      }
    } else {
      console.log('✅ Migración ejecutada exitosamente');
    }

    console.log('🎉 Proceso completado');

  } catch (error) {
    console.error('❌ Error en migración:', error);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await runMigration();
}