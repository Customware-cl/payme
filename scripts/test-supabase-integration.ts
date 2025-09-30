#!/usr/bin/env -S deno run --allow-net --allow-env

// Script para verificar la integración con Supabase

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Variables de entorno de Supabase no encontradas');
  Deno.exit(1);
}

async function testSupabaseConnection() {
  console.log('🔗 Probando conexión a Supabase...\n');

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      }
    });

    if (response.ok) {
      console.log('✅ Conexión a Supabase exitosa');
      return true;
    } else {
      console.error('❌ Error de conexión:', response.status, response.statusText);
      return false;
    }
  } catch (error) {
    console.error('❌ Error de red:', error.message);
    return false;
  }
}

async function testTables() {
  console.log('📊 Verificando tablas principales...\n');

  const tables = [
    'tenants',
    'contacts',
    'agreements',
    'whatsapp_messages',
    'reminder_instances',
    'events'
  ];

  for (const table of tables) {
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=count&limit=1`, {
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Prefer': 'count=exact'
        }
      });

      if (response.ok) {
        const countHeader = response.headers.get('content-range');
        const count = countHeader?.split('/')[1] || '0';
        console.log(`✅ ${table}: ${count} registros`);
      } else {
        console.error(`❌ Error accediendo a ${table}:`, response.status);
      }
    } catch (error) {
      console.error(`❌ Error con tabla ${table}:`, error.message);
    }
  }
}

async function testTenantConfiguration() {
  console.log('\n🏢 Verificando configuración de tenant...\n');

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
      console.log('✅ Tenant encontrado:');
      console.log(`   ID: ${tenant.id}`);
      console.log(`   Nombre: ${tenant.name}`);
      console.log(`   Phone Number ID: ${tenant.whatsapp_phone_number_id}`);
      console.log(`   Estado: ${tenant.status}`);

      return tenant;
    } else {
      console.log('⚠️  No se encontró tenant para este Phone Number ID');
      console.log(`   Buscando: ${phoneNumberId}`);
      return null;
    }
  } catch (error) {
    console.error('❌ Error verificando tenant:', error.message);
    return null;
  }
}

async function testContactsForTenant(tenantId: string) {
  console.log('\n👥 Verificando contactos del tenant...\n');

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/contacts?tenant_id=eq.${tenantId}&select=*&order=created_at.desc&limit=5`, {
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      }
    });

    const contacts = await response.json();

    if (contacts && contacts.length > 0) {
      console.log(`✅ Encontrados ${contacts.length} contactos recientes:`);
      contacts.forEach((contact: any, index: number) => {
        console.log(`   ${index + 1}. ${contact.name} (${contact.phone_e164})`);
        console.log(`      WhatsApp ID: ${contact.whatsapp_id}`);
        console.log(`      Opt-in: ${contact.opt_in_status}`);
        console.log(`      Creado: ${new Date(contact.created_at).toLocaleString()}`);
        console.log('');
      });
    } else {
      console.log('ℹ️  No se encontraron contactos para este tenant');
    }

    return contacts;
  } catch (error) {
    console.error('❌ Error verificando contactos:', error.message);
    return [];
  }
}

async function testRecentMessages(tenantId: string) {
  console.log('💬 Verificando mensajes recientes...\n');

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/whatsapp_messages?tenant_id=eq.${tenantId}&select=*,contact:contacts(name,phone_e164)&order=created_at.desc&limit=10`, {
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      }
    });

    const messages = await response.json();

    if (messages && messages.length > 0) {
      console.log(`✅ Encontrados ${messages.length} mensajes recientes:`);
      messages.forEach((msg: any, index: number) => {
        console.log(`   ${index + 1}. ${msg.direction.toUpperCase()} - ${msg.message_type}`);
        console.log(`      De/Para: ${msg.contact?.name || 'N/A'} (${msg.contact?.phone_e164 || 'N/A'})`);
        console.log(`      Estado: ${msg.status || 'N/A'}`);
        console.log(`      Fecha: ${new Date(msg.created_at).toLocaleString()}`);
        if (msg.content?.text?.body) {
          const preview = msg.content.text.body.substring(0, 50) + (msg.content.text.body.length > 50 ? '...' : '');
          console.log(`      Contenido: "${preview}"`);
        }
        console.log('');
      });
    } else {
      console.log('ℹ️  No se encontraron mensajes para este tenant');
    }

    return messages;
  } catch (error) {
    console.error('❌ Error verificando mensajes:', error.message);
    return [];
  }
}

async function testWebhookEndpoint() {
  console.log('🔗 Verificando webhook endpoint...\n');

  try {
    const webhookUrl = `${supabaseUrl}/functions/v1/wa_webhook`;

    // Test GET (verification)
    const testUrl = `${webhookUrl}?hub.mode=subscribe&hub.verify_token=token_prestabot_2025&hub.challenge=test123`;

    const response = await fetch(testUrl);
    const result = await response.text();

    if (response.ok && result === 'test123') {
      console.log('✅ Webhook endpoint funcionando correctamente');
      console.log(`   URL: ${webhookUrl}`);
      console.log('   Verificación: OK');
    } else {
      console.log('⚠️  Webhook endpoint con problemas');
      console.log(`   Status: ${response.status}`);
      console.log(`   Response: ${result}`);
    }
  } catch (error) {
    console.error('❌ Error verificando webhook:', error.message);
  }
}

// Ejecutar todas las verificaciones
if (import.meta.main) {
  console.log('🧪 Verificando integración con Supabase...\n');

  try {
    // 1. Conexión básica
    const connected = await testSupabaseConnection();
    if (!connected) {
      console.error('❌ No se puede continuar sin conexión a Supabase');
      Deno.exit(1);
    }

    console.log('---\n');

    // 2. Verificar tablas
    await testTables();

    console.log('---');

    // 3. Configuración de tenant
    const tenant = await testTenantConfiguration();

    if (tenant) {
      // 4. Contactos del tenant
      await testContactsForTenant(tenant.id);

      console.log('---');

      // 5. Mensajes recientes
      await testRecentMessages(tenant.id);

      console.log('---');
    }

    // 6. Webhook endpoint
    await testWebhookEndpoint();

    console.log('---\n');
    console.log('✅ Verificación de integración completada');

    if (!tenant) {
      console.log('\n⚠️  RECOMENDACIÓN: Crear un tenant para el Phone Number ID actual');
    }

  } catch (error) {
    console.error('❌ Error en la verificación:', error.message);
    Deno.exit(1);
  }
}