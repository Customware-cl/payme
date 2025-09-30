#!/usr/bin/env -S deno run --allow-net --allow-env

// Script para actualizar SOLO el access token del tenant

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

async function updateTenantToken() {
  console.log('🔑 Actualizando access token del tenant...\n');

  try {
    // Buscar el tenant
    const response = await fetch(`${supabaseUrl}/rest/v1/tenants?whatsapp_phone_number_id=eq.${phoneNumberId}&select=id,name`, {
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      }
    });

    const tenants = await response.json();

    if (!tenants || tenants.length === 0) {
      console.error('❌ No se encontró tenant');
      return false;
    }

    const tenant = tenants[0];
    console.log(`✅ Tenant encontrado: ${tenant.name} (${tenant.id})`);

    // Actualizar SOLO el access token
    const updateResponse = await fetch(`${supabaseUrl}/rest/v1/tenants?id=eq.${tenant.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        whatsapp_access_token: accessToken
      })
    });

    if (updateResponse.ok) {
      const result = await updateResponse.json();
      console.log('✅ Access token actualizado exitosamente');

      // Mostrar solo los primeros caracteres del token por seguridad
      const tokenPreview = result[0].whatsapp_access_token.substring(0, 20) + '...';
      console.log(`   Nuevo token: ${tokenPreview}`);

      return true;
    } else {
      const error = await updateResponse.text();
      console.error('❌ Error actualizando token:', error);
      return false;
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

async function testAfterUpdate() {
  console.log('\n🧪 Probando bot después de actualizar token...\n');

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
            profile: { name: "Test Final" },
            wa_id: "56964943476"
          }],
          messages: [{
            from: "56964943476",
            id: `test_final_${Date.now()}`,
            timestamp: Math.floor(Date.now() / 1000).toString(),
            text: { body: "hola final" },
            type: "text"
          }]
        },
        field: "messages"
      }]
    }]
  };

  try {
    console.log('📤 Enviando mensaje de prueba final...');

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testMessage)
    });

    const result = await response.text();
    console.log(`📥 Status: ${response.status}`);

    if (response.ok) {
      console.log('✅ ¡Mensaje procesado exitosamente!');
      console.log('\n🎉 AHORA REVISA TU WHATSAPP - EL BOT DEBERÍA RESPONDER! 📱');
    } else {
      console.error(`❌ Error: ${result}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Ejecutar
if (import.meta.main) {
  const success = await updateTenantToken();

  if (success) {
    await testAfterUpdate();
  }
}