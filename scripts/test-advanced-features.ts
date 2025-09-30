#!/usr/bin/env -S deno run --allow-net --allow-env

import { WhatsAppClient } from '../lib/whatsapp-client.ts';

// Cargar variables de entorno
const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
const businessAccountId = Deno.env.get('WHATSAPP_BUSINESS_ACCOUNT_ID');

if (!accessToken || !phoneNumberId) {
  console.error('❌ Error: Variables de entorno requeridas no encontradas');
  Deno.exit(1);
}

const client = new WhatsAppClient({
  accessToken,
  phoneNumberId,
  businessAccountId,
});

const testPhoneNumber = '+56964943476';

async function testTemplateMessage() {
  console.log('📋 Probando mensajes con templates...\n');

  try {
    // Primero, vamos a verificar qué templates están disponibles
    const templatesUrl = `https://graph.facebook.com/v18.0/${businessAccountId}/message_templates?access_token=${accessToken}`;

    const response = await fetch(templatesUrl);
    const templates = await response.json();

    if (templates.data && templates.data.length > 0) {
      console.log('✅ Templates disponibles:');
      templates.data.forEach((template: any, index: number) => {
        console.log(`   ${index + 1}. ${template.name} (${template.status})`);
        console.log(`      Idioma: ${template.language}`);
        console.log(`      Categoría: ${template.category}`);
      });
      console.log('');

      // Intentar usar el primer template disponible
      const firstTemplate = templates.data[0];
      if (firstTemplate.status === 'APPROVED') {
        console.log(`📤 Enviando template: ${firstTemplate.name}...`);

        const templateResponse = await client.sendTemplateMessage(
          testPhoneNumber,
          firstTemplate.name,
          firstTemplate.language
        );

        console.log('✅ Template enviado exitosamente');
        console.log(`   ID: ${templateResponse.messages[0].id}`);
      } else {
        console.log('⚠️  No hay templates aprobados disponibles');
      }
    } else {
      console.log('ℹ️  No se encontraron templates configurados');
    }

  } catch (error) {
    console.error('❌ Error con templates:', error.message);
  }
}

async function testInteractiveVariations() {
  console.log('🔘 Probando variaciones de mensajes interactivos...\n');

  try {
    // 1. Mensaje con lista de opciones
    console.log('📋 Enviando mensaje con lista...');
    const listMessage = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: testPhoneNumber,
      type: 'interactive',
      interactive: {
        type: 'list',
        header: {
          type: 'text',
          text: '🏠 Servicios de PrestaBot'
        },
        body: {
          text: 'Selecciona el servicio que necesitas:'
        },
        footer: {
          text: 'PrestaBot - Tu asistente financiero'
        },
        action: {
          button: 'Ver servicios',
          sections: [
            {
              title: 'Servicios Principales',
              rows: [
                {
                  id: 'prestamos',
                  title: '💰 Préstamos',
                  description: 'Consulta sobre préstamos disponibles'
                },
                {
                  id: 'recordatorios',
                  title: '⏰ Recordatorios',
                  description: 'Configurar recordatorios de pago'
                },
                {
                  id: 'estado_cuenta',
                  title: '📊 Estado de Cuenta',
                  description: 'Consultar tu estado actual'
                }
              ]
            }
          ]
        }
      }
    };

    const listResponse = await client.sendMessage(listMessage);
    console.log('✅ Lista enviada exitosamente');
    console.log(`   ID: ${listResponse.messages[0].id}`);
    console.log('');

    // Esperar un poco antes del siguiente mensaje
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 2. Mensaje con botones de respuesta rápida
    console.log('⚡ Enviando botones de respuesta rápida...');
    const quickReplyResponse = await client.sendInteractiveMessage(
      testPhoneNumber,
      '¿En qué horario prefieres recibir recordatorios?',
      [
        { id: 'morning', title: '🌅 Mañana (8-12)' },
        { id: 'afternoon', title: '☀️ Tarde (12-18)' },
        { id: 'evening', title: '🌙 Noche (18-22)' }
      ],
      '⏰ Configuración de Horarios',
      'Puedes cambiar esto después en configuración'
    );

    console.log('✅ Botones enviados exitosamente');
    console.log(`   ID: ${quickReplyResponse.messages[0].id}`);

  } catch (error) {
    console.error('❌ Error con mensajes interactivos:', error.message);
  }
}

async function testRichContent() {
  console.log('🎨 Probando contenido enriquecido...\n');

  try {
    // Mensaje con emojis y formato
    console.log('✨ Enviando mensaje con formato enriquecido...');
    const richMessage = `🤖 *PrestaBot* - Estado del Sistema

📊 *Información del Sistema:*
• ✅ API de WhatsApp: Operativo
• ✅ Base de Datos: Conectada
• ✅ Servicios: Funcionando

💡 *Funciones Disponibles:*
1️⃣ Consulta de préstamos
2️⃣ Recordatorios automáticos
3️⃣ Estado de cuenta
4️⃣ Soporte 24/7

🔗 _Versión: 1.0.0_
📅 _Actualizado: ${new Date().toLocaleDateString('es-CL')}_

¿En qué puedo ayudarte hoy? 😊`;

    const richResponse = await client.sendTextMessage(testPhoneNumber, richMessage);
    console.log('✅ Mensaje enriquecido enviado');
    console.log(`   ID: ${richResponse.messages[0].id}`);

  } catch (error) {
    console.error('❌ Error con contenido enriquecido:', error.message);
  }
}

async function testConversationFlow() {
  console.log('💬 Probando flujo de conversación...\n');

  try {
    const messages = [
      {
        text: '¡Hola! 👋 Soy PrestaBot, tu asistente financiero personal.',
        delay: 1000
      },
      {
        text: 'Puedo ayudarte con préstamos, recordatorios de pago y consultas sobre tu cuenta.',
        delay: 2000
      },
      {
        text: 'Para comenzar, ¿podrías decirme tu nombre? 😊',
        delay: 1000
      }
    ];

    for (const [index, message] of messages.entries()) {
      console.log(`📤 Enviando mensaje ${index + 1}/3...`);

      const response = await client.sendTextMessage(testPhoneNumber, message.text);
      console.log(`   ✅ Enviado: ${response.messages[0].id}`);

      if (index < messages.length - 1) {
        console.log(`   ⏳ Esperando ${message.delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, message.delay));
      }
    }

    console.log('✅ Flujo de conversación completado');

  } catch (error) {
    console.error('❌ Error en flujo de conversación:', error.message);
  }
}

// Ejecutar todas las pruebas
if (import.meta.main) {
  console.log('🧪 Iniciando pruebas avanzadas de WhatsApp...\n');

  try {
    await testTemplateMessage();
    console.log('---\n');

    await testInteractiveVariations();
    console.log('---\n');

    await testRichContent();
    console.log('---\n');

    await testConversationFlow();
    console.log('---\n');

    console.log('🎉 ¡Todas las pruebas avanzadas completadas!');
    console.log('\n📱 Revisa tu WhatsApp para ver todos los mensajes enviados.');

  } catch (error) {
    console.error('❌ Error en las pruebas:', error.message);
    Deno.exit(1);
  }
}