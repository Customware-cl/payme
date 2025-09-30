// Edge Function para ejecutar migración 014
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
      return new Response('Migration 014 function ready', {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    if (req.method === 'POST') {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      console.log('🚀 Ejecutando migración 014...');

      const migrationSteps = [
        // 1. Crear contact_profiles
        `CREATE TABLE IF NOT EXISTS contact_profiles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          phone_e164 VARCHAR(20),
          telegram_id VARCHAR(50),
          telegram_username VARCHAR(50),
          telegram_first_name VARCHAR(255),
          telegram_last_name VARCHAR(255),
          verified BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT phone_or_telegram_required CHECK (
            phone_e164 IS NOT NULL OR telegram_id IS NOT NULL
          ),
          CONSTRAINT valid_phone_format CHECK (
            phone_e164 IS NULL OR phone_e164 ~ '^\\+[1-9]\\d{1,14}$'
          )
        )`,

        // 2. Crear índices únicos para contact_profiles
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_profiles_phone ON contact_profiles(phone_e164) WHERE phone_e164 IS NOT NULL`,
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_profiles_telegram_id ON contact_profiles(telegram_id) WHERE telegram_id IS NOT NULL`,
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_profiles_telegram_username ON contact_profiles(telegram_username) WHERE telegram_username IS NOT NULL`,

        // 3. Crear tenant_contacts
        `CREATE TABLE IF NOT EXISTS tenant_contacts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          contact_profile_id UUID NOT NULL REFERENCES contact_profiles(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          nickname VARCHAR(100),
          preferred_channel VARCHAR(20) DEFAULT 'whatsapp'
            CHECK (preferred_channel IN ('whatsapp', 'telegram', 'auto')),
          whatsapp_id VARCHAR(50),
          opt_in_status opt_in_status NOT NULL DEFAULT 'pending',
          opt_in_date TIMESTAMPTZ,
          opt_out_date TIMESTAMPTZ,
          telegram_opt_in_status opt_in_status DEFAULT 'pending',
          timezone VARCHAR(50),
          preferred_language VARCHAR(5) DEFAULT 'es',
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(tenant_id, contact_profile_id),
          CONSTRAINT valid_timezone_tenant_contact CHECK (
            timezone IS NULL OR timezone ~ '^[A-Za-z_/]+$'
          )
        )`,

        // 4. Crear índices para tenant_contacts
        `CREATE INDEX IF NOT EXISTS idx_tenant_contacts_tenant_id ON tenant_contacts(tenant_id)`,
        `CREATE INDEX IF NOT EXISTS idx_tenant_contacts_profile_id ON tenant_contacts(contact_profile_id)`,
        `CREATE INDEX IF NOT EXISTS idx_tenant_contacts_name ON tenant_contacts(tenant_id, name)`,
        `CREATE INDEX IF NOT EXISTS idx_tenant_contacts_preferred_channel ON tenant_contacts(tenant_id, preferred_channel)`,

        // 5. Agregar columnas a tablas existentes
        `ALTER TABLE agreements ADD COLUMN IF NOT EXISTS tenant_contact_id UUID`,
        `ALTER TABLE messages ADD COLUMN IF NOT EXISTS tenant_contact_id UUID`
      ];

      // Ejecutar todos los steps de creación
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

      // Migración de datos - usando queries directas
      console.log('📝 Migrando datos...');

      // Obtener contacts existentes
      const { data: existingContacts, error: contactsError } = await supabase
        .from('contacts')
        .select('*')
        .not('telegram_id', 'is', null);

      if (contactsError) {
        console.error('Error obteniendo contacts:', contactsError);
        return new Response(JSON.stringify({ success: false, error: contactsError.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`Found ${existingContacts.length} contacts with Telegram ID`);

      // Migrar contacts a contact_profiles y tenant_contacts
      for (const contact of existingContacts) {
        try {
          // 1. Crear o encontrar contact_profile
          const { data: existingProfile, error: profileError } = await supabase
            .from('contact_profiles')
            .select('*')
            .eq('telegram_id', contact.telegram_id)
            .maybeSingle();

          let contactProfile = existingProfile;

          if (!contactProfile) {
            const { data: newProfile, error: createProfileError } = await supabase
              .from('contact_profiles')
              .insert({
                phone_e164: (contact.phone_e164 && contact.phone_e164 !== '+000000000000') ? contact.phone_e164 : null,
                telegram_id: contact.telegram_id,
                telegram_username: contact.telegram_username,
                telegram_first_name: contact.telegram_first_name,
                telegram_last_name: contact.telegram_last_name
              })
              .select()
              .single();

            if (createProfileError) {
              console.log('Error creating profile for contact:', contact.id, createProfileError.message);
              continue;
            }
            contactProfile = newProfile;
          }

          // 2. Crear tenant_contact
          const { error: tenantContactError } = await supabase
            .from('tenant_contacts')
            .insert({
              tenant_id: contact.tenant_id,
              contact_profile_id: contactProfile.id,
              name: contact.name,
              preferred_channel: contact.preferred_channel || 'telegram',
              whatsapp_id: contact.whatsapp_id,
              opt_in_status: contact.opt_in_status,
              opt_in_date: contact.opt_in_date,
              opt_out_date: contact.opt_out_date,
              telegram_opt_in_status: contact.telegram_opt_in_status || 'pending',
              timezone: contact.timezone,
              preferred_language: contact.preferred_language,
              metadata: contact.metadata,
              created_at: contact.created_at,
              updated_at: contact.updated_at
            });

          if (tenantContactError) {
            console.log('Error creating tenant_contact for:', contact.id, tenantContactError.message);
          } else {
            console.log('✅ Migrated contact:', contact.name);
          }

        } catch (err) {
          console.log('Error processing contact:', contact.id, err);
        }
      }

      console.log('🎉 Migración 014 completada!');

      return new Response(JSON.stringify({
        success: true,
        message: 'Migration 014 completed successfully',
        contacts_migrated: existingContacts.length
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