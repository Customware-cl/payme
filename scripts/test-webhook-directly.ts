#!/usr/bin/env -S deno run --allow-net --allow-env

// Script para probar el webhook directamente y ver por qué no responde

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Variables de entorno de Supabase no encontradas');
  Deno.exit(1);
}

async function testWebhookWithMessage() {
  console.log('🔗 Probando webhook con mensaje simulado...\n');

  const webhookUrl = `${supabaseUrl}/functions/v1/wa_webhook`;

  // Simular un mensaje entrante desde WhatsApp
  const testMessage = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WHATSAPP_BUSINESS_ACCOUNT_ID",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "15556305570",
                phone_number_id: "778143428720890"
              },
              contacts: [
                {
                  profile: {
                    name: "Usuario Test"
                  },
                  wa_id: "56964943476"
                }
              ],
              messages: [
                {
                  from: "56964943476",
                  id: `test_${Date.now()}`,
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  text: {
                    body: "hola"
                  },
                  type: "text"
                }
              ]
            },
            field: "messages"
          }
        ]
      }
    ]
  };

  try {
    console.log('📤 Enviando mensaje de prueba al webhook...');
    console.log('URL:', webhookUrl);
    console.log('Payload:', JSON.stringify(testMessage, null, 2));
    console.log('');

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WhatsApp/Test'
      },
      body: JSON.stringify(testMessage)
    });

    const responseText = await response.text();

    console.log('📥 Respuesta del webhook:');
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Headers:`, Object.fromEntries(response.headers.entries()));
    console.log(`   Body: ${responseText}`);

    if (response.ok) {
      console.log('✅ Webhook procesó el mensaje exitosamente');

      try {
        const responseData = JSON.parse(responseText);
        console.log('   Datos de respuesta:', responseData);
      } catch (e) {
        console.log('   (Respuesta no es JSON válido)');
      }
    } else {
      console.error('❌ Error en el webhook');
    }

  } catch (error) {
    console.error('❌ Error al probar webhook:', error.message);
  }
}

async function checkSupabaseLogs() {
  console.log('\n📊 Verificando logs recientes en Supabase...\n');

  try {
    // No podemos acceder directamente a los logs de Edge Functions desde el REST API
    // Pero podemos verificar si los mensajes están llegando

    const response = await fetch(`${supabaseUrl}/rest/v1/whatsapp_messages?select=*&order=created_at.desc&limit=5`, {
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      }
    });

    const messages = await response.json();

    console.log('📨 Últimos 5 mensajes en la BD:');
    messages.forEach((msg: any, index: number) => {
      console.log(`   ${index + 1}. [${msg.direction}] ${msg.message_type} - ${new Date(msg.created_at).toLocaleString()}`);
      if (msg.content?.text?.body) {
        console.log(`      Contenido: "${msg.content.text.body}"`);
      }
      console.log(`      Estado: ${msg.status || 'N/A'}`);
    });

  } catch (error) {
    console.error('❌ Error verificando mensajes:', error.message);
  }
}

async function checkTenantConfig() {
  console.log('\n🏢 Verificando configuración completa del tenant...\n');

  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/tenants?whatsapp_phone_number_id=eq.${phoneNumberId}&select=*`, {
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      }
    });

    const tenants = await response.json();

    if (tenants && tenants.length > 0) {
      const tenant = tenants[0];
      console.log('✅ Configuración del tenant:');
      console.log(`   ID: ${tenant.id}`);
      console.log(`   Nombre: ${tenant.name}`);
      console.log(`   WhatsApp Access Token: ${tenant.whatsapp_access_token ? '✅ Configurado' : '❌ Faltante'}`);
      console.log(`   WhatsApp Phone Number ID: ${tenant.whatsapp_phone_number_id}`);
      console.log(`   Estado: ${tenant.status || 'N/A'}`);
      console.log(`   Configuración: ${JSON.stringify(tenant.configuration || {}, null, 2)}`);

      return tenant;
    } else {
      console.error('❌ No se encontró tenant para este Phone Number ID');
      return null;
    }
  } catch (error) {
    console.error('❌ Error verificando tenant:', error.message);
    return null;
  }
}

async function testSimpleMessage() {
  console.log('\n📱 Enviando mensaje simple de prueba...\n');

  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');

  if (!phoneNumberId || !accessToken) {
    console.error('❌ Variables de WhatsApp no configuradas');
    return;
  }

  try {
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

    const message = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '+56964943476',
      type: 'text',
      text: {
        preview_url: false,
        body: '🤖 Mensaje de prueba directo - ¿Puedes recibirlo? Responde con "sí" para confirmar.'
      }
    };

    console.log('📤 Enviando mensaje directo...');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Mensaje directo enviado exitosamente');
      console.log(`   ID: ${result.messages[0].id}`);
    } else {
      console.error('❌ Error enviando mensaje directo:', result);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Ejecutar todas las verificaciones
if (import.meta.main) {
  console.log('🔍 Diagnosticando problema de respuesta del bot...\n');

  await testWebhookWithMessage();

  await checkSupabaseLogs();

  await checkTenantConfig();

  await testSimpleMessage();

  console.log('\n📋 DIAGNÓSTICO COMPLETADO');
  console.log('\nSi el mensaje directo llega pero el bot no responde automáticamente,');
  console.log('el problema está en el procesamiento del webhook o en las variables de entorno de Supabase.');
}