#!/usr/bin/env -S deno run --allow-net --allow-env

// Script para corregir manualmente el contacto problemático

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

async function fixContactDirectly() {
  console.log('🔧 Corrigiendo contacto problemático directamente...\n');

  // El ID del contacto problemático que encontramos
  const problemContactId = 'd97cdd3e-d53e-4445-a11b-8219fa2ee996';

  try {
    // Primero, verificar el contacto actual
    const getResponse = await fetch(`${supabaseUrl}/rest/v1/contacts?id=eq.${problemContactId}&select=*`, {
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      }
    });

    const contacts = await getResponse.json();
    if (!contacts || contacts.length === 0) {
      console.error('❌ No se encontró el contacto');
      return;
    }

    const contact = contacts[0];
    console.log('📞 Contacto actual:');
    console.log(`   Nombre: ${contact.name}`);
    console.log(`   Teléfono: ${contact.phone_e164}`);
    console.log(`   WhatsApp ID: ${contact.whatsapp_id}`);

    // Intentar actualizar con diferentes métodos
    console.log('\n🔧 Intentando corrección...');

    // Método 1: Actualización directa
    const updateResponse = await fetch(`${supabaseUrl}/rest/v1/contacts?id=eq.${problemContactId}`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        phone_e164: '+56964943476'
      })
    });

    if (updateResponse.ok) {
      const updated = await updateResponse.json();
      console.log('✅ Contacto corregido exitosamente');
      console.log(`   Nuevo teléfono: ${updated[0].phone_e164}`);
    } else {
      const error = await updateResponse.text();
      console.log(`❌ Error en actualización: ${error}`);

      // Método 2: Crear nuevo contacto y marcar el viejo como inactivo
      console.log('\n🔄 Intentando crear nuevo contacto...');

      const newContactData = {
        tenant_id: contact.tenant_id,
        name: contact.name,
        phone_e164: '+56964943476',
        whatsapp_id: '56964943476',
        opt_in_status: contact.opt_in_status || 'pending',
        preferred_language: contact.preferred_language || 'es',
        metadata: contact.metadata || {}
      };

      const createResponse = await fetch(`${supabaseUrl}/rest/v1/contacts`, {
        method: 'POST',
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(newContactData)
      });

      if (createResponse.ok) {
        const newContact = await createResponse.json();
        console.log('✅ Nuevo contacto creado exitosamente');
        console.log(`   ID: ${newContact[0].id}`);
        console.log(`   Teléfono: ${newContact[0].phone_e164}`);
      } else {
        const createError = await createResponse.text();
        console.log(`❌ Error creando contacto: ${createError}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function testAfterFix() {
  console.log('\n🧪 Probando después de la corrección...\n');

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
            profile: { name: "Test Fix Final" },
            wa_id: "56964943476"
          }],
          messages: [{
            from: "56964943476",
            id: `test_fix_final_${Date.now()}`,
            timestamp: Math.floor(Date.now() / 1000).toString(),
            text: { body: "hola fix" },
            type: "text"
          }]
        },
        field: "messages"
      }]
    }]
  };

  try {
    console.log('📤 Enviando mensaje de prueba final...');

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testMessage)
    });

    const result = await response.text();
    console.log(`📥 Status: ${response.status}`);

    if (response.ok) {
      console.log('✅ ¡Mensaje procesado!');
      console.log('\n🎉 REVISA TU WHATSAPP - EL BOT DEBERÍA RESPONDER AHORA! 📱');
    } else {
      console.log(`❌ Error: ${result}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Ejecutar
if (import.meta.main) {
  await fixContactDirectly();
  await testAfterFix();
}