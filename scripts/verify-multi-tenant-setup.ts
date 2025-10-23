#!/usr/bin/env -S deno run --allow-env --allow-net --allow-read

/**
 * Script de verificación para configuración multi-tenant
 *
 * Este script verifica que:
 * 1. Los tenants tienen tokens configurados correctamente
 * 2. No hay duplicados de phone_number_id
 * 3. Los tokens son válidos y no han expirado
 * 4. La configuración está lista para multi-tenant
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// Cargar variables de entorno
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridas');
  console.log('💡 Crea un archivo .env con estas variables');
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🔍 VERIFICACIÓN DE CONFIGURACIÓN MULTI-TENANT\n');
console.log('='.repeat(60));

// 1. Verificar tenants existentes
console.log('\n📊 1. TENANTS CONFIGURADOS:\n');

const { data: tenants, error: tenantsError } = await supabase
  .from('tenants')
  .select('id, name, whatsapp_phone_number_id, whatsapp_access_token, whatsapp_business_account_id, created_at')
  .order('created_at', { ascending: true });

if (tenantsError) {
  console.error('❌ Error al obtener tenants:', tenantsError.message);
  Deno.exit(1);
}

if (!tenants || tenants.length === 0) {
  console.log('⚠️  No hay tenants configurados');
  console.log('💡 Usa el script setup-new-tenant.sql para crear uno');
  Deno.exit(1);
}

let hasIssues = false;

tenants.forEach((tenant, index) => {
  console.log(`\nTenant ${index + 1}:`);
  console.log(`  Nombre: ${tenant.name}`);
  console.log(`  ID: ${tenant.id}`);
  console.log(`  Phone Number ID: ${tenant.whatsapp_phone_number_id || '❌ NO CONFIGURADO'}`);
  console.log(`  WABA ID: ${tenant.whatsapp_business_account_id || '⚠️  No configurado'}`);

  // Verificar token
  if (!tenant.whatsapp_access_token) {
    console.log(`  Token: ❌ NO CONFIGURADO`);
    hasIssues = true;
  } else if (tenant.whatsapp_access_token.trim() === '') {
    console.log(`  Token: ❌ VACÍO`);
    hasIssues = true;
  } else {
    const tokenLength = tenant.whatsapp_access_token.length;
    const tokenPreview = tenant.whatsapp_access_token.substring(0, 20) + '...';
    console.log(`  Token: ✅ Configurado (${tokenLength} chars)`);
    console.log(`  Token preview: ${tokenPreview}`);
  }

  console.log(`  Creado: ${new Date(tenant.created_at).toLocaleString()}`);
});

// 2. Verificar duplicados de phone_number_id
console.log('\n' + '='.repeat(60));
console.log('\n🔍 2. VERIFICACIÓN DE DUPLICADOS:\n');

const { data: duplicates } = await supabase
  .rpc('check_duplicate_phone_numbers', {});

// Si no existe la función, hacer la verificación manualmente
const phoneNumbers = tenants
  .filter(t => t.whatsapp_phone_number_id)
  .map(t => t.whatsapp_phone_number_id);

const duplicatePhones = phoneNumbers.filter((item, index) => phoneNumbers.indexOf(item) !== index);

if (duplicatePhones.length > 0) {
  console.log('❌ DUPLICADOS ENCONTRADOS:');
  duplicatePhones.forEach(phone => {
    const duplicateTenants = tenants.filter(t => t.whatsapp_phone_number_id === phone);
    console.log(`\n  Phone Number ID: ${phone}`);
    console.log(`  Tenants afectados:`);
    duplicateTenants.forEach(t => console.log(`    - ${t.name} (${t.id})`));
  });
  hasIssues = true;
} else {
  console.log('✅ No hay phone_number_id duplicados');
}

// 3. Verificar que los tokens funcionan (opcional, requiere conectividad)
console.log('\n' + '='.repeat(60));
console.log('\n🔐 3. VERIFICACIÓN DE TOKENS (META API):\n');

for (const tenant of tenants) {
  if (!tenant.whatsapp_access_token || !tenant.whatsapp_phone_number_id) {
    console.log(`⏭️  Saltando ${tenant.name} (token o phone_number_id no configurado)`);
    continue;
  }

  try {
    // Verificar token consultando el phone number en Meta API
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${tenant.whatsapp_phone_number_id}?fields=verified_name,code_verification_status`,
      {
        headers: {
          'Authorization': `Bearer ${tenant.whatsapp_access_token}`
        }
      }
    );

    const result = await response.json();

    if (response.ok) {
      console.log(`✅ ${tenant.name}:`);
      console.log(`   Número verificado: ${result.verified_name || 'N/A'}`);
      console.log(`   Estado: ${result.code_verification_status || 'N/A'}`);
    } else {
      console.log(`❌ ${tenant.name}:`);
      console.log(`   Error: ${result.error?.message || 'Token inválido o expirado'}`);
      console.log(`   Código: ${result.error?.code || 'N/A'}`);
      hasIssues = true;
    }
  } catch (error) {
    console.log(`❌ ${tenant.name}:`);
    console.log(`   Error de red: ${error.message}`);
    hasIssues = true;
  }
}

// 4. Verificar que los contactos están correctamente asociados
console.log('\n' + '='.repeat(60));
console.log('\n👥 4. VERIFICACIÓN DE CONTACTOS:\n');

for (const tenant of tenants) {
  const { count, error } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenant.id);

  if (error) {
    console.log(`❌ ${tenant.name}: Error al contar contactos`);
    hasIssues = true;
  } else {
    console.log(`${tenant.name}: ${count || 0} contactos`);
  }
}

// 5. Verificar variables de entorno (para compatibilidad)
console.log('\n' + '='.repeat(60));
console.log('\n⚙️  5. VARIABLES DE ENTORNO (FALLBACK):\n');

const envToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
const envPhoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

if (envToken) {
  console.log(`✅ WHATSAPP_ACCESS_TOKEN configurado (fallback disponible)`);
  console.log(`   Preview: ${envToken.substring(0, 20)}...`);
} else {
  console.log(`⚠️  WHATSAPP_ACCESS_TOKEN no configurado en .env`);
  console.log(`   Nota: Si todos los tenants tienen token, esto es opcional`);
}

if (envPhoneId) {
  console.log(`✅ WHATSAPP_PHONE_NUMBER_ID: ${envPhoneId}`);
} else {
  console.log(`⚠️  WHATSAPP_PHONE_NUMBER_ID no configurado en .env`);
}

// RESUMEN FINAL
console.log('\n' + '='.repeat(60));
console.log('\n📋 RESUMEN:\n');

if (hasIssues) {
  console.log('❌ SE ENCONTRARON PROBLEMAS');
  console.log('\n💡 Acciones recomendadas:');
  console.log('   1. Configura los tokens faltantes en la tabla tenants');
  console.log('   2. Elimina o corrige los phone_number_id duplicados');
  console.log('   3. Verifica que los tokens sean permanentes (System User)');
  console.log('   4. Ejecuta este script nuevamente para verificar');
  console.log('\n📚 Ver: scripts/setup-new-tenant.sql para más información');
  Deno.exit(1);
} else {
  console.log('✅ CONFIGURACIÓN CORRECTA - LISTA PARA MULTI-TENANT');
  console.log('\n🎉 Todos los tenants están configurados correctamente');
  console.log('✅ Los tokens son válidos');
  console.log('✅ No hay configuraciones duplicadas');
  console.log('\n📝 Próximos pasos:');
  console.log('   1. Despliega los cambios: npm run deploy');
  console.log('   2. Prueba enviando mensajes desde ambos números');
  console.log('   3. Verifica los logs para confirmar que usa el token correcto');
  Deno.exit(0);
}
