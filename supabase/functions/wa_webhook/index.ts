// Edge Function: WhatsApp Webhook Handler
// Versión con flujos conversacionales integrados

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ConversationManager } from "../_shared/conversation-manager.ts";
import { FlowHandlers } from "../_shared/flow-handlers.ts";
import { IntentDetector } from "../_shared/intent-detector.ts";
import { WhatsAppWindowManager } from "../_shared/whatsapp-window-manager.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// Tipos básicos para WhatsApp
interface WhatsAppWebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      metadata: {
        display_phone_number: string;
        phone_number_id: string;
      };
      contacts?: Array<{
        profile: { name: string };
        wa_id: string;
      }>;
      messages?: Array<{
        from: string;
        id: string;
        timestamp: string;
        type: string;
        text?: { body: string };
        interactive?: any;
        button?: any;
      }>;
      statuses?: Array<{
        id: string;
        status: string;
        timestamp: string;
        recipient_id: string;
      }>;
    };
    field: string;
  }>;
}

// Funciones auxiliares
function verifyWebhookToken(mode: string, token: string, challenge: string, verifyToken: string): string | null {
  if (mode === 'subscribe' && token === verifyToken) {
    return challenge;
  }
  return null;
}

function parsePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');

  // Para números chilenos (56) mantener formato correcto
  if (cleaned.startsWith('56')) {
    return '+' + cleaned;
  }

  // Para números mexicanos (52) mantener formato
  if (cleaned.startsWith('52')) {
    return '+' + cleaned;
  }

  // Para otros números, agregar código por defecto basado en longitud
  if (cleaned.length === 9 && !cleaned.startsWith('56')) {
    // Números de 9 dígitos sin código país - asumir Chile
    return '+56' + cleaned;
  }

  // Para números que ya tienen código país válido, mantener
  return '+' + cleaned;
}

async function processInboundMessage(
  message: any,
  contacts: any[],
  phoneNumberId: string,
  supabase: any
) {
  try {
    console.log('Processing message:', message.id, 'from:', message.from);

    // 1. Obtener tenant por phone_number_id
    const { data: tenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('whatsapp_phone_number_id', phoneNumberId)
      .single();

    if (!tenant) {
      console.error('Tenant not found for phone number ID:', phoneNumberId);
      return { success: false, error: 'Tenant not found' };
    }

    // 2. Obtener o crear contacto
    const formattedPhone = parsePhoneNumber(message.from);
    const contactName = contacts[0]?.profile?.name || 'Usuario';

    let { data: contact } = await supabase
      .from('contacts')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('phone_e164', formattedPhone)
      .single();

    if (!contact) {
      const { data: newContact } = await supabase
        .from('contacts')
        .insert({
          tenant_id: tenant.id,
          phone_e164: formattedPhone,
          name: contactName,
          whatsapp_id: message.from,
          opt_in_status: 'pending',
          preferred_language: 'es',
          metadata: {}
        })
        .select()
        .single();

      contact = newContact;
      console.log('Created new contact:', contact?.id);
    }

    if (!contact) {
      throw new Error('Failed to create contact');
    }

    // 3. Registrar mensaje entrante
    await supabase
      .from('whatsapp_messages')
      .insert({
        tenant_id: tenant.id,
        contact_id: contact.id,
        wa_message_id: message.id,
        direction: 'inbound',
        message_type: message.type,
        content: { text: message.text, interactive: message.interactive, button: message.button }
      });

    // 4. Procesar según tipo de mensaje usando flujos conversacionales
    let responseMessage = null;

    if (message.type === 'text') {
      const text = message.text?.body?.trim() || '';

      // Comandos especiales que no requieren flujos
      const lowerText = text.toLowerCase();
      if (lowerText === 'hola' || lowerText === 'hi') {
        responseMessage = '¡Hola! 👋 Soy tu asistente de recordatorios.\n\nPuedes escribir cosas como:\n• "Nuevo préstamo" - Para registrar algo que prestaste\n• "Reprogramar" - Para cambiar una fecha\n• "Servicio mensual" - Para cobros recurrentes\n• "Estado" - Ver tus acuerdos activos\n\n¿En qué puedo ayudarte?';
      } else if (lowerText === 'ayuda' || lowerText === 'help') {
        responseMessage = '🤖 *Comandos disponibles:*\n\n• *Nuevo préstamo* - Registrar algo prestado\n• *Reprogramar* - Cambiar fecha de vencimiento\n• *Servicio mensual* - Configurar cobros recurrentes\n• *Estado* - Ver acuerdos activos\n• *Cancelar* - Cancelar conversación actual\n\nTambién puedes responder a los recordatorios con los botones.';
      } else if (lowerText === 'estado' || lowerText === 'status') {
        const { data: agreements } = await supabase
          .from('agreements')
          .select('*')
          .eq('contact_id', contact.id)
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
        // Cancelar conversación activa
        const conversationManager = new ConversationManager(supabase.supabaseUrl, supabase.supabaseKey);
        await conversationManager.cancelCurrentConversation(tenant.id, contact.id);
        responseMessage = '❌ Conversación cancelada. Puedes iniciar una nueva cuando gustes.';
      }

      // Si no se asignó responseMessage, procesar con sistema de flujos conversacionales
      if (!responseMessage) {
        try {
          const conversationManager = new ConversationManager(supabase.supabaseUrl, supabase.supabaseKey);
          const intentDetector = new IntentDetector();

          // Detectar intención si no hay conversación activa
          const currentState = await conversationManager.getCurrentState(tenant.id, contact.id);
          let flowType = null;

          if (!currentState) {
            const intentResult = intentDetector.detectIntent(text);
            flowType = intentResult.intent;

            // Si la confianza es baja, ofrecer ayuda
            if (intentResult.confidence < 0.6) {
              const suggestions = intentDetector.getSuggestions(text);
              responseMessage = `No estoy seguro de lo que necesitas. ¿Te refieres a alguno de estos?\n\n${suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nO escribe "ayuda" para ver todas las opciones.`;
            }
          }

          if (!responseMessage) {
            // Procesar entrada en el flujo
            const result = await conversationManager.processInput(tenant.id, contact.id, text, flowType);

            if (result.success) {
              if (result.completed && result.context) {
                // Flujo completado - ejecutar handler específico
                const flowHandlers = new FlowHandlers(supabase.supabaseUrl, supabase.supabaseKey);

                const currentState = await conversationManager.getCurrentState(tenant.id, contact.id);
                const completedFlowType = currentState?.flow_type;

                let handlerResult = null;
                switch (completedFlowType) {
                  case 'new_loan':
                    handlerResult = await flowHandlers.handleNewLoanFlow(tenant.id, contact.id, result.context);
                    break;
                  case 'reschedule':
                    handlerResult = await flowHandlers.handleRescheduleFlow(tenant.id, contact.id, result.context);
                    break;
                  case 'new_service':
                    handlerResult = await flowHandlers.handleNewServiceFlow(tenant.id, contact.id, result.context);
                    break;
                  default:
                    // Para confirm_return, confirm_payment, general_inquiry no necesitan handlers especiales
                    handlerResult = { success: true };
                }

                if (handlerResult.success) {
                  responseMessage = result.message || '✅ Proceso completado exitosamente.';
                } else {
                  responseMessage = `❌ Error al completar el proceso: ${handlerResult.error}`;
                }
              } else {
                // Continuar con el flujo
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
    } else if (message.type === 'interactive' || message.type === 'button') {
      // Procesar respuestas de botones
      let buttonId = '';

      if (message.interactive?.button_reply) {
        buttonId = message.interactive.button_reply.id;
      } else if (message.button) {
        buttonId = message.button.payload;
      }

      // Registrar evento de click
      await supabase
        .from('events')
        .insert({
          tenant_id: tenant.id,
          contact_id: contact.id,
          event_type: 'button_clicked',
          payload: { button_id: buttonId, message_id: message.id },
          whatsapp_message_id: message.id
        });

      // Procesar según botón
      switch (buttonId) {
        case 'opt_in_yes':
          await supabase
            .from('contacts')
            .update({
              opt_in_status: 'opted_in',
              opt_in_date: new Date().toISOString()
            })
            .eq('id', contact.id);

          await supabase
            .from('events')
            .insert({
              tenant_id: tenant.id,
              contact_id: contact.id,
              event_type: 'opt_in_received',
              payload: { opted_in: true, timestamp: new Date().toISOString() }
            });

          responseMessage = '✅ ¡Perfecto! Ahora recibirás recordatorios por WhatsApp. Puedes cambiar esta preferencia en cualquier momento.';
          break;

        case 'opt_in_no':
          await supabase
            .from('contacts')
            .update({
              opt_in_status: 'opted_out',
              opt_out_date: new Date().toISOString()
            })
            .eq('id', contact.id);

          responseMessage = '👋 Entendido. No recibirás más recordatorios por WhatsApp. Si cambias de opinión, puedes contactarnos.';
          break;

        case 'loan_returned':
          // Buscar préstamo activo más reciente
          const { data: loanAgreement } = await supabase
            .from('agreements')
            .select('*')
            .eq('contact_id', contact.id)
            .eq('type', 'loan')
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (loanAgreement) {
            // Marcar como completado
            await supabase
              .from('agreements')
              .update({
                status: 'completed',
                completed_at: new Date().toISOString()
              })
              .eq('id', loanAgreement.id);

            // Registrar evento
            await supabase
              .from('events')
              .insert({
                tenant_id: tenant.id,
                contact_id: contact.id,
                agreement_id: loanAgreement.id,
                event_type: 'confirmed_returned',
                payload: {
                  contact_name: contact.name,
                  agreement_title: loanAgreement.title,
                  confirmed_at: new Date().toISOString()
                }
              });

            // Cancelar recordatorios pendientes
            await supabase
              .from('reminder_instances')
              .update({ status: 'cancelled' })
              .in('reminder_id',
                supabase
                  .from('reminders')
                  .select('id')
                  .eq('agreement_id', loanAgreement.id)
              )
              .eq('status', 'pending');

            responseMessage = `✅ ¡Perfecto! He registrado que devolviste "${loanAgreement.item_description}". ¡Gracias!`;
          } else {
            responseMessage = 'No encontré un préstamo activo. Si hay algún error, contacta directamente.';
          }
          break;

        case 'paid_cash':
          responseMessage = '✅ Pago en efectivo registrado. ¡Gracias!';
          break;

        default:
          responseMessage = 'No reconozco esa opción. Por favor usa los botones disponibles.';
      }
    }

    // 5. Enviar respuesta usando Window Manager para respetar ventana 24h
    if (responseMessage) {
      try {
        const windowManager = new WhatsAppWindowManager(supabase.supabaseUrl, supabase.supabaseKey);

        const sendResult = await windowManager.sendMessage(
          tenant.id,
          contact.id,
          responseMessage,
          { priority: 'high' }
        );

        if (sendResult.success) {
          if (sendResult.sent) {
            console.log('Response sent successfully:', { messageId: sendResult.messageId });
          } else if (sendResult.queued) {
            console.log('Response queued for later delivery:', { queueId: sendResult.queueId });
          }
        } else {
          console.error('Failed to send response:', sendResult.error);
        }

        // Log window status for monitoring
        console.log('Window status:', {
          isOpen: sendResult.windowStatus.isOpen,
          canSendFreeForm: sendResult.windowStatus.canSendFreeForm,
          expiresAt: sendResult.windowStatus.expiresAt
        });

      } catch (error) {
        console.error('Error with Window Manager:', error);
        // Fallback: log the message that would have been sent
        console.log('Fallback - Would send response:', responseMessage);
      }
    }

    return { success: true };

  } catch (error) {
    console.error('Error processing message:', error);
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

    // GET: Webhook verification - DEBE ser público para Meta
    if (req.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      console.log('Webhook verification attempt:', { mode, token, challenge });

      // Usar valor hardcodeado como fallback para evitar problemas de env vars
      const verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN') || 'token_prestabot_2025';

      const result = verifyWebhookToken(mode!, token!, challenge!, verifyToken);

      if (result) {
        console.log('Webhook verification successful');
        return new Response(result, {
          status: 200,
          headers: {
            'Content-Type': 'text/plain',
            'Access-Control-Allow-Origin': '*'
          }
        });
      } else {
        console.warn('Webhook verification failed', { mode, token, expected: verifyToken });
        return new Response('Verification failed', {
          status: 403,
          headers: {
            'Content-Type': 'text/plain',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }

    // POST: Process incoming messages
    if (req.method === 'POST') {
      const body = await req.text();
      const data = JSON.parse(body);

      console.log('Webhook received:', JSON.stringify(data, null, 2));

      // Initialize Supabase client
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const results = [];
      let processedMessages = 0;

      // Process each entry
      for (const entry of data.entry || []) {
        const webhookEntry = entry as WhatsAppWebhookEntry;

        for (const change of webhookEntry.changes || []) {
          if (change.field === 'messages') {
            const phoneNumberId = change.value.metadata.phone_number_id;

            // Process incoming messages
            for (const message of change.value.messages || []) {
              const result = await processInboundMessage(
                message,
                change.value.contacts || [],
                phoneNumberId,
                supabase
              );
              results.push(result);
              processedMessages++;
            }

            // Process status updates
            for (const status of change.value.statuses || []) {
              console.log('Status update:', status);

              // Update message status in database
              await supabase
                .from('whatsapp_messages')
                .update({
                  status: status.status,
                  ...(status.status === 'delivered' && { delivered_at: new Date(parseInt(status.timestamp) * 1000).toISOString() }),
                  ...(status.status === 'read' && { read_at: new Date(parseInt(status.timestamp) * 1000).toISOString() })
                })
                .eq('wa_message_id', status.id);
            }
          }
        }
      }

      const response = {
        success: true,
        processed_messages: processedMessages,
        results: results.filter(r => !r.success).length === 0
      };

      console.log('Webhook processing completed:', response);

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response('Method not allowed', {
      status: 405,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Webhook processing failed:', error);

    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});