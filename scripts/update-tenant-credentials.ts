#!/usr/bin/env -S deno run --allow-net --allow-env

// Script para actualizar las credenciales de WhatsApp en el tenant

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
const businessAccountId = Deno.env.get('WHATSAPP_BUSINESS_ACCOUNT_ID');

if (!supabaseUrl || !supabaseServiceKey || !accessToken || !phoneNumberId) {
  console.error('❌ Error: Variables de entorno requeridas no encontradas');
  Deno.exit(1);
}

async function updateTenantCredentials() {
  console.log('🔑 Actualizando credenciales de WhatsApp en el tenant...\n');

  try {
    // Primero, buscar el tenant actual
    const { data: tenant } = await fetch(`${supabaseUrl}/rest/v1/tenants?whatsapp_phone_number_id=eq.${phoneNumberId}&select=*`, {
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      }
    }).then(r => r.json());

    if (!tenant || tenant.length === 0) {
      console.error('❌ No se encontró tenant para este Phone Number ID');
      return;
    }

    const tenantId = tenant[0].id;
    console.log(`✅ Tenant encontrado: ${tenant[0].name} (${tenantId})`);

    // Actualizar con las credenciales
    const updateData = {
      whatsapp_access_token: accessToken,
      whatsapp_business_account_id: businessAccountId,
      status: 'active'
    };

    console.log('📝 Actualizando credenciales...');

    const response = await fetch(`${supabaseUrl}/rest/v1/tenants?id=eq.${tenantId}`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(updateData)
    });

    if (response.ok) {
      const updatedTenant = await response.json();
      console.log('✅ Tenant actualizado exitosamente');
      console.log(`   WhatsApp Access Token: ${updatedTenant[0].whatsapp_access_token ? '✅ Configurado' : '❌ Error'}`);
      console.log(`   Business Account ID: ${updatedTenant[0].whatsapp_business_account_id || 'N/A'}`);
      console.log(`   Estado: ${updatedTenant[0].status}`);
    } else {
      const error = await response.text();
      console.error('❌ Error actualizando tenant:', error);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function testAfterUpdate() {
  console.log('\n🧪 Probando envío después de la actualización...\n');

  // Simular un mensaje de prueba al webhook
  const webhookUrl = `${supabaseUrl}/functions/v1/wa_webhook`;

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
                phone_number_id: phoneNumberId
              },
              contacts: [
                {
                  profile: {
                    name: "Test Usuario"
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
                    body: "test respuesta"
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

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testMessage)
    });

    const result = await response.text();

    console.log(`📥 Respuesta: ${response.status} - ${result}`);

    if (response.ok) {
      console.log('✅ Webhook procesó el mensaje correctamente');
      console.log('\n💬 Ahora revisa tu WhatsApp para ver si llegó la respuesta automática');
    } else {
      console.error('❌ Error en el webhook');
    }

  } catch (error) {
    console.error('❌ Error probando webhook:', error.message);
  }
}

// Ejecutar
if (import.meta.main) {
  await updateTenantCredentials();
  await testAfterUpdate();
}