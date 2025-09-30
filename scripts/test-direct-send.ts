#!/usr/bin/env -S deno run --allow-net --allow-env

// Prueba de envío directo usando la API de WhatsApp

const accessToken = 'EAFU9IECsZBf0BPs3c8aSJMbaXD9ifT9TAwRGnGHjQiywCZA58APUJupIhZBlMTmeEf1BCKTk7NOPOP0ZAT1YeZAL86Og0W3ime6bTLmmZAmf7OedCiZCrGGbxJSAsmoGNp4jY3sLpaFVr4QA9Rr5C9R7KqoTiIZCNAG2ttQvZA24rNXqkvr6AprgkgGDFB8zWulQ9AwZDZD';
const phoneNumberId = '778143428720890';
const recipientPhone = '+56964943476';

console.log('🧪 Probando envío directo a WhatsApp API...\n');

const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

const message = {
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to: recipientPhone,
  type: 'text',
  text: {
    preview_url: false,
    body: '🤖 Mensaje de prueba directo desde el script.\n\nSi recibes esto, significa que las credenciales de WhatsApp están funcionando correctamente.'
  }
};

try {
  console.log('📤 Enviando mensaje a:', recipientPhone);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message)
  });

  const responseData = await response.json();

  if (!response.ok) {
    console.error('❌ Error en la API de WhatsApp:');
    console.error('   Status:', response.status);
    console.error('   Error:', JSON.stringify(responseData, null, 2));

    if (responseData.error?.code === 190) {
      console.log('\n⚠️  Token de acceso expirado o inválido');
      console.log('   Necesitas generar un nuevo token en Meta Business Manager');
    }

    Deno.exit(1);
  }

  console.log('\n✅ Mensaje enviado exitosamente!');
  console.log('   Message ID:', responseData.messages[0].id);
  console.log('\n📱 Revisa tu WhatsApp ahora');

} catch (error) {
  console.error('❌ Error:', error.message);
  Deno.exit(1);
}