#!/usr/bin/env -S deno run --allow-net --allow-env

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = 'https://qgjxkszfdoolaxmsupil.supabase.co';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseKey) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY no está configurada');
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 Verificando mensajes recientes...\n');

// Obtener mensajes de las últimas 2 horas
const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

const { data: messages, error } = await supabase
  .from('whatsapp_messages')
  .select(`
    *,
    contacts:contact_id (
      name,
      phone_e164
    ),
    tenants:tenant_id (
      name
    )
  `)
  .gte('created_at', twoHoursAgo)
  .order('created_at', { ascending: false })
  .limit(20);

if (error) {
  console.error('❌ Error al obtener mensajes:', error.message);
  Deno.exit(1);
}

if (!messages || messages.length === 0) {
  console.log('⚠️  No hay mensajes recientes en las últimas 2 horas');
  Deno.exit(0);
}

console.log(`📨 Encontrados ${messages.length} mensajes recientes:\n`);

for (const msg of messages) {
  const direction = msg.direction === 'inbound' ? '📥 Entrante' : '📤 Saliente';
  const time = new Date(msg.created_at).toLocaleString('es-CL');
  const contact = msg.contacts ? `${msg.contacts.name} (${msg.contacts.phone_e164})` : 'Desconocido';
  const status = msg.status || 'pending';

  console.log(`${direction} - ${time}`);
  console.log(`   Contacto: ${contact}`);
  console.log(`   Tipo: ${msg.message_type}`);
  console.log(`   Estado: ${status}`);

  if (msg.content?.text?.body) {
    console.log(`   Texto: "${msg.content.text.body}"`);
  }

  if (msg.error_message) {
    console.log(`   ❌ Error: ${msg.error_message}`);
  }

  console.log('');
}