#!/usr/bin/env -S deno run --allow-net --allow-env

// Script para eliminar el contacto con formato incorrecto

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

async function deleteBadContact() {
  console.log('🗑️ Eliminando contacto con formato incorrecto...\n');

  try {
    // Buscar el contacto con formato incorrecto
    const getResponse = await fetch(`${supabaseUrl}/rest/v1/contacts?phone_e164=eq.%2B5256964943476&select=*`, {
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      }
    });

    const contacts = await getResponse.json();

    if (!contacts || contacts.length === 0) {
      console.log('ℹ️  No se encontró contacto con formato incorrecto');
      return;
    }

    const badContact = contacts[0];
    console.log('📞 Contacto problemático encontrado:');
    console.log(`   ID: ${badContact.id}`);
    console.log(`   Nombre: ${badContact.name}`);
    console.log(`   Teléfono: ${badContact.phone_e164}`);
    console.log(`   WhatsApp ID: ${badContact.whatsapp_id}`);

    // Verificar si tiene mensajes asociados
    const messagesResponse = await fetch(`${supabaseUrl}/rest/v1/whatsapp_messages?contact_id=eq.${badContact.id}&select=count`, {
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Prefer': 'count=exact'
      }
    });

    const messageCount = messagesResponse.headers.get('content-range')?.split('/')[1] || '0';
    console.log(`   Mensajes asociados: ${messageCount}`);

    if (parseInt(messageCount) > 0) {
      console.log('\n🔄 Transferir mensajes al contacto correcto primero...');

      // Buscar el contacto correcto
      const correctContactResponse = await fetch(`${supabaseUrl}/rest/v1/contacts?phone_e164=eq.%2B56964943476&select=id`, {
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`
        }
      });

      const correctContacts = await correctContactResponse.json();

      if (correctContacts && correctContacts.length > 0) {
        const correctContactId = correctContacts[0].id;

        // Transferir mensajes
        const transferResponse = await fetch(`${supabaseUrl}/rest/v1/whatsapp_messages?contact_id=eq.${badContact.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contact_id: correctContactId
          })
        });

        if (transferResponse.ok) {
          console.log('✅ Mensajes transferidos al contacto correcto');
        } else {
          console.log('⚠️  Error transfiriendo mensajes');
        }
      }
    }

    // Eliminar el contacto problemático
    console.log('\n🗑️ Eliminando contacto problemático...');

    const deleteResponse = await fetch(`${supabaseUrl}/rest/v1/contacts?id=eq.${badContact.id}`, {
      method: 'DELETE',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      }
    });

    if (deleteResponse.ok) {
      console.log('✅ Contacto eliminado exitosamente');
    } else {
      const error = await deleteResponse.text();
      console.log(`❌ Error eliminando contacto: ${error}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function verifyContacts() {
  console.log('\n📋 Verificando contactos restantes...\n');

  try {
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

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

    // Obtener contactos del tenant que contengan 964943476
    const contactsResponse = await fetch(`${supabaseUrl}/rest/v1/contacts?tenant_id=eq.${tenantId}&phone_e164=like.*964943476*&select=*`, {
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      }
    });

    const contacts = await contactsResponse.json();

    console.log(`✅ Contactos con tu número (${contacts.length}):`);
    contacts.forEach((contact: any, index: number) => {
      console.log(`   ${index + 1}. ${contact.name}`);
      console.log(`      ID: ${contact.id}`);
      console.log(`      Teléfono: ${contact.phone_e164}`);
      console.log(`      WhatsApp ID: ${contact.whatsapp_id || 'N/A'}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function testAfterCleanup() {
  console.log('🧪 Probando después de limpiar contactos...\n');

  const webhookUrl = `${supabaseUrl}/functions/v1/wa_webhook`;
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

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
            profile: { name: "Test Clean" },
            wa_id: "56964943476"
          }],
          messages: [{
            from: "56964943476",
            id: `test_clean_${Date.now()}`,
            timestamp: Math.floor(Date.now() / 1000).toString(),
            text: { body: "hola clean" },
            type: "text"
          }]
        },
        field: "messages"
      }]
    }]
  };

  try {
    console.log('📤 Enviando mensaje después de limpiar...');

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testMessage)
    });

    const result = await response.text();
    console.log(`📥 Status: ${response.status}`);

    if (response.ok) {
      console.log('✅ ¡Mensaje procesado!');
      console.log('\n🎉 ¡REVISA TU WHATSAPP - AHORA DEBERÍA FUNCIONAR! 📱');
    } else {
      console.log(`❌ Error: ${result}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Ejecutar
if (import.meta.main) {
  await deleteBadContact();
  await verifyContacts();
  await testAfterCleanup();
}