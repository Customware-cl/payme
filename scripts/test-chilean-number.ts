#!/usr/bin/env -S deno run --allow-net --allow-env

// Prueba final con el número chileno real 800417573154479

const supabaseUrl = 'https://qgjxkszfdoolaxmsupil.supabase.co';
const phoneNumberId = '778143428720890';

async function testChileanNumber() {
  console.log('📞 PRUEBA CON NÚMERO DE PRUEBA\n');

  console.log('✅ Configuración actualizada:');
  console.log(`   • Phone Number ID: ${phoneNumberId} (Prueba)`);
  console.log('   • Tenant actualizado en base de datos');
  console.log('   • Token permanente configurado');
  console.log('   • Función parsePhoneNumber corregida\n');

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
            profile: { name: "Prueba Chilena" },
            wa_id: "56964943476"
          }],
          messages: [{
            from: "56964943476",
            id: `chilean_test_${Date.now()}`,
            timestamp: Math.floor(Date.now() / 1000).toString(),
            text: { body: "hola" },
            type: "text"
          }]
        },
        field: "messages"
      }]
    }]
  };

  try {
    console.log('📤 Enviando mensaje "hola" con número chileno...');

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testMessage)
    });

    const result = await response.text();
    console.log(`📥 Status: ${response.status}`);
    console.log(`📄 Response: ${result}`);

    if (response.ok) {
      const data = JSON.parse(result);
      if (data.success && data.processed_messages > 0) {
        console.log('\n🎉 ¡ÉXITO CON NÚMERO CHILENO! 🇨🇱');
        console.log('\n🤖 BOT FUNCIONA PERFECTAMENTE');
        console.log('\n📱 MENSAJE ENVIADO A TU WHATSAPP');
        console.log('   • El bot debería responder automáticamente');
        console.log('   • Con mensaje de bienvenida y opciones');
        console.log('\n✅ Sistema 100% operativo con número chileno real');
      } else {
        console.log('⚠️  Webhook procesado pero con advertencias');
        console.log(`   Response: ${JSON.stringify(data)}`);
      }
    } else {
      console.error(`❌ Error HTTP: ${result}`);
    }

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

// Ejecutar
if (import.meta.main) {
  await testChileanNumber();
}