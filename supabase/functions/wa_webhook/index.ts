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
    let interactiveResponse = null;

    if (message.type === 'text') {
      const text = message.text?.body?.trim() || '';

      console.log('Processing text message:', { text: text.substring(0, 100), type: message.type });

      // Detectar textos de botones (pueden incluir emojis)
      // Normalizar eliminando emojis y limpiando espacios
      const cleanText = text.replace(/[\u{1F600}-\u{1F6FF}]/gu, '').trim().toLowerCase();

      // Comandos especiales que no requieren flujos
      const lowerText = text.toLowerCase();

      // Detectar si es un texto de botón (con o sin emoji)
      if (cleanText.includes('nuevo prestamo') || cleanText.includes('nuevo préstamo')) {
        // Convertir a comando para iniciar flujo
        console.log('Detected button text for new_loan, converting to command');
        // Procesar como si fuera el comando directo - continuar con flujo conversacional
      } else if (lowerText === 'hola' || lowerText === 'hi' || lowerText === 'menu' || lowerText === 'inicio') {
        // Mensaje de bienvenida con botones
        interactiveResponse = {
          type: 'button',
          body: {
            text: '¡Hola! 👋 Soy tu asistente de recordatorios.\n\n¿En qué puedo ayudarte hoy?'
          },
          action: {
            buttons: [
              {
                type: 'reply',
                reply: {
                  id: 'new_loan',
                  title: '💰 Nuevo préstamo'
                }
              },
              {
                type: 'reply',
                reply: {
                  id: 'check_status',
                  title: '📋 Ver estado'
                }
              },
              {
                type: 'reply',
                reply: {
                  id: 'help',
                  title: '❓ Ayuda'
                }
              }
            ]
          }
        };
      } else if (lowerText === 'ayuda' || lowerText === 'help') {
        // Mensaje de ayuda con botones
        interactiveResponse = {
          type: 'button',
          body: {
            text: '🤖 *Comandos disponibles:*\n\nPuedes usar los botones o escribir:\n• Nuevo préstamo\n• Reprogramar\n• Servicio mensual\n• Estado\n• Cancelar'
          },
          action: {
            buttons: [
              {
                type: 'reply',
                reply: {
                  id: 'new_loan',
                  title: '💰 Nuevo préstamo'
                }
              },
              {
                type: 'reply',
                reply: {
                  id: 'reschedule',
                  title: '📅 Reprogramar'
                }
              },
              {
                type: 'reply',
                reply: {
                  id: 'new_service',
                  title: '🔄 Servicio mensual'
                }
              }
            ]
          }
        };
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

            // Log para debug
            console.log('Intent detection:', {
              text: text.substring(0, 50),
              intent: intentResult.intent,
              confidence: intentResult.confidence,
              reasoning: intentResult.reasoning
            });

            // Si la confianza es baja, ofrecer ayuda (umbral consistente con IntentDetector)
            if (intentResult.confidence < 0.15) {
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
        case 'new_loan':
          // Iniciar flujo de nuevo préstamo - ir directo sin IntentDetector
          console.log('Button new_loan clicked, starting flow directly');
          try {
            const conversationManager = new ConversationManager(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

            // Crear el estado directamente sin pasar por detección de intención
            await conversationManager.getOrCreateConversationState(tenant.id, contact.id, 'new_loan');

            // Procesar el primer paso (init) del flujo
            const result = await conversationManager.processInput(tenant.id, contact.id, 'inicio', 'new_loan');

            console.log('new_loan flow result:', { success: result.success, message: result.message?.substring(0, 50) });

            if (result.success) {
              responseMessage = result.message || '💰 Perfecto, vamos a registrar un nuevo préstamo.\n\n¿A quién se lo vas a prestar? Puedes escribir su nombre o número de teléfono.';
            } else {
              console.error('Flow initialization failed:', result.error);
              responseMessage = result.error || 'Hubo un problema al iniciar el flujo. Por favor intenta de nuevo.';
            }
          } catch (error) {
            console.error('Error starting new_loan flow:', error);
            responseMessage = '💰 Perfecto, vamos a registrar un nuevo préstamo.\n\n¿A quién se lo vas a prestar? Puedes escribir su nombre o número de teléfono.';
          }
          break;

        case 'check_status':
          // Mostrar estado de acuerdos
          const { data: agreements } = await supabase
            .from('agreements')
            .select('*')
            .eq('contact_id', contact.id)
            .eq('status', 'active');

          if (!agreements || agreements.length === 0) {
            responseMessage = 'No tienes acuerdos activos en este momento.\n\n¿Quieres registrar algo? Escribe "nuevo préstamo".';
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
          break;

        case 'help':
          // Mostrar ayuda con botones
          interactiveResponse = {
            type: 'button',
            body: {
              text: '🤖 *¿Qué puedo hacer?*\n\n• Registrar préstamos y cobros\n• Programar recordatorios\n• Configurar servicios mensuales\n• Ver el estado de tus acuerdos\n\n¿Qué te gustaría hacer?'
            },
            action: {
              buttons: [
                {
                  type: 'reply',
                  reply: {
                    id: 'new_loan',
                    title: '💰 Nuevo préstamo'
                  }
                },
                {
                  type: 'reply',
                  reply: {
                    id: 'reschedule',
                    title: '📅 Reprogramar'
                  }
                },
                {
                  type: 'reply',
                  reply: {
                    id: 'check_status',
                    title: '📋 Ver estado'
                  }
                }
              ]
            }
          };
          break;

        case 'reschedule':
          // Iniciar flujo de reprogramación - ir directo sin IntentDetector
          console.log('Button reschedule clicked, starting flow directly');
          try {
            const conversationManager = new ConversationManager(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
            await conversationManager.getOrCreateConversationState(tenant.id, contact.id, 'reschedule');
            const result = await conversationManager.processInput(tenant.id, contact.id, 'inicio', 'reschedule');

            if (result.success) {
              responseMessage = result.message || '📅 Vamos a reprogramar una fecha.\n\n¿Qué acuerdo quieres reprogramar?';
            } else {
              responseMessage = result.error || 'Hubo un problema al iniciar el flujo. Por favor intenta de nuevo.';
            }
          } catch (error) {
            console.error('Error starting reschedule flow:', error);
            responseMessage = '📅 Vamos a reprogramar una fecha.\n\n¿Qué acuerdo quieres reprogramar?';
          }
          break;

        case 'new_service':
          // Iniciar flujo de servicio mensual - ir directo sin IntentDetector
          console.log('Button new_service clicked, starting flow directly');
          try {
            const conversationManager = new ConversationManager(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
            await conversationManager.getOrCreateConversationState(tenant.id, contact.id, 'new_service');
            const result = await conversationManager.processInput(tenant.id, contact.id, 'inicio', 'new_service');

            if (result.success) {
              responseMessage = result.message || '🔄 Perfecto, vamos a configurar un servicio mensual.\n\n¿Qué servicio es?';
            } else {
              responseMessage = result.error || 'Hubo un problema al iniciar el flujo. Por favor intenta de nuevo.';
            }
          } catch (error) {
            console.error('Error starting new_service flow:', error);
            responseMessage = '🔄 Perfecto, vamos a configurar un servicio mensual.\n\n¿Qué servicio es? (Ej: "arriendo", "plan celular", "gym")';
          }
          break;

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

    // 5. Enviar respuesta
    if (interactiveResponse) {
      // Enviar mensaje interactivo con botones directamente
      try {
        const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
        const payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: contact.phone_e164.replace('+', ''),
          type: 'interactive',
          interactive: interactiveResponse
        };

        const response = await fetch(
          `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          }
        );

        const result = await response.json();

        if (response.ok) {
          // Registrar mensaje en base de datos
          await supabase
            .from('whatsapp_messages')
            .insert({
              tenant_id: tenant.id,
              contact_id: contact.id,
              wa_message_id: result.messages[0].id,
              direction: 'outbound',
              message_type: 'interactive',
              content: { interactive: interactiveResponse },
              status: 'sent',
              sent_at: new Date().toISOString()
            });

          console.log('Interactive message sent successfully:', result.messages[0].id);
        } else {
          console.error('Failed to send interactive message:', result);
        }
      } catch (error) {
        console.error('Error sending interactive message:', error);
      }
    } else if (responseMessage) {
      // Enviar mensaje de texto usando Window Manager para respetar ventana 24h
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