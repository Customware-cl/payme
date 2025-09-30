#!/usr/bin/env -S deno run --allow-net --allow-env

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://qgjxkszfdoolaxmsupil.supabase.co';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseKey) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY no está configurada');
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔧 Activando tenant...\n');

const tenantId = 'd4c43ab8-426f-4bb9-8736-dfe301459590';

const { data, error } = await supabase
  .from('tenants')
  .update({ is_active: true })
  .eq('id', tenantId)
  .select()
  .single();

if (error) {
  console.error('❌ Error al activar tenant:', error.message);
  Deno.exit(1);
}

console.log('✅ Tenant activado exitosamente:');
console.log(`   ID: ${data.id}`);
console.log(`   Nombre: ${data.name}`);
console.log(`   Estado: ${data.is_active ? '🟢 ACTIVO' : '🔴 INACTIVO'}`);
console.log('\n✅ El bot ahora puede procesar mensajes');