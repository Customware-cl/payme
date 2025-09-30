#!/usr/bin/env -S deno run --allow-net --allow-env

// Script para verificar y corregir el formato del número de teléfono en la BD

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

async function checkContactPhoneFormats() {
  console.log('📱 Verificando formato de números en la base de datos...\n');

  try {
    // Buscar el tenant
    const tenantResponse = await fetch(`${supabaseUrl}/rest/v1/tenants?whatsapp_phone_number_id=eq.${phoneNumberId}&select=id`, {
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      }
    });

    const tenants = await tenantResponse.json();
    if (!tenants || tenants.length === 0) {
      console.error('❌ No se encontró tenant');
      return;
    }

    const tenantId = tenants[0].id;

    // Obtener contactos del tenant
    const contactsResponse = await fetch(`${supabaseUrl}/rest/v1/contacts?tenant_id=eq.${tenantId}&select=*`, {
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      }
    });

    const contacts = await contactsResponse.json();

    console.log(`✅ Encontrados ${contacts.length} contactos:\n`);

    for (const contact of contacts) {
      console.log(`📞 Contacto: ${contact.name}`);
      console.log(`   ID: ${contact.id}`);
      console.log(`   WhatsApp ID: ${contact.whatsapp_id || 'N/A'}`);
      console.log(`   Teléfono E.164: ${contact.phone_e164}`);

      // Verificar si el formato es correcto
      const isValidE164 = /^\+[1-9]\d{1,14}$/.test(contact.phone_e164);
      console.log(`   Formato E.164 válido: ${isValidE164 ? '✅' : '❌'}`);

      // Si el contacto coincide con nuestro número de prueba
      if (contact.whatsapp_id === '56964943476' || contact.phone_e164.includes('964943476')) {
        console.log(`   🎯 ¡Este es tu contacto de prueba!`);

        // Verificar que el formato sea exactamente +56964943476
        if (contact.phone_e164 !== '+56964943476') {
          console.log(`   ⚠️  Formato incorrecto. Corrigiendo...`);

          // Corregir el formato
          const updateResponse = await fetch(`${supabaseUrl}/rest/v1/contacts?id=eq.${contact.id}`, {
            method: 'PATCH',
            headers: {
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              phone_e164: '+56964943476',
              whatsapp_id: '56964943476'
            })
          });

          if (updateResponse.ok) {
            console.log(`   ✅ Formato corregido a +56964943476`);
          } else {
            console.log(`   ❌ Error corrigiendo formato`);
          }
        } else {
          console.log(`   ✅ Formato correcto`);
        }
      }

      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function testWithCorrectedFormat() {
  console.log('🧪 Probando con formato corregido...\n');

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
            profile: { name: "Test Format" },
            wa_id: "56964943476"
          }],
          messages: [{
            from: "56964943476",
            id: `test_format_${Date.now()}`,
            timestamp: Math.floor(Date.now() / 1000).toString(),
            text: { body: "test formato" },
            type: "text"
          }]
        },
        field: "messages"
      }]
    }]
  };

  try {
    console.log('📤 Enviando mensaje de prueba con formato corregido...');

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testMessage)
    });

    const result = await response.text();
    console.log(`📥 Status: ${response.status}`);

    if (response.ok) {
      console.log('✅ ¡Mensaje procesado! Revisa WhatsApp 📱');
    } else {
      console.log(`❌ Error: ${result}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Ejecutar
if (import.meta.main) {
  await checkContactPhoneFormats();
  console.log('---\n');
  await testWithCorrectedFormat();
}