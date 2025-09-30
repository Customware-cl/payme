#!/usr/bin/env -S deno run --allow-net --allow-env

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://qgjxkszfdoolaxmsupil.supabase.co';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseKey) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY no está configurada');
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 Verificando configuración del tenant...\n');

// Buscar tenant por phone_number_id
const phoneNumberId = '778143428720890';
const { data: tenant, error } = await supabase
  .from('tenants')
  .select('*')
  .eq('whatsapp_phone_number_id', phoneNumberId)
  .single();

if (error) {
  console.error('❌ Error al buscar tenant:', error.message);

  if (error.code === 'PGRST116') {
    console.log('\n⚠️  No existe un tenant con el phone_number_id:', phoneNumberId);
    console.log('\n📝 Necesitas crear un tenant. Ejemplo:');
    console.log(`
INSERT INTO tenants (name, whatsapp_phone_number_id, whatsapp_business_account_id, timezone, settings)
VALUES (
  'Mi Negocio',
  '778143428720890',
  '773972555504544',
  'America/Santiago',
  '{}'
);
    `);
  }
  Deno.exit(1);
}

console.log('✅ Tenant encontrado:');
console.log(`   ID: ${tenant.id}`);
console.log(`   Nombre: ${tenant.name}`);
console.log(`   Phone Number ID: ${tenant.whatsapp_phone_number_id}`);
console.log(`   Business Account ID: ${tenant.whatsapp_business_account_id}`);
console.log(`   Timezone: ${tenant.timezone}`);
console.log('');

// Contar contactos
const { count: contactCount } = await supabase
  .from('contacts')
  .select('*', { count: 'exact', head: true })
  .eq('tenant_id', tenant.id);

console.log(`📇 Contactos registrados: ${contactCount || 0}`);

// Contar agreements
const { count: agreementCount } = await supabase
  .from('agreements')
  .select('*', { count: 'exact', head: true })
  .eq('tenant_id', tenant.id);

console.log(`📋 Acuerdos registrados: ${agreementCount || 0}`);

console.log('\n✅ Configuración del bot completa y lista para usar');