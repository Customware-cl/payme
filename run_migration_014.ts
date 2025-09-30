// Ejecutar migración 014: Contact profiles y relaciones
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function runMigration() {
  try {
    console.log('🚀 Ejecutando migración 014...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Faltan variables de entorno');
      Deno.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Leer el archivo de migración
    const migrationSQL = await Deno.readTextFile('/data2/presta_bot/supabase/migrations/014_contact_profiles_relationships.sql');

    // Dividir en statements individuales (básico)
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Ejecutando ${statements.length} statements...`);

    for (const [index, stmt] of statements.entries()) {
      if (stmt.trim().length === 0) continue;

      try {
        await supabase.rpc('exec_sql', { sql: stmt + ';' });
        console.log(`✅ Statement ${index + 1}/${statements.length} ejecutado`);
      } catch (err) {
        console.log(`⚠️ Error en statement ${index + 1}:`, err);
        console.log('Statement:', stmt.substring(0, 100) + '...');
      }
    }

    console.log('🎉 Migración 014 completada');

  } catch (error) {
    console.error('❌ Error en migración:', error);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await runMigration();
}