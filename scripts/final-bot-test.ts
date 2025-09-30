#!/usr/bin/env -S deno run --allow-net --allow-env

// Prueba final del bot con todas las correcciones aplicadas

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

async function finalBotTest() {
  console.log('🎯 PRUEBA FINAL DEL BOT - Todas las correcciones aplicadas\n');

  console.log('✅ Correcciones implementadas:');
  console.log('   • Función parsePhoneNumber corregida para números chilenos');
  console.log('   • ConversationManager validado contra state null');
  console.log('   • Contactos duplicados eliminados');
  console.log('   • Solo queda contacto con formato correcto: +56964943476\n');

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
            profile: { name: "Prueba Final" },
            wa_id: "56964943476"
          }],
          messages: [{
            from: "56964943476",
            id: `final_test_${Date.now()}`,
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
      console.log('\n🎉 ¡WEBHOOK PROCESÓ EL MENSAJE EXITOSAMENTE!');
      console.log('\n📱 AHORA REVISA TU WHATSAPP:');
      console.log('   • Deberías recibir respuesta automática del bot');
      console.log('   • El bot debería saludar y mostrar opciones');
      console.log('   • Ya no deberían aparecer errores #131030');
      console.log('\n💬 Prueba escribir:');
      console.log('   • "hola" - Para saludo');
      console.log('   • "ayuda" - Para ver comandos');
      console.log('   • "estado" - Para ver acuerdos');
      console.log('   • "nuevo préstamo" - Para iniciar flujo');

    } else {
      console.error(`❌ Error: ${result}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Función adicional para mostrar el estado actual del sistema
async function showSystemStatus() {
  console.log('\n📊 ESTADO DEL SISTEMA:\n');

  // Mostrar configuración actual
  console.log('🔧 Configuración:');
  console.log(`   • Supabase URL: ${supabaseUrl}`);
  console.log(`   • Phone Number ID: ${phoneNumberId}`);
  console.log(`   • Webhook URL: ${supabaseUrl}/functions/v1/wa_webhook`);

  // Verificar contactos
  try {
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const response = await fetch(`${supabaseUrl}/rest/v1/contacts?phone_e164=like.*964943476*&select=id,name,phone_e164,whatsapp_id`, {
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      }
    });

    const contacts = await response.json();

    console.log('\n📞 Contactos con tu número:');
    if (contacts && contacts.length > 0) {
      contacts.forEach((contact: any, index: number) => {
        console.log(`   ${index + 1}. ${contact.name}`);
        console.log(`      Teléfono: ${contact.phone_e164}`);
        console.log(`      WhatsApp ID: ${contact.whatsapp_id || 'N/A'}`);
      });
    } else {
      console.log('   Ninguno encontrado');
    }

  } catch (error) {
    console.log(`   Error verificando contactos: ${error.message}`);
  }
}

// Ejecutar
if (import.meta.main) {
  await showSystemStatus();
  await finalBotTest();
}