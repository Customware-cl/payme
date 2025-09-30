#!/usr/bin/env -S deno run --allow-net --allow-env

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = 'https://qgjxkszfdoolaxmsupil.supabase.co';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseKey) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY no está configurada');
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 Verificando payload completo de mensajes recientes...\n');

// Obtener mensajes de las últimas 24 horas
const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

const { data: messages, error } = await supabase
  .from('whatsapp_messages')
  .select(`
    *,
    contacts:contact_id (
      name,
      phone_e164
    )
  `)
  .gte('created_at', oneDayAgo)
  .order('created_at', { ascending: false })
  .limit(10);

if (error) {
  console.error('❌ Error al obtener mensajes:', error.message);
  Deno.exit(1);
}

if (!messages || messages.length === 0) {
  console.log('⚠️  No hay mensajes recientes en las últimas 24 horas');
  Deno.exit(0);
}

console.log(`📨 Encontrados ${messages.length} mensajes recientes:\n`);
console.log('='.repeat(80));

for (const msg of messages) {
  const direction = msg.direction === 'inbound' ? '📥 ENTRANTE' : '📤 SALIENTE';
  const time = new Date(msg.created_at).toLocaleString('es-CL');
  const contact = msg.contacts ? `${msg.contacts.name} (${msg.contacts.phone_e164})` : 'Desconocido';

  console.log(`\n${direction} - ${time}`);
  console.log(`Contacto: ${contact}`);
  console.log(`Tipo de mensaje: ${msg.message_type}`);
  console.log(`WhatsApp Message ID: ${msg.wa_message_id}`);
  console.log(`Estado: ${msg.status || 'pending'}`);

  console.log(`\n📦 PAYLOAD COMPLETO DEL CONTENT:`);
  console.log(JSON.stringify(msg.content, null, 2));

  if (msg.error_message) {
    console.log(`\n❌ Error: ${msg.error_message}`);
  }

  console.log('\n' + '='.repeat(80));
}

console.log('\n✅ Análisis completo');
