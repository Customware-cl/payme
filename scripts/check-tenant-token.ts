#!/usr/bin/env -S deno run --allow-net --allow-env

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = 'https://qgjxkszfdoolaxmsupil.supabase.co';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseKey) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY no está configurada');
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 Verificando token de WhatsApp del tenant...\n');

const tenantId = 'd4c43ab8-426f-4bb9-8736-dfe301459590';

const { data: tenant, error } = await supabase
  .from('tenants')
  .select('*')
  .eq('id', tenantId)
  .single();

if (error) {
  console.error('❌ Error:', error.message);
  Deno.exit(1);
}

console.log('📋 Configuración del tenant:');
console.log(`   Nombre: ${tenant.name}`);
console.log(`   Phone Number ID: ${tenant.whatsapp_phone_number_id}`);
console.log(`   Business Account ID: ${tenant.whatsapp_business_account_id}`);
console.log(`   Access Token: ${tenant.whatsapp_access_token ? '✅ Configurado' : '❌ NO configurado'}`);

if (!tenant.whatsapp_access_token) {
  console.log('\n⚠️  El access token NO está configurado en el tenant');
  console.log('   El WhatsAppWindowManager no puede enviar mensajes');
  console.log('\n💡 Solución: Actualizar el tenant con el access token');
}