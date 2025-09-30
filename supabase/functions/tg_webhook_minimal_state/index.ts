// Webhook Telegram con Estado - Versión Minimalista
// Basado exactamente en tg_webhook_simple pero con estado conversacional

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

// Estados simples
const FLOWS = {
  NEW_LOAN: 'new_loan'
};

const STEPS = {
  INIT: 'init',
  AWAITING_CONTACT: 'awaiting_contact',
  AWAITING_ITEM: 'awaiting_item',
  AWAITING_DATE: 'awaiting_date',
  CONFIRMING: 'confirming',
  COMPLETE: 'complete'
};

async function getConversationState(supabase: any, tenantId: string, chatId: string) {
  try {
    // Intentar obtener estado activo
    const { data, error } = await supabase
      .from('telegram_conversation_states')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('chat_id', chatId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.log('Error getting conversation state (tabla probablemente no existe):', error);
      return null;
    }

    return data;
  } catch (error) {
    console.log('Exception getting conversation state:', error);
    return null;
  }
}

async function createConversationState(supabase: any, tenantId: string, chatId: string, userId: string, contactId: string) {
  try {
    const newState = {
      tenant_id: tenantId,
      chat_id: chatId,
      user_id: userId,
      contact_id: contactId,
      current_flow: FLOWS.NEW_LOAN,
      current_step: STEPS.INIT,
      context: {},
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hora
    };

    const { data, error } = await supabase
      .from('telegram_conversation_states')
      .insert(newState)
      .select()
      .single();

    if (error) {
      console.error('Error creating conversation state:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Exception creating conversation state:', error);
    return null;
  }
}

async function updateConversationState(supabase: any, conversationId: string, step: string, context: any) {
  try {
    const { error } = await supabase
      .from('telegram_conversation_states')
      .update({
        current_step: step,
        context: context,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      })
      .eq('id', conversationId);

    return !error;
  } catch (error) {
    console.error('Exception updating conversation state:', error);
    return false;
  }
}

async function processUpdate(update: TelegramUpdate, supabase: any) {
  try {
    console.log('Processing update:', update.update_id);

    // Extraer info del mensaje
    const chatId = update.message?.chat?.id;
    const userId = update.message?.from?.id;
    const userName = update.message?.from?.first_name;
    const username = update.message?.from?.username;
    const text = update.message?.text;

    if (!chatId || !userId) {
      console.error('Missing chat or user ID');
      return { success: false, error: 'Invalid update' };
    }

    // 1. Obtener tenant
    const tenantId = 'd4c43ab8-426f-4bb9-8736-dfe301459590';
    const { data: tenant } = await supabase
      .from('tenants')
      .select('telegram_bot_token')
      .eq('id', tenantId)
      .single();

    if (!tenant?.telegram_bot_token) {
      console.error('No Telegram token found');
      return { success: false, error: 'Bot not configured' };
    }

    // 2. Buscar o crear contacto
    let { data: contact } = await supabase
      .from('contacts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('telegram_id', userId.toString())
      .maybeSingle();

    if (!contact && text) {
      // Crear nuevo contacto
      console.log('Creating new contact for user:', userId);
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
        return { success: false, error: 'Failed to create contact: ' + contactError.message };
      }

      contact = newContact;
      console.log('Successfully created new contact:', contact?.id);
    }

    // 3. Procesar mensaje
    let responseText = '';

    if (text) {
      const lowerText = text.toLowerCase();

      // Comandos especiales
      if (lowerText === '/start' || lowerText === 'hola') {
        responseText = `¡Hola ${userName}! 👋 Soy tu asistente de recordatorios.\\n\\nPuedes escribir:\\n• "Nuevo préstamo" - Para registrar algo que prestaste\\n• "Estado" - Ver tus acuerdos activos\\n• "Ayuda" - Ver todos los comandos`;

      } else if (lowerText.includes('ayuda') || lowerText === '/ayuda' || lowerText === '/help') {
        responseText = `🤖 *Comandos disponibles:*\\n\\n• *Nuevo préstamo* - Registrar algo prestado\\n• *Estado* - Ver acuerdos activos\\n• *Cancelar* - Cancelar conversación actual\\n• *Ayuda* - Ver este mensaje`;

      } else if (lowerText === 'cancelar' || lowerText === 'cancel') {
        // Cancelar cualquier conversación activa
        await supabase
          .from('telegram_conversation_states')
          .delete()
          .eq('tenant_id', tenantId)
          .eq('chat_id', chatId.toString());

        responseText = '❌ Conversación cancelada. Puedes iniciar una nueva cuando gustes.';

      } else if (lowerText.includes('estado') || lowerText === '/estado') {
        // Consultar acuerdos activos
        if (contact) {
          const { data: agreements } = await supabase
            .from('agreements')
            .select('*')
            .eq('contact_id', contact.id)
            .neq('status', 'cancelled')
            .order('created_at', { ascending: false });

          if (agreements && agreements.length > 0) {
            responseText = `📋 *Tus acuerdos:*\\n\\n`;
            agreements.forEach((agreement, i) => {
              responseText += `${i + 1}. *${agreement.title}*\\n`;
              responseText += `   Tipo: ${agreement.type === 'loan' ? 'Préstamo' : 'Servicio'}\\n`;
              responseText += `   Estado: ${agreement.status}\\n`;
              if (agreement.due_date) {
                responseText += `   Vence: ${new Date(agreement.due_date).toLocaleDateString()}\\n`;
              }
              responseText += '\\n';
            });
          } else {
            responseText = '📝 No tienes acuerdos activos en este momento.';
          }
        }

      } else if (contact) {
        // LÓGICA DE FLUJO CONVERSACIONAL
        const currentState = await getConversationState(supabase, tenantId, chatId.toString());

        if (!currentState) {
          // No hay conversación activa, verificar si quiere iniciar una
          if (lowerText.includes('préstamo') || lowerText.includes('prestar')) {
            // Crear nueva conversación
            const newState = await createConversationState(supabase, tenantId, chatId.toString(), userId.toString(), contact.id);
            if (newState) {
              responseText = '¡Perfecto! Vamos a crear un nuevo préstamo. 📝\\n\\n¿A quién se lo vas a prestar? Puedes escribir su nombre o número de teléfono.';
            } else {
              responseText = 'Error creando conversación. Probablemente la tabla telegram_conversation_states no existe. Por favor créala primero.';
            }
          } else {
            responseText = `Recibido: "${text}"\\n\\nPara iniciar un préstamo, escribe "Nuevo préstamo"\\nPara ver comandos, escribe "ayuda"`;
          }
        } else {
          // Hay conversación activa, procesar según el paso
          const context = { ...currentState.context };

          switch (currentState.current_step) {
            case STEPS.INIT:
              await updateConversationState(supabase, currentState.id, STEPS.AWAITING_CONTACT, context);
              responseText = '¡Perfecto! Vamos a crear un nuevo préstamo. 📝\\n\\n¿A quién se lo vas a prestar? Puedes escribir su nombre o número de teléfono.';
              break;

            case STEPS.AWAITING_CONTACT:
              if (text.trim().length < 2) {
                responseText = 'Por favor ingresa un nombre válido. ¿A quién se lo vas a prestar?';
              } else {
                context.contact_info = text.trim();
                await updateConversationState(supabase, currentState.id, STEPS.AWAITING_ITEM, context);
                responseText = `Perfecto, el préstamo será para: *${text.trim()}*\\n\\n¿Qué le vas a prestar? Describe el objeto o dinero.`;
              }
              break;

            case STEPS.AWAITING_ITEM:
              if (text.trim().length < 3) {
                responseText = 'Por favor describe mejor lo que vas a prestar. ¿Qué es exactamente?';
              } else {
                context.item_description = text.trim();
                await updateConversationState(supabase, currentState.id, STEPS.AWAITING_DATE, context);
                responseText = `Excelente: *${text.trim()}*\\n\\n¿Cuándo debe devolvértelo? Puedes escribir una fecha (ej: "mañana", "15 de enero", "en una semana")`;
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
              } else {
                dateStr = text.trim();
              }

              context.due_date = dateStr;
              await updateConversationState(supabase, currentState.id, STEPS.CONFIRMING, context);

              const summary = `📋 *Resumen del préstamo:*\\n\\n` +
                `👤 Para: ${context.contact_info}\\n` +
                `📦 Qué: ${context.item_description}\\n` +
                `📅 Vence: ${dateStr}\\n\\n` +
                `¿Todo está correcto? Escribe "confirmar" para guardarlo.`;

              responseText = summary;
              break;

            case STEPS.CONFIRMING:
              if (['si', 'sí', 'yes', 'confirmar', 'ok', 'correcto'].includes(lowerText)) {
                // Completar conversación
                await updateConversationState(supabase, currentState.id, STEPS.COMPLETE, context);

                // Limpiar estado
                await supabase
                  .from('telegram_conversation_states')
                  .delete()
                  .eq('id', currentState.id);

                responseText = '✅ ¡Perfecto! Tu préstamo ha sido registrado.\\n\\nTe enviaré recordatorios automáticos cerca de la fecha de vencimiento.';
              } else {
                responseText = 'Por favor confirma escribiendo "si" o "confirmar" para guardar el préstamo, o "cancelar" para salir.';
              }
              break;

            default:
              responseText = 'Estado no reconocido. Escribe "cancelar" para empezar de nuevo.';
          }
        }
      }
    }

    // 4. Enviar respuesta
    if (responseText) {
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
        console.log('Response sent successfully');

        // Registrar mensaje en tabla messages
        if (contact) {
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
        }

        return { success: true };
      } else {
        console.error('Telegram API error:', result);
        return { success: false, error: result.description };
      }
    }

    return { success: true };

  } catch (error) {
    console.error('Error processing update:', error);
    return { success: false, error: error.message };
  }
}

serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    if (req.method === 'GET') {
      return new Response('Telegram minimal state webhook is running', {
        status: 200,
        headers: { 'Content-Type': 'text/plain', ...corsHeaders }
      });
    }

    if (req.method === 'POST') {
      const body = await req.text();
      const update: TelegramUpdate = JSON.parse(body);

      // Initialize Supabase - IGUAL que en tg_webhook_simple
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Process update
      const result = await processUpdate(update, supabase);

      return new Response(JSON.stringify({
        success: result.success,
        update_id: update.update_id,
        processed: true,
        error: result.error
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