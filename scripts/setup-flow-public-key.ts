// Script para configurar la clave pública de WhatsApp Flows
// Según documentación: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/whatsapp-business-encryption

import { readFileSync } from 'fs';

const WHATSAPP_BUSINESS_ACCOUNT_ID = Deno.env.get('WHATSAPP_BUSINESS_ACCOUNT_ID');
const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
const PUBLIC_KEY_FILE = './whatsapp_flows_public_key.pem';

async function setBusinessPublicKey() {
  if (!WHATSAPP_BUSINESS_ACCOUNT_ID) {
    console.error('❌ WHATSAPP_BUSINESS_ACCOUNT_ID no está configurado en .env');
    console.log('💡 Encuéntralo en: https://business.facebook.com/settings/whatsapp-business-accounts');
    Deno.exit(1);
  }

  if (!WHATSAPP_ACCESS_TOKEN) {
    console.error('❌ WHATSAPP_ACCESS_TOKEN no está configurado en .env');
    console.log('💡 Genera uno en: https://developers.facebook.com/tools/explorer');
    Deno.exit(1);
  }

  console.log('📋 Configurando clave pública para WhatsApp Flows...');
  console.log('   WABA ID:', WHATSAPP_BUSINESS_ACCOUNT_ID);

  // Leer clave pública
  let publicKey: string;
  try {
    publicKey = readFileSync(PUBLIC_KEY_FILE, 'utf-8');
    console.log('✅ Clave pública leída desde', PUBLIC_KEY_FILE);
  } catch (error) {
    console.error('❌ Error leyendo clave pública:', error.message);
    console.log('💡 Asegúrate de que existe el archivo whatsapp_flows_public_key.pem');
    Deno.exit(1);
  }

  // Hacer POST request a Graph API
  const url = `https://graph.facebook.com/v21.0/${WHATSAPP_BUSINESS_ACCOUNT_ID}/whatsapp_business_encryption`;

  console.log('\n🔐 Enviando clave pública a Meta...');
  console.log('   URL:', url);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        business_public_key: publicKey
      })
    });

    const result = await response.json();

    if (response.ok) {
      console.log('\n✅ Clave pública configurada exitosamente!');
      console.log('   Respuesta:', JSON.stringify(result, null, 2));
      console.log('\n📌 Próximos pasos:');
      console.log('   1. Verifica la configuración del endpoint en tu Flow');
      console.log('   2. Prueba el Flow desde WhatsApp');
      console.log('   3. Verifica que ya no aparezca pantalla en blanco');
    } else {
      console.error('\n❌ Error al configurar clave pública:');
      console.error('   Status:', response.status);
      console.error('   Error:', JSON.stringify(result, null, 2));

      if (result.error?.code === 190) {
        console.log('\n💡 Token de acceso inválido o expirado.');
        console.log('   Genera uno nuevo en: https://developers.facebook.com/tools/explorer');
        console.log('   Permisos necesarios: whatsapp_business_management');
      }
    }
  } catch (error) {
    console.error('\n❌ Error de red:', error.message);
  }
}

// Función para verificar la clave pública actual
async function getBusinessPublicKey() {
  const url = `https://graph.facebook.com/v21.0/${WHATSAPP_BUSINESS_ACCOUNT_ID}/whatsapp_business_encryption`;

  console.log('\n🔍 Verificando clave pública actual...');

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      }
    });

    const result = await response.json();

    if (response.ok) {
      if (result.data && result.data.length > 0) {
        console.log('✅ Clave pública ya configurada:');
        console.log('   ID:', result.data[0].id);
        console.log('   Key (primeros 50 chars):', result.data[0].business_public_key.substring(0, 50) + '...');
      } else {
        console.log('⚠️  No hay clave pública configurada aún');
      }
    } else {
      console.error('❌ Error:', JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Main
console.log('🔐 WhatsApp Flows - Configuración de Clave Pública\n');

const command = Deno.args[0];

if (command === 'get') {
  await getBusinessPublicKey();
} else if (command === 'set') {
  await setBusinessPublicKey();
} else {
  console.log('Uso:');
  console.log('  deno run --allow-net --allow-env --allow-read setup-flow-public-key.ts set   # Configurar clave pública');
  console.log('  deno run --allow-net --allow-env --allow-read setup-flow-public-key.ts get   # Ver clave pública actual');
}
