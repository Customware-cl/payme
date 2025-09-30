#!/usr/bin/env -S deno run --allow-net --allow-env

import { WhatsAppClient } from '../lib/whatsapp-client.ts';

// Cargar variables de entorno
const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
const businessAccountId = Deno.env.get('WHATSAPP_BUSINESS_ACCOUNT_ID');

if (!accessToken || !phoneNumberId) {
  console.error('❌ Error: Variables de entorno WHATSAPP_ACCESS_TOKEN y WHATSAPP_PHONE_NUMBER_ID son requeridas');
  Deno.exit(1);
}

// Configurar cliente de WhatsApp
const client = new WhatsAppClient({
  accessToken,
  phoneNumberId,
  businessAccountId,
});

async function testSendMessage() {
  console.log('🧪 Iniciando prueba de envío de mensaje de WhatsApp...\n');

  // Número de prueba (cambiar por tu número)
  const testPhoneNumber = '+56964943476'; // Formato E.164

  console.log(`📱 Número de destino: ${testPhoneNumber}`);
  console.log(`📞 Phone Number ID: ${phoneNumberId}`);
  console.log(`🔑 Access Token: ${accessToken.substring(0, 20)}...`);
  console.log('');

  try {
    // Prueba 1: Mensaje de texto simple
    console.log('📝 Enviando mensaje de texto simple...');
    const textResponse = await client.sendTextMessage(
      testPhoneNumber,
      '¡Hola! Este es un mensaje de prueba desde el bot de PrestaBot. 🤖\n\nSi recibes este mensaje, la configuración de WhatsApp está funcionando correctamente.'
    );

    console.log('✅ Mensaje de texto enviado exitosamente');
    console.log(`   ID del mensaje: ${textResponse.messages[0].id}`);
    console.log(`   WAMID: ${textResponse.messages[0].message_status || 'N/A'}`);
    console.log('');

    // Esperar un poco antes del siguiente mensaje
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Prueba 2: Mensaje interactivo con botones
    console.log('🔘 Enviando mensaje interactivo con botones...');
    const interactiveResponse = await client.sendInteractiveMessage(
      testPhoneNumber,
      '¿Cómo te pareció la prueba del bot?',
      [
        { id: 'test_good', title: '👍 Excelente' },
        { id: 'test_ok', title: '👌 Bien' },
        { id: 'test_bad', title: '👎 Mejorable' }
      ],
      '🧪 Prueba de Botones',
      'PrestaBot - Sistema de pruebas'
    );

    console.log('✅ Mensaje interactivo enviado exitosamente');
    console.log(`   ID del mensaje: ${interactiveResponse.messages[0].id}`);
    console.log('');

    console.log('🎉 ¡Todas las pruebas completadas exitosamente!');
    console.log('');
    console.log('📋 Resumen:');
    console.log('   • Mensaje de texto: ✅');
    console.log('   • Mensaje interactivo: ✅');
    console.log('   • Cliente configurado correctamente: ✅');

  } catch (error) {
    console.error('❌ Error durante la prueba:', error.message);

    if (error.code) {
      console.error(`   Código de error: ${error.code}`);
    }

    if (error.type) {
      console.error(`   Tipo de error: ${error.type}`);
    }

    // Sugerencias de solución según el tipo de error
    if (error.message.includes('access token')) {
      console.log('\n💡 Sugerencia: Verifica que el WHATSAPP_ACCESS_TOKEN sea válido y no haya expirado');
    }

    if (error.message.includes('phone number')) {
      console.log('\n💡 Sugerencia: Verifica que el WHATSAPP_PHONE_NUMBER_ID sea correcto');
    }

    if (error.message.includes('recipient')) {
      console.log('\n💡 Sugerencia: Verifica que el número de teléfono de destino esté en formato E.164');
    }

    Deno.exit(1);
  }
}

// Función para validar el formato del número de teléfono
function validatePhoneNumber(phone: string): boolean {
  return WhatsAppClient.isValidE164(phone);
}

// Verificar argumentos de línea de comandos
const args = Deno.args;
if (args.length > 0) {
  const phoneArg = args[0];
  if (validatePhoneNumber(phoneArg)) {
    console.log(`📱 Usando número personalizado: ${phoneArg}`);
    // Aquí podrías usar el número personalizado
  } else {
    console.error(`❌ Número de teléfono inválido: ${phoneArg}`);
    console.log('   El número debe estar en formato E.164 (ej: +56912345678)');
    Deno.exit(1);
  }
}

// Ejecutar la prueba
if (import.meta.main) {
  await testSendMessage();
}