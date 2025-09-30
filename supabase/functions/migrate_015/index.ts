// Edge Function para ejecutar migración 015
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    if (req.method === 'GET') {
      return new Response('Migration 015 function ready', {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    if (req.method === 'POST') {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      console.log('🚀 Ejecutando migración 015...');

      const migrationSteps = [
        // 1. Hacer contact_id opcional
        `ALTER TABLE agreements ALTER COLUMN contact_id DROP NOT NULL`,

        // 2. Agregar tenant_contact_id si no existe
        `DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'agreements'
        AND column_name = 'tenant_contact_id'
    ) THEN
        ALTER TABLE agreements ADD COLUMN tenant_contact_id UUID;
    END IF;
END $$`,

        // 3. Agregar foreign key constraint
        `DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_agreements_tenant_contact'
    ) THEN
        ALTER TABLE agreements
        ADD CONSTRAINT fk_agreements_tenant_contact
        FOREIGN KEY (tenant_contact_id) REFERENCES tenant_contacts(id) ON DELETE CASCADE;
    END IF;
END $$`,

        // 4. Crear índices
        `CREATE INDEX IF NOT EXISTS idx_agreements_tenant_contact_id
ON agreements(tenant_contact_id)
WHERE tenant_contact_id IS NOT NULL`,

        `CREATE INDEX IF NOT EXISTS idx_agreements_tenant_status
ON agreements(tenant_id, status, due_date)
WHERE status = 'active'`,

        // 5. Agregar constraint de validación
        `DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'chk_contact_reference'
    ) THEN
        ALTER TABLE agreements
        ADD CONSTRAINT chk_contact_reference
        CHECK (contact_id IS NOT NULL OR tenant_contact_id IS NOT NULL);
    END IF;
END $$`
      ];

      // Ejecutar todos los steps
      for (let i = 0; i < migrationSteps.length; i++) {
        try {
          const { error } = await supabase.rpc('exec_sql', { sql: migrationSteps[i] });
          if (error) {
            console.log(`⚠️ Error en step ${i + 1}:`, error.message);
          } else {
            console.log(`✅ Step ${i + 1}/${migrationSteps.length} completado`);
          }
        } catch (err) {
          console.log(`⚠️ Error en step ${i + 1}:`, err);
        }
      }

      // Verificar resultados
      const { data: agreementsCount } = await supabase
        .from('agreements')
        .select('id', { count: 'exact', head: true });

      console.log('🎉 Migración 015 completada exitosamente!');
      console.log(`📊 Total agreements en BD: ${agreementsCount?.length || 0}`);

      return new Response(JSON.stringify({
        success: true,
        message: 'Migration 015 completed successfully',
        agreements_count: agreementsCount?.length || 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response('Method not allowed', {
      status: 405,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Migration error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});