#!/usr/bin/env -S deno run --allow-net --allow-env

// Script para cambiar al número real de Chile

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

async function switchToRealNumber() {
  console.log('🇨🇱 Cambiando al número real de Chile...\n');

  const realPhoneNumberId = '800417573154479';
  const testPhoneNumberId = '778143428720890';

  try {
    // Actualizar tenant para usar el número real
    console.log('🔄 Actualizando tenant al número real...');

    const updateResponse = await fetch(`${supabaseUrl}/rest/v1/tenants?whatsapp_phone_number_id=eq.${testPhoneNumberId}`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        whatsapp_phone_number_id: realPhoneNumberId
      })
    });

    if (updateResponse.ok) {
      const result = await updateResponse.json();
      console.log('✅ Tenant actualizado al número real de Chile');
      console.log(`   Phone Number ID: ${result[0].whatsapp_phone_number_id}`);
      console.log('   Número real: +56 9 7260 3543');
    } else {
      const error = await updateResponse.text();
      console.log(`❌ Error: ${error}`);
      return false;
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }

  return true;
}

async function updateEnvFile() {
  console.log('\n📝 IMPORTANTE: Actualizar archivo .env\n');

  console.log('Cambia en tu archivo .env:');
  console.log('');
  console.log('❌ ACTUAL:');
  console.log('WHATSAPP_PHONE_NUMBER_ID=778143428720890');
  console.log('');
  console.log('✅ NUEVO:');
  console.log('WHATSAPP_PHONE_NUMBER_ID=800417573154479');
  console.log('');
  console.log('Esto cambiará del número de prueba (15556305570) al número real (+56 9 7260 3543)');
}

async function testWithRealNumber() {
  console.log('\n🧪 Probando con número real...\n');

  const webhookUrl = `${supabaseUrl}/functions/v1/wa_webhook`;
  const realPhoneNumberId = '800417573154479';

  const testMessage = {
    object: "whatsapp_business_account",
    entry: [{
      id: "WHATSAPP_BUSINESS_ACCOUNT_ID",
      changes: [{
        value: {
          messaging_product: "whatsapp",
          metadata: {
            display_phone_number: "+56 9 7260 3543",
            phone_number_id: realPhoneNumberId
          },
          contacts: [{
            profile: { name: "Test Real" },
            wa_id: "56964943476"
          }],
          messages: [{
            from: "56964943476",
            id: `test_real_${Date.now()}`,
            timestamp: Math.floor(Date.now() / 1000).toString(),
            text: { body: "hola real" },
            type: "text"
          }]
        },
        field: "messages"
      }]
    }]
  };

  try {
    console.log('📤 Probando con número real de Chile...');

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testMessage)
    });

    const result = await response.text();
    console.log(`📥 Status: ${response.status}`);

    if (response.ok) {
      console.log('✅ ¡Webhook procesó con número real!');
      console.log('\n📱 Después de actualizar el .env, prueba desde tu WhatsApp');
    } else {
      console.log(`❌ Error: ${result}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Ejecutar
if (import.meta.main) {
  const success = await switchToRealNumber();

  if (success) {
    await updateEnvFile();
    await testWithRealNumber();

    console.log('\n🎯 PRÓXIMOS PASOS:');
    console.log('1. Actualiza WHATSAPP_PHONE_NUMBER_ID=800417573154479 en .env');
    console.log('2. Actualiza también en Supabase Edge Functions');
    console.log('3. Prueba escribiendo "hola" desde tu WhatsApp');
  }
}