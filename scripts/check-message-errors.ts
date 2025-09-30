#!/usr/bin/env -S deno run --allow-net --allow-env

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = 'https://qgjxkszfdoolaxmsupil.supabase.co';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseKey) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY no está configurada');
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 Verificando errores en mensajes...\n');

// Verificar mensajes salientes sin enviar o con errores
const { data: outboundMessages, error: outError } = await supabase
  .from('whatsapp_messages')
  .select(`
    *,
    contacts:contact_id (
      name,
      phone_e164
    )
  `)
  .eq('direction', 'outbound')
  .or('status.eq.failed,status.eq.pending,error_message.not.is.null')
  .order('created_at', { ascending: false })
  .limit(10);

if (outError) {
  console.error('❌ Error:', outError.message);
} else if (!outboundMessages || outboundMessages.length === 0) {
  console.log('✅ No hay mensajes salientes con errores recientes');
} else {
  console.log(`⚠️  Encontrados ${outboundMessages.length} mensajes con problemas:\n`);
  for (const msg of outboundMessages) {
    console.log(`📤 ${new Date(msg.created_at).toLocaleString('es-CL')}`);
    console.log(`   Para: ${msg.contacts?.phone_e164 || 'Desconocido'}`);
    console.log(`   Estado: ${msg.status}`);
    if (msg.error_message) {
      console.log(`   ❌ Error: ${msg.error_message}`);
    }
    console.log('');
  }
}

// Verificar mensajes en cola
console.log('\n📋 Verificando cola de mensajes...\n');

const { data: queuedMessages, error: queueError } = await supabase
  .from('message_queue')
  .select('*')
  .eq('status', 'pending')
  .order('created_at', { ascending: false })
  .limit(10);

if (queueError) {
  console.error('❌ Error al verificar cola:', queueError.message);
} else if (!queuedMessages || queuedMessages.length === 0) {
  console.log('✅ No hay mensajes pendientes en la cola');
} else {
  console.log(`📨 Hay ${queuedMessages.length} mensajes en cola pendientes:\n`);
  for (const msg of queuedMessages) {
    console.log(`   Creado: ${new Date(msg.created_at).toLocaleString('es-CL')}`);
    console.log(`   Scheduled: ${new Date(msg.scheduled_at).toLocaleString('es-CL')}`);
    console.log(`   Prioridad: ${msg.priority}`);
    console.log('');
  }
}