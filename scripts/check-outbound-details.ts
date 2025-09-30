#!/usr/bin/env -S deno run --allow-net --allow-env

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = 'https://qgjxkszfdoolaxmsupil.supabase.co';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseKey) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY no está configurada');
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 Verificando detalles de mensajes salientes...\n');

// Obtener últimos 3 mensajes salientes
const { data: messages, error } = await supabase
  .from('whatsapp_messages')
  .select(`
    *,
    contacts:contact_id (
      name,
      phone_e164
    )
  `)
  .eq('direction', 'outbound')
  .order('created_at', { ascending: false })
  .limit(3);

if (error) {
  console.error('❌ Error:', error.message);
  Deno.exit(1);
}

if (!messages || messages.length === 0) {
  console.log('⚠️  No hay mensajes salientes');
  Deno.exit(0);
}

for (const msg of messages) {
  const time = new Date(msg.created_at).toLocaleString('es-CL');

  console.log(`📤 Mensaje enviado - ${time}`);
  console.log(`   Para: ${msg.contacts?.phone_e164 || 'Desconocido'}`);
  console.log(`   WhatsApp Message ID: ${msg.wa_message_id || 'N/A'}`);
  console.log(`   Estado: ${msg.status}`);
  console.log(`   Tipo: ${msg.message_type}`);
  console.log(`   Contenido:`, JSON.stringify(msg.content, null, 2));

  if (msg.sent_at) {
    console.log(`   Enviado en: ${new Date(msg.sent_at).toLocaleString('es-CL')}`);
  }

  if (msg.delivered_at) {
    console.log(`   ✅ Entregado: ${new Date(msg.delivered_at).toLocaleString('es-CL')}`);
  }

  if (msg.read_at) {
    console.log(`   👁️  Leído: ${new Date(msg.read_at).toLocaleString('es-CL')}`);
  }

  console.log('');
}