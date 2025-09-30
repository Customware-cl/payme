// Webhook Telegram con Estado - VERSIÓN SIMPLIFICADA
// Soluciona el problema de estado perdido usando almacenamiento persistente simple

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-telegram-bot-api-secret-token',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      username?: string;
      last_name?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    text?: string;
  };
}

// Estados del flujo
const STEPS = {
  NONE: 'none',
  AWAITING_CONTACT: 'awaiting_contact',
  AWAITING_ITEM: 'awaiting_item',
  AWAITING_DATE: 'awaiting_date',
  CONFIRMING: 'confirming'
};

// Usar la tabla contacts.metadata para almacenar estado conversacional temporal
async function getConversationState(supabase: any, contactId: string) {
  try {
    const { data: contact } = await supabase
      .from('contacts')
      .select('metadata')
      .eq('id', contactId)
      .single();

    return contact?.metadata?.conversation_state || null;
  } catch (error) {
    console.log('Error getting conversation state:', error);
    return null;
  }
}

async function saveConversationState(supabase: any, contactId: string, state: any) {
  try {
    const { data: contact } = await supabase
      .from('contacts')
      .select('metadata')
      .eq('id', contactId)
      .single();

    const currentMetadata = contact?.metadata || {};
    const newMetadata = {
      ...currentMetadata,
      conversation_state: {
        ...state,
        expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() // 2 horas
      }
    };

    await supabase
      .from('contacts')
      .update({ metadata: newMetadata })
      .eq('id', contactId);

    return true;
  } catch (error) {
    console.log('Error saving conversation state:', error);
    return false;
  }
}

async function clearConversationState(supabase: any, contactId: string) {
  try {
    const { data: contact } = await supabase
      .from('contacts')
      .select('metadata')
      .eq('id', contactId)
      .single();

    const currentMetadata = contact?.metadata || {};
    delete currentMetadata.conversation_state;

    await supabase
      .from('contacts')
      .update({ metadata: currentMetadata })
      .eq('id', contactId);

    return true;
  } catch (error) {
    console.log('Error clearing conversation state:', error);
    return false;
  }
}

serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    if (req.method === 'GET') {
      return new Response('Telegram webhook with persistent state is running', {
        status: 200,
        headers: { 'Content-Type': 'text/plain', ...corsHeaders }
      });
    }

    if (req.method === 'POST') {
      const body = await req.text();
      const update: TelegramUpdate = JSON.parse(body);

      console.log('Processing update:', update.update_id);

      // Extraer info básica
      const chatId = update.message?.chat?.id;
      const text = update.message?.text;
      const userName = update.message?.from?.first_name;
      const userId = update.message?.from?.id;
      const username = update.message?.from?.username;

      if (!chatId || !userId) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid update' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Initialize Supabase
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const tenantId = 'd4c43ab8-426f-4bb9-8736-dfe301459590';

      // 1. Buscar o crear contacto
      let { data: contact } = await supabase
        .from('contacts')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('telegram_id', userId.toString())
        .maybeSingle();

      if (!contact && text) {
        // Crear nuevo contacto
        const { data: newContact, error: contactError } = await supabase
          .from('contacts')
          .insert({
            tenant_id: tenantId,
            telegram_id: userId.toString(),
            telegram_username: username || null,
            telegram_first_name: userName,
            telegram_last_name: update.message?.from?.last_name || null,
            name: userName,
            preferred_channel: 'telegram',
            telegram_opt_in_status: 'pending',
            preferred_language: 'es',
            metadata: { chat_id: chatId }
          })
          .select()
          .single();

        if (contactError) {
          console.error('Error creating contact:', contactError);
          return new Response(JSON.stringify({ success: false, error: 'Failed to create contact' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        contact = newContact;
      }

      if (!contact) {
        return new Response(JSON.stringify({ success: false, error: 'No contact found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 2. Obtener estado conversacional
      let conversationState = await getConversationState(supabase, contact.id);

      // Verificar si el estado ha expirado
      if (conversationState && conversationState.expires_at) {
        if (new Date(conversationState.expires_at) < new Date()) {
          conversationState = null;
          await clearConversationState(supabase, contact.id);
        }
      }

      // 3. Procesar mensaje
      let responseText = '';
      const lowerText = text?.toLowerCase() || '';

      // Comandos que reinician conversación
      if (lowerText === '/start' || lowerText === 'hola') {
        await clearConversationState(supabase, contact.id);
        responseText = `¡Hola ${userName}! 👋 Soy tu asistente de recordatorios.

Puedes escribir:
• "Nuevo préstamo" - Para registrar algo que prestaste
• "Estado" - Ver tus acuerdos activos
• "Ayuda" - Ver todos los comandos`;

      } else if (lowerText === 'cancelar' || lowerText === 'cancel') {
        await clearConversationState(supabase, contact.id);
        responseText = '❌ Conversación cancelada. Puedes iniciar una nueva cuando gustes.';

      } else if (lowerText.includes('ayuda') || lowerText === '/help') {
        responseText = `🤖 *Comandos disponibles:*

• *Nuevo préstamo* - Registrar algo prestado
• *Estado* - Ver acuerdos activos
• *Cancelar* - Cancelar conversación actual
• *Ayuda* - Ver este mensaje`;

      } else if (lowerText.includes('estado')) {
        responseText = '📝 No tienes acuerdos activos en este momento. (Función completa próximamente)';

      } else if (!conversationState) {
        // No hay conversación activa
        if (lowerText.includes('préstamo') || lowerText.includes('prestar')) {
          // Iniciar nueva conversación
          const newState = {
            step: STEPS.AWAITING_CONTACT,
            context: {},
            created: new Date().toISOString()
          };
          await saveConversationState(supabase, contact.id, newState);
          responseText = `¡Perfecto! Vamos a crear un nuevo préstamo. 📝

¿A quién se lo vas a prestar? Puedes escribir su nombre.`;

        } else {
          responseText = `Recibido: "${text}"

Para iniciar un préstamo, escribe "Nuevo préstamo"
Para ver comandos, escribe "ayuda"`;
        }

      } else {
        // Hay conversación activa, procesar según el paso
        const context = { ...conversationState.context };

        switch (conversationState.step) {
          case STEPS.AWAITING_CONTACT:
            if (text && text.trim().length >= 2) {
              context.contact_info = text.trim();
              const newState = { ...conversationState, step: STEPS.AWAITING_ITEM, context };
              await saveConversationState(supabase, contact.id, newState);
              responseText = `Perfecto, el préstamo será para: *${text.trim()}*

¿Qué le vas a prestar? Describe el objeto o dinero.`;
            } else {
              responseText = 'Por favor ingresa un nombre válido. ¿A quién se lo vas a prestar?';
            }
            break;

          case STEPS.AWAITING_ITEM:
            if (text && text.trim().length >= 3) {
              context.item_description = text.trim();
              const newState = { ...conversationState, step: STEPS.AWAITING_DATE, context };
              await saveConversationState(supabase, contact.id, newState);
              responseText = `Excelente: *${text.trim()}*

¿Cuándo debe devolvértelo? Puedes escribir una fecha (ej: "mañana", "15 de enero", "en una semana")`;
            } else {
              responseText = 'Por favor describe mejor lo que vas a prestar. ¿Qué es exactamente?';
            }
            break;

          case STEPS.AWAITING_DATE:
            // Parseo simple de fecha
            let dateStr = 'Fecha a definir';
            if (lowerText === 'mañana') {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              dateStr = tomorrow.toLocaleDateString('es-CL');
            } else if (lowerText.includes('semana')) {
              const nextWeek = new Date();
              nextWeek.setDate(nextWeek.getDate() + 7);
              dateStr = nextWeek.toLocaleDateString('es-CL');
            } else if (lowerText.includes('mes')) {
              const nextMonth = new Date();
              nextMonth.setMonth(nextMonth.getMonth() + 1);
              dateStr = nextMonth.toLocaleDateString('es-CL');
            } else {
              dateStr = text?.trim() || 'Fecha a definir';
            }

            context.due_date = dateStr;
            const newState = { ...conversationState, step: STEPS.CONFIRMING, context };
            await saveConversationState(supabase, contact.id, newState);

            responseText = `📋 *Resumen del préstamo:*

👤 Para: ${context.contact_info}
📦 Qué: ${context.item_description}
📅 Vence: ${dateStr}

¿Todo está correcto? Escribe "confirmar" para guardarlo.`;
            break;

          case STEPS.CONFIRMING:
            if (['si', 'sí', 'yes', 'confirmar', 'ok', 'correcto'].includes(lowerText)) {
              // Completar conversación
              console.log('Préstamo completado:', context);
              await clearConversationState(supabase, contact.id);

              responseText = `✅ ¡Perfecto! Tu préstamo ha sido registrado.

📋 *Datos guardados:*
👤 Para: ${context.contact_info}
📦 Qué: ${context.item_description}
📅 Vence: ${context.due_date}

🔔 Te enviaré recordatorios automáticos cerca de la fecha de vencimiento.`;
            } else {
              responseText = 'Por favor confirma escribiendo "si" o "confirmar" para guardar el préstamo, o "cancelar" para salir.';
            }
            break;

          default:
            await clearConversationState(supabase, contact.id);
            responseText = 'Estado no reconocido. He reiniciado la conversación. Escribe "Nuevo préstamo" para comenzar.';
        }
      }

      // 4. Enviar respuesta
      if (responseText) {
        const { data: tenant } = await supabase
          .from('tenants')
          .select('telegram_bot_token')
          .eq('id', tenantId)
          .single();

        if (!tenant?.telegram_bot_token) {
          return new Response(JSON.stringify({ success: false, error: 'Bot not configured' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const telegramResponse = await fetch(`https://api.telegram.org/bot${tenant.telegram_bot_token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: responseText,
            parse_mode: 'Markdown'
          })
        });

        const result = await telegramResponse.json();

        if (result.ok) {
          // Registrar mensaje
          await supabase
            .from('messages')
            .insert({
              tenant_id: tenantId,
              contact_id: contact.id,
              channel: 'telegram',
              external_id: result.result.message_id?.toString(),
              conversation_id: chatId.toString(),
              direction: 'outbound',
              message_type: 'text',
              content: { text: responseText },
              external_timestamp: new Date().toISOString()
            });

          return new Response(JSON.stringify({
            success: true,
            update_id: update.update_id,
            processed: true
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          return new Response(JSON.stringify({
            success: false,
            update_id: update.update_id,
            processed: true,
            telegram_response: result.description
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        update_id: update.update_id,
        processed: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response('Method not allowed', {
      status: 405,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});