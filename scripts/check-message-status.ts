#!/usr/bin/env -S deno run --allow-net --allow-env

// Script para verificar el estado de mensajes de WhatsApp

const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
const businessAccountId = Deno.env.get('WHATSAPP_BUSINESS_ACCOUNT_ID');

if (!accessToken || !businessAccountId) {
  console.error('❌ Error: Variables de entorno requeridas no encontradas');
  Deno.exit(1);
}

async function checkBusinessAccount() {
  console.log('🔍 Verificando información de Business Account...\n');

  try {
    const url = `https://graph.facebook.com/v18.0/${businessAccountId}?fields=id,name,phone_numbers,message_template_namespace&access_token=${accessToken}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Error al obtener información del Business Account:', data);
      return;
    }

    console.log('✅ Business Account información:');
    console.log(`   ID: ${data.id}`);
    console.log(`   Nombre: ${data.name || 'N/A'}`);
    console.log(`   Namespace: ${data.message_template_namespace || 'N/A'}`);

    if (data.phone_numbers && data.phone_numbers.data) {
      console.log('📱 Números de teléfono asociados:');
      data.phone_numbers.data.forEach((phone: any, index: number) => {
        console.log(`   ${index + 1}. ID: ${phone.id}`);
        console.log(`      Número: ${phone.display_phone_number || 'N/A'}`);
        console.log(`      Estado: ${phone.verified_name || 'N/A'}`);
        console.log(`      Calidad: ${phone.quality_rating || 'N/A'}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function checkPhoneNumberInfo(phoneNumberId: string) {
  console.log(`🔍 Verificando información del Phone Number ID: ${phoneNumberId}...\n`);

  try {
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating,status&access_token=${accessToken}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Error al obtener información del teléfono:', data);
      return;
    }

    console.log('✅ Información del número de teléfono:');
    console.log(`   ID: ${data.id}`);
    console.log(`   Número: ${data.display_phone_number || 'N/A'}`);
    console.log(`   Nombre verificado: ${data.verified_name || 'N/A'}`);
    console.log(`   Calidad: ${data.quality_rating || 'N/A'}`);
    console.log(`   Estado: ${data.status || 'N/A'}`);
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function checkRecentMessages(phoneNumberId: string) {
  console.log('📨 Verificando mensajes recientes...\n');

  try {
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages?access_token=${accessToken}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Error al obtener mensajes:', data);
      return;
    }

    if (data.data && data.data.length > 0) {
      console.log(`✅ Encontrados ${data.data.length} mensajes recientes:`);
      data.data.slice(0, 5).forEach((msg: any, index: number) => {
        console.log(`   ${index + 1}. ID: ${msg.id}`);
        console.log(`      Para: ${msg.to || 'N/A'}`);
        console.log(`      Tipo: ${msg.type || 'N/A'}`);
        console.log(`      Estado: ${msg.status || 'N/A'}`);
        console.log('');
      });
    } else {
      console.log('ℹ️  No se encontraron mensajes recientes');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Ejecutar verificaciones
if (import.meta.main) {
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || '778143428720890';

  console.log('🧪 Verificando configuración de WhatsApp Business...\n');

  await checkBusinessAccount();
  await checkPhoneNumberInfo(phoneNumberId);
  await checkRecentMessages(phoneNumberId);

  console.log('✅ Verificación completada');
}