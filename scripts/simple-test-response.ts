#!/usr/bin/env -S deno run --allow-net --allow-env

// Script simple para probar si el bot responde

const supabaseUrl = Deno.env.get('SUPABASE_URL');

async function testBotResponse() {
  console.log('🤖 Probando respuesta del bot...\n');

  const webhookUrl = `${supabaseUrl}/functions/v1/wa_webhook`;
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

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
            profile: { name: "Test Response" },
            wa_id: "56964943476"
          }],
          messages: [{
            from: "56964943476",
            id: `test_response_${Date.now()}`,
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
    console.log('📤 Enviando "hola" al bot...');

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testMessage)
    });

    const result = await response.text();

    console.log(`📥 Status: ${response.status}`);
    console.log(`📄 Response: ${result}`);

    if (response.ok) {
      console.log('\n✅ El webhook procesó el mensaje exitosamente');
      console.log('📱 Revisa tu WhatsApp para ver si llegó la respuesta del bot');
      console.log('\n💡 Si no recibes respuesta, el problema puede ser:');
      console.log('   • Las variables de entorno en Supabase Edge Functions');
      console.log('   • La configuración del tenant en la base de datos');
      console.log('   • La ventana de 24 horas de WhatsApp');
    } else {
      console.error('❌ Error en el webhook');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

if (import.meta.main) {
  await testBotResponse();
}