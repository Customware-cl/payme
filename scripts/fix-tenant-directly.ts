#!/usr/bin/env -S deno run --allow-net --allow-env

// Script para actualizar directamente las credenciales del tenant

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
const businessAccountId = Deno.env.get('WHATSAPP_BUSINESS_ACCOUNT_ID');

async function listAllTenants() {
  console.log('📋 Listando todos los tenants...\n');

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/tenants?select=*`, {
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      }
    });

    const tenants = await response.json();

    console.log(`✅ Encontrados ${tenants.length} tenants:`);
    tenants.forEach((tenant: any, index: number) => {
      console.log(`   ${index + 1}. ${tenant.name || 'Sin nombre'}`);
      console.log(`      ID: ${tenant.id}`);
      console.log(`      Phone Number ID: ${tenant.whatsapp_phone_number_id || 'N/A'}`);
      console.log(`      Access Token: ${tenant.whatsapp_access_token ? '✅ Configurado' : '❌ Faltante'}`);
      console.log('');
    });

    return tenants;
  } catch (error) {
    console.error('❌ Error listando tenants:', error.message);
    return [];
  }
}

async function updateTenantById(tenantId: string) {
  console.log(`🔧 Actualizando tenant ${tenantId}...\n`);

  const updateData = {
    whatsapp_access_token: accessToken,
    whatsapp_phone_number_id: phoneNumberId,
    whatsapp_business_account_id: businessAccountId,
    status: 'active'
  };

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/tenants?id=eq.${tenantId}`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(updateData)
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Tenant actualizado exitosamente:');
      console.log(`   Access Token: ${result[0].whatsapp_access_token ? '✅ Configurado' : '❌ Error'}`);
      console.log(`   Phone Number ID: ${result[0].whatsapp_phone_number_id}`);
      console.log(`   Business Account ID: ${result[0].whatsapp_business_account_id || 'N/A'}`);
      console.log(`   Estado: ${result[0].status}`);
      return true;
    } else {
      const error = await response.text();
      console.error('❌ Error actualizando:', error);
      return false;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

async function testWebhookAfterFix() {
  console.log('\n🧪 Probando webhook después del fix...\n');

  const webhookUrl = `${supabaseUrl}/functions/v1/wa_webhook`;

  const testMessage = {
    object: "whatsapp_business_account",
    entry: [{
      id: "WHATSAPP_BUSINESS_ACCOUNT_ID",
      changes: [{
        value: {
          messaging_product: "whatsapp",
          metadata: {
            display_phone_number: "15556305570",
            phone_number_id: phoneNumberId
          },
          contacts: [{
            profile: { name: "Test Fix" },
            wa_id: "56964943476"
          }],
          messages: [{
            from: "56964943476",
            id: `test_fix_${Date.now()}`,
            timestamp: Math.floor(Date.now() / 1000).toString(),
            text: { body: "hola bot" },
            type: "text"
          }]
        },
        field: "messages"
      }]
    }]
  };

  try {
    console.log('📤 Enviando mensaje "hola bot" al webhook...');

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testMessage)
    });

    const result = await response.text();
    console.log(`📥 Respuesta: ${response.status} - ${result}`);

    if (response.ok) {
      console.log('✅ ¡Mensaje procesado! Revisa tu WhatsApp 📱');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Ejecutar
if (import.meta.main) {
  console.log('🔧 Reparando configuración del tenant...\n');

  const tenants = await listAllTenants();

  if (tenants.length > 0) {
    // Actualizar el primer tenant (debería ser el único)
    const success = await updateTenantById(tenants[0].id);

    if (success) {
      await testWebhookAfterFix();
    }
  } else {
    console.error('❌ No se encontraron tenants');
  }
}