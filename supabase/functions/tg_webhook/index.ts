// Edge Function: Telegram Webhook Handler
// Integración pragmática con ConversationManager existente

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ConversationManager } from "../_shared/conversation-manager.ts";
import { FlowHandlers } from "../_shared/flow-handlers.ts";
import { IntentDetector } from "../_shared/intent-detector.ts";
import { TelegramClient, TelegramUpdate, TelegramMessageAdapter } from "../_shared/telegram-client.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-telegram-bot-api-secret-token',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

async function processInboundMessage(
  update: TelegramUpdate,
  supabase: any
) {
  try {
    console.log('Processing Telegram update:', JSON.stringify(update, null, 2));

    // Extraer información del mensaje
    const chatId = update.message?.chat?.id || update.callback_query?.from?.id;
    const userId = update.message?.from?.id || update.callback_query?.from?.id;
    const userName = update.message?.from?.first_name || update.callback_query?.from?.first_name;
    const username = update.message?.from?.username || update.callback_query?.from?.username;

    console.log('Extracted info:', { chatId, userId, userName, username });

    if (!chatId || !userId) {
      console.error('Invalid Telegram update - missing required fields');
      return { success: false, error: 'Invalid update' };
    }

    // 1. Obtener tenant - usar el tenant principal conocido
    const tenantId = 'd4c43ab8-426f-4bb9-8736-dfe301459590';
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    console.log('Tenant query result:', { tenant: tenant?.name, error: tenantError });

    if (!tenant) {
      console.error('Tenant not found:', tenantError);
      return { success: false, error: 'Tenant not found' };
    }

    // 2. Buscar contacto existente primero
    let { data: existingContact } = await supabase
      .from('contacts')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('telegram_id', userId.toString())
      .single();

    let contactId = existingContact?.id;

    if (!contactId) {
      // Crear nuevo contacto
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          tenant_id: tenant.id,
          telegram_id: userId.toString(),
          telegram_username: username,
          telegram_first_name: userName,
          telegram_last_name: update.message?.from?.last_name || update.callback_query?.from?.last_name,
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
        return { success: false, error: 'Failed to create contact' };
      }

      contactId = newContact?.id;
      console.log('Created new Telegram contact:', contactId);
    } else {
      console.log('Found existing contact:', contactId);
    }

    if (!contactId) {
      throw new Error('Failed to create contact');
    }

    // Obtener datos completos del contacto
    const { data: contact } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .single();

    // 3. Registrar mensaje entrante en tabla unificada
    const messageContent = {
      text: update.message?.text,
      callback_data: update.callback_query?.data,
      telegram_update_id: update.update_id
    };

    await supabase
      .from('messages')
      .insert({
        tenant_id: tenant.id,
        contact_id: contactId,
        channel: 'telegram',
        external_id: update.message?.message_id?.toString() || `callback_${update.callback_query?.id}`,
        conversation_id: chatId.toString(),
        direction: 'inbound',
        message_type: update.message ? 'text' : 'callback_query',
        content: messageContent,
        external_timestamp: new Date().toISOString()
      });

    // 4. Procesar mensaje usando el sistema existente
    let responseMessage = null;
    const telegram = new TelegramClient(tenant.telegram_bot_token);

    // Extraer texto del update
    const inputText = TelegramMessageAdapter.extractTextFromUpdate(update);

    if (update.message?.text) {
      // Mensaje de texto normal
      const text = inputText.trim();
      const lowerText = text.toLowerCase();

      // Comandos especiales - misma lógica que WhatsApp
      if (lowerText === 'hola' || lowerText === 'hi' || lowerText === '/start') {
        responseMessage = '¡Hola! 👋 Soy tu asistente de recordatorios.\n\nPuedes escribir cosas como:\n• "Nuevo préstamo" - Para registrar algo que prestaste\n• "Reprogramar" - Para cambiar una fecha\n• "Servicio mensual" - Para cobros recurrentes\n• "Estado" - Ver tus acuerdos activos\n\n¿En qué puedo ayudarte?';
      } else if (lowerText === 'ayuda' || lowerText === 'help' || lowerText === '/help') {
        responseMessage = '🤖 *Comandos disponibles:*\n\n• *Nuevo préstamo* - Registrar algo prestado\n• *Reprogramar* - Cambiar fecha de vencimiento\n• *Servicio mensual* - Configurar cobros recurrentes\n• *Estado* - Ver acuerdos activos\n• *Cancelar* - Cancelar conversación actual\n\nTambién puedes responder a los recordatorios con los botones.';
      } else if (lowerText === 'estado' || lowerText === 'status') {
        const { data: agreements } = await supabase
          .from('agreements')
          .select('*')
          .eq('contact_id', contactId)
          .eq('status', 'active');

        if (!agreements || agreements.length === 0) {
          responseMessage = 'No tienes acuerdos activos en este momento.';
        } else {
          let statusText = '*📋 Tus acuerdos activos:*\n\n';
          agreements.forEach((agreement: any, index: number) => {
            statusText += `${index + 1}. *${agreement.title}*\n`;
            statusText += `   Tipo: ${agreement.type === 'loan' ? 'Préstamo' : 'Servicio'}\n`;
            if (agreement.due_date) {
              statusText += `   Vence: ${new Date(agreement.due_date).toLocaleDateString()}\n`;
            }
            if (agreement.amount) {
              statusText += `   Monto: $${agreement.amount} ${agreement.currency}\n`;
            }
            statusText += '\n';
          });
          responseMessage = statusText;
        }
      } else if (lowerText === 'cancelar' || lowerText === 'cancel') {
        const conversationManager = new ConversationManager(supabase.supabaseUrl, supabase.supabaseKey);
        await conversationManager.cancelCurrentConversation(tenant.id, contactId);
        responseMessage = '❌ Conversación cancelada. Puedes iniciar una nueva cuando gustes.';
      }

      // Si no hay respuesta específica, procesar con ConversationManager
      if (!responseMessage) {
        try {
          const conversationManager = new ConversationManager(supabase.supabaseUrl, supabase.supabaseKey);
          const intentDetector = new IntentDetector();

          // Detectar intención si no hay conversación activa
          const currentState = await conversationManager.getCurrentState(tenant.id, contactId);
          let flowType = null;

          if (!currentState) {
            const intentResult = intentDetector.detectIntent(text);
            flowType = intentResult.intent;

            if (intentResult.confidence < 0.6) {
              const suggestions = intentDetector.getSuggestions(text);
              responseMessage = `No estoy seguro de lo que necesitas. ¿Te refieres a alguno de estos?\n\n${suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nO escribe "ayuda" para ver todas las opciones.`;
            }
          }

          if (!responseMessage) {
            const result = await conversationManager.processInput(tenant.id, contactId, text, flowType);

            if (result.success) {
              if (result.completed && result.context) {
                // Flujo completado - ejecutar handler
                const flowHandlers = new FlowHandlers(supabase.supabaseUrl, supabase.supabaseKey);
                const currentState = await conversationManager.getCurrentState(tenant.id, contactId);
                const completedFlowType = currentState?.flow_type;

                let handlerResult = null;
                switch (completedFlowType) {
                  case 'new_loan':
                    handlerResult = await flowHandlers.handleNewLoanFlow(tenant.id, contactId, result.context);
                    break;
                  case 'reschedule':
                    handlerResult = await flowHandlers.handleRescheduleFlow(tenant.id, contactId, result.context);
                    break;
                  case 'new_service':
                    handlerResult = await flowHandlers.handleNewServiceFlow(tenant.id, contactId, result.context);
                    break;
                  default:
                    handlerResult = { success: true };
                }

                if (handlerResult.success) {
                  responseMessage = result.message || '✅ Proceso completado exitosamente.';
                } else {
                  responseMessage = `❌ Error al completar el proceso: ${handlerResult.error}`;
                }
              } else {
                responseMessage = result.message || 'Continuemos...';
              }
            } else {
              responseMessage = result.message || result.error || 'No entendí tu respuesta. ¿Puedes ser más específico?';
            }
          }
        } catch (error) {
          console.error('Error in conversation flow:', error);
          responseMessage = 'Hubo un error procesando tu mensaje. Por favor intenta de nuevo o escribe "ayuda".';
        }
      }

    } else if (update.callback_query) {
      // Respuesta a botón inline
      const callbackData = update.callback_query.data;

      // Responder al callback query (requerido por Telegram)
      await telegram.answerCallbackQuery(update.callback_query.id);

      // Registrar evento de click
      await supabase
        .from('events')
        .insert({
          tenant_id: tenant.id,
          contact_id: contactId,
          event_type: 'button_clicked',
          payload: { button_data: callbackData, callback_query_id: update.callback_query.id }
        });

      // Procesar según el callback data - misma lógica que WhatsApp
      switch (callbackData) {
        case 'opt_in_yes':
          await supabase
            .from('contacts')
            .update({
              telegram_opt_in_status: 'opted_in',
              telegram_opt_in_date: new Date().toISOString()
            })
            .eq('id', contactId);

          await supabase
            .from('events')
            .insert({
              tenant_id: tenant.id,
              contact_id: contactId,
              event_type: 'opt_in_received',
              payload: { opted_in: true, channel: 'telegram', timestamp: new Date().toISOString() }
            });

          responseMessage = '✅ ¡Perfecto! Ahora recibirás recordatorios por Telegram. Puedes cambiar esta preferencia en cualquier momento.';
          break;

        case 'opt_in_no':
          await supabase
            .from('contacts')
            .update({
              telegram_opt_in_status: 'opted_out',
              telegram_opt_out_date: new Date().toISOString()
            })
            .eq('id', contactId);

          responseMessage = '👋 Entendido. No recibirás más recordatorios por Telegram. Si cambias de opinión, puedes contactarnos.';
          break;

        case 'loan_returned':
          // Buscar préstamo activo más reciente
          const { data: loanAgreement } = await supabase
            .from('agreements')
            .select('*')
            .eq('contact_id', contactId)
            .eq('type', 'loan')
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (loanAgreement) {
            await supabase
              .from('agreements')
              .update({
                status: 'completed',
                completed_at: new Date().toISOString()
              })
              .eq('id', loanAgreement.id);

            await supabase
              .from('events')
              .insert({
                tenant_id: tenant.id,
                contact_id: contactId,
                agreement_id: loanAgreement.id,
                event_type: 'confirmed_returned',
                payload: {
                  contact_name: contact.name,
                  agreement_title: loanAgreement.title,
                  confirmed_at: new Date().toISOString(),
                  channel: 'telegram'
                }
              });

            responseMessage = `✅ ¡Perfecto! He registrado que devolviste "${loanAgreement.item_description}". ¡Gracias!`;
          } else {
            responseMessage = 'No encontré un préstamo activo. Si hay algún error, contacta directamente.';
          }
          break;

        case 'paid_cash':
          responseMessage = '✅ Pago en efectivo registrado. ¡Gracias!';
          break;

        default:
          // Si es un callback desconocido, pasarlo al ConversationManager como texto
          const conversationManager = new ConversationManager(supabase.supabaseUrl, supabase.supabaseKey);
          const result = await conversationManager.processInput(tenant.id, contactId, callbackData);
          responseMessage = result.message || 'Opción procesada.';
      }
    }

    // 5. Enviar respuesta por Telegram
    if (responseMessage) {
      try {
        // Adaptar mensaje para Telegram si viene del ConversationManager
        const adaptedMessage = TelegramMessageAdapter.adaptMessage(responseMessage);

        const sendResult = await telegram.sendMessage(
          chatId,
          adaptedMessage.text,
          {
            reply_markup: adaptedMessage.keyboard
          }
        );

        if (sendResult.success) {
          console.log('Telegram response sent successfully:', { messageId: sendResult.messageId });

          // Registrar mensaje saliente
          await supabase
            .from('messages')
            .insert({
              tenant_id: tenant.id,
              contact_id: contactId,
              channel: 'telegram',
              external_id: sendResult.messageId?.toString(),
              conversation_id: chatId.toString(),
              direction: 'outbound',
              message_type: 'text',
              content: { text: adaptedMessage.text, keyboard: adaptedMessage.keyboard },
              external_timestamp: new Date().toISOString()
            });

        } else {
          console.error('Failed to send Telegram response:', sendResult.error);
        }

      } catch (error) {
        console.error('Error sending Telegram message:', error);
      }
    }

    return { success: true };

  } catch (error) {
    console.error('Error processing Telegram message:', error);
    return { success: false, error: error.message };
  }
}

serve(async (req: Request) => {
  try {
    const url = new URL(req.url);

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    // GET: Health check para Telegram
    if (req.method === 'GET') {
      return new Response('Telegram webhook is running', {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // POST: Process incoming Telegram updates
    if (req.method === 'POST') {
      const body = await req.text();
      const update: TelegramUpdate = JSON.parse(body);

      console.log('Telegram webhook received:', JSON.stringify(update, null, 2));

      // Verificar secret token si está configurado
      const secretToken = req.headers.get('x-telegram-bot-api-secret-token');
      const expectedSecret = Deno.env.get('TELEGRAM_SECRET_TOKEN');

      if (expectedSecret && secretToken !== expectedSecret) {
        console.warn('Invalid Telegram secret token');
        return new Response('Unauthorized', { status: 401 });
      }

      // Initialize Supabase client
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Process the update
      const result = await processInboundMessage(update, supabase);

      const response = {
        success: result.success,
        update_id: update.update_id,
        processed: true
      };

      console.log('Telegram webhook processing completed:', response);

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response('Method not allowed', {
      status: 405,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Telegram webhook processing failed:', error);

    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});