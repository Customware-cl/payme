#!/usr/bin/env -S deno run --allow-net --allow-env

// Script para probar el webhook de WhatsApp con un mensaje entrante simulado

const webhookUrl = 'https://qgjxkszfdoolaxmsupil.supabase.co/functions/v1/wa_webhook';

// Payload de ejemplo de WhatsApp cuando un usuario envía un mensaje
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
                wa_id: '56964943476'
              }
            ],
            messages: [
              {
                from: '56964943476',
                id: 'wamid.TEST123',
                timestamp: Math.floor(Date.now() / 1000).toString(),
                type: 'text',
                text: {
                  body: 'hola'
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

console.log('🧪 Probando webhook de WhatsApp...\n');
console.log('📤 Enviando mensaje de prueba al webhook...');
console.log('   URL:', webhookUrl);
console.log('   Mensaje:', 'hola');
console.log('');

try {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(testPayload)
  });

  const status = response.status;
  const responseText = await response.text();

  console.log('📥 Respuesta del webhook:');
  console.log(`   Status: ${status} ${status === 200 ? '✅' : '❌'}`);
  console.log(`   Respuesta:`, responseText);

  if (status === 200) {
    console.log('\n✅ Webhook funcionando correctamente');
    console.log('   El bot debería haber procesado el mensaje y respondido');
  } else {
    console.log('\n❌ Error en el webhook');
    console.log('   Verifica los logs en el dashboard de Supabase');
  }

} catch (error) {
  console.error('❌ Error al llamar al webhook:', error.message);
  Deno.exit(1);
}