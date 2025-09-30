#!/usr/bin/env -S deno run --allow-net --allow-env

// Script para simular un mensaje real del usuario y ver la respuesta del webhook

const webhookUrl = 'https://qgjxkszfdoolaxmsupil.supabase.co/functions/v1/wa_webhook';

// Número del usuario que está escribiendo
const userPhone = Deno.args[0] || '56964943476';
const messageText = Deno.args[1] || 'hola';

// Payload exacto como lo envía Meta
const testPayload = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '773972555504544',
      changes: [
        {
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '56964943476',
              phone_number_id: '778143428720890'
            },
            contacts: [
              {
                profile: {
                  name: 'Usuario Test'
                },
                wa_id: userPhone
              }
            ],
            messages: [
              {
                from: userPhone,
                id: `wamid.TEST_${Date.now()}`,
                timestamp: Math.floor(Date.now() / 1000).toString(),
                type: 'text',
                text: {
                  body: messageText
                }
              }
            ]
          },
          field: 'messages'
        }
      ]
    }
  ]
};

console.log('🧪 Simulando mensaje real de WhatsApp...\n');
console.log(`   De: +${userPhone}`);
console.log(`   Mensaje: "${messageText}"`);
console.log('');

try {
  const start = Date.now();

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(testPayload)
  });

  const elapsed = Date.now() - start;
  const responseText = await response.text();

  console.log(`📥 Respuesta del webhook (${elapsed}ms):`);
  console.log(`   Status: ${response.status} ${response.status === 200 ? '✅' : '❌'}`);

  try {
    const responseJson = JSON.parse(responseText);
    console.log(`   Respuesta:`, JSON.stringify(responseJson, null, 2));
  } catch {
    console.log(`   Respuesta (raw):`, responseText);
  }

  if (response.status === 200) {
    console.log('\n✅ Webhook procesó el mensaje');
    console.log('\n💡 Ahora verifica si te llegó una respuesta al WhatsApp');
    console.log('   Si no llegó, el problema está en el envío desde el webhook');
  } else {
    console.log('\n❌ El webhook falló al procesar');
  }

} catch (error) {
  console.error('❌ Error:', error.message);
  Deno.exit(1);
}