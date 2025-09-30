#!/usr/bin/env -S deno run --allow-net --allow-env

// Prueba específica del comando "hola"

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

async function testHolaCommand() {
  console.log('👋 PROBANDO COMANDO "HOLA" - DESPUES DE LA CORRECCIÓN\n');

  const webhookUrl = `${supabaseUrl}/functions/v1/wa_webhook`;

  const holaMessage = {
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
            profile: { name: "Test Hola" },
            wa_id: "56964943476"
          }],
          messages: [{
            from: "56964943476",
            id: `test_hola_${Date.now()}`,
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
    console.log('📤 Enviando "hola" (simple) al bot...');

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(holaMessage)
    });

    const result = await response.text();
    console.log(`📥 Status HTTP: ${response.status}`);
    console.log(`📄 Response: ${result}`);

    if (response.ok) {
      const data = JSON.parse(result);
      if (data.success) {
        console.log('\n✅ ¡WEBHOOK PROCESÓ "HOLA" EXITOSAMENTE!');
        console.log('\n📱 AHORA DEBERÍAS RECIBIR EN WHATSAPP:');
        console.log('   "¡Hola! 👋 Soy tu asistente de recordatorios..."');
        console.log('   (Mensaje de bienvenida con opciones)');
        console.log('\n🚫 NO DEBERÍAS VER:');
        console.log('   "No se pudo crear el estado de conversación"');
      }
    } else {
      console.error('❌ Error en webhook');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Ejecutar
if (import.meta.main) {
  await testHolaCommand();
}