#!/usr/bin/env -S deno run --allow-net --allow-env

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = 'https://qgjxkszfdoolaxmsupil.supabase.co';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseKey) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY no está configurada');
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🧹 Limpiando estados de conversación...\n');

// Primero, eliminar TODOS los estados (más simple y efectivo)
const { data: deleted, error } = await supabase
  .from('conversation_states')
  .delete()
  .select('id')
  .neq('id', '00000000-0000-0000-0000-000000000000'); // Truco para seleccionar todos

if (error) {
  console.error('❌ Error al limpiar estados:', error.message);
  Deno.exit(1);
}

const count = deleted?.length || 0;
console.log(`✅ Se eliminaron ${count} estado(s) de conversación`);

// Mostrar estados activos restantes
const { data: active, error: activeError } = await supabase
  .from('conversation_states')
  .select('*');

if (activeError) {
  console.error('❌ Error al consultar estados activos:', activeError.message);
} else {
  console.log(`\n📊 Estados activos restantes: ${active?.length || 0}`);

  if (active && active.length > 0) {
    for (const state of active) {
      console.log(`   - Flujo: ${state.flow_type}, Paso: ${state.current_step}, Expira: ${new Date(state.expires_at).toLocaleString('es-CL')}`);
    }
  }
}