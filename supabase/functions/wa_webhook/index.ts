// Edge Function: WhatsApp Webhook Handler
// Versión con flujos conversacionales integrados
// v2.0.2 - Force redeploy 2025-10-09

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ConversationManager } from "../_shared/conversation-manager.ts";
import { FlowHandlers } from "../_shared/flow-handlers.ts";
import { IntentDetector } from "../_shared/intent-detector.ts";
import { WhatsAppWindowManager } from "../_shared/whatsapp-window-manager.ts";
import { FlowDataProvider } from "../_shared/flow-data-provider.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// Helper: Formatear monto con separador de miles (punto)
function formatMoney(amount: number): string {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Helper: Formatear fecha en formato dd/mm/aa (formato chileno)
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

// Helper: Ordenar y agrupar préstamos
function sortAndGroupAgreements(agreements: any[]): any[] {
  // 1. Ordenar por fecha (más próxima primero)
  const sorted = [...agreements].sort((a, b) => {
    const dateA = new Date(a.due_date || '9999-12-31');
    const dateB = new Date(b.due_date || '9999-12-31');
    return dateA.getTime() - dateB.getTime();
  });

  // 2. Agrupar préstamos de dinero por contacto + fecha
  const grouped: any[] = [];
  const groupMap = new Map<string, any>();

  sorted.forEach(agreement => {
    const isDinero = agreement.item_description === 'Dinero' || agreement.title?.includes('Dinero');
    // Usar contact_id directamente (borrower_contact_id en agreements)
    const contactId = agreement.contact_id || agreement.borrower?.id || agreement.lender?.id;
    const dueDate = agreement.due_date;

    // Solo agrupar préstamos de dinero con la misma fecha y contacto
    if (isDinero && contactId && dueDate) {
      // Usar solo la fecha (sin hora) para la clave de agrupación
      const dateOnly = dueDate.split('T')[0]; // "2025-10-31"
      const groupKey = `${contactId}_${dateOnly}`;

      if (groupMap.has(groupKey)) {
        // Sumar al grupo existente
        const existing = groupMap.get(groupKey);
        existing.amount = (existing.amount || 0) + (agreement.amount || 0);
      } else {
        // Crear nuevo grupo
        const newGroup = { ...agreement };
        groupMap.set(groupKey, newGroup);
        grouped.push(newGroup);
      }
    } else {
      // No agrupar (objetos u otros tipos)
      grouped.push(agreement);
    }
  });

  return grouped;
}

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
    console.log('====== PROCESSING MESSAGE START ======');
    console.log('Message ID:', message.id);
    console.log('From:', message.from);
    console.log('Message Type:', message.type);
    console.log('Full Message Object:', JSON.stringify(message, null, 2));

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

    // 2. Obtener o crear tenant_contact (patrón tenant_contacts)
    const formattedPhone = parsePhoneNumber(message.from);
    const contactName = contacts[0]?.profile?.name || 'Usuario';

    // 2.1. Primero buscar el contact_profile por teléfono
    let { data: contactProfile } = await supabase
      .from('contact_profiles')
      .select('*')
      .eq('phone_e164', formattedPhone)
      .maybeSingle();

    // 2.2. Si encontramos el profile, buscar el tenant_contact
    let tenantContact = null;
    if (contactProfile) {
      const { data: existingTenantContact } = await supabase
        .from('tenant_contacts')
        .select('*, contact_profiles(phone_e164, telegram_id)')
        .eq('tenant_id', tenant.id)
        .eq('contact_profile_id', contactProfile.id)
        .maybeSingle();

      tenantContact = existingTenantContact;
    }

    if (!tenantContact) {
      // 2.3. No existe tenant_contact, crear contact_profile si no existe
      if (!contactProfile) {
        // Crear nuevo contact_profile (global)
        const { data: newProfile, error: profileError } = await supabase
          .from('contact_profiles')
          .insert({
            phone_e164: formattedPhone
          })
          .select()
          .single();

        if (profileError || !newProfile) {
          console.error('Error creating contact_profile:', profileError);
          throw new Error('Failed to create contact_profile');
        }

        contactProfile = newProfile;
        console.log('Created new contact_profile:', contactProfile.id);
      }

      // 2.4. Crear tenant_contact (personalizado para este tenant)
      const { data: newTenantContact, error: tenantContactError } = await supabase
        .from('tenant_contacts')
        .insert({
          tenant_id: tenant.id,
          contact_profile_id: contactProfile.id,
          name: contactName,
          whatsapp_id: message.from,
          opt_in_status: 'pending',
          preferred_language: 'es',
          metadata: {}
        })
        .select('*, contact_profiles(phone_e164, telegram_id)')
        .single();

      if (tenantContactError || !newTenantContact) {
        console.error('Error creating tenant_contact:', tenantContactError);
        throw new Error('Failed to create tenant_contact');
      }

      tenantContact = newTenantContact;
      console.log('Created new tenant_contact:', tenantContact.id);
    }

    if (!tenantContact) {
      throw new Error('Failed to get or create tenant_contact');
    }

    // Usar tenantContact como 'contact' para el resto del código
    const contact = tenantContact;

    // 3. Registrar mensaje entrante
    await supabase
      .from('whatsapp_messages')
      .insert({
        tenant_id: tenant.id,
        contact_id: contact.id,
        wa_message_id: message.id,
        direction: 'inbound',
        message_type: message.type,
        content: { text: message.text, interactive: message.interactive, button: message.button, contacts: message.contacts }
      });

    // 4. Procesar según tipo de mensaje usando flujos conversacionales
    let responseMessage = null;
    let interactiveResponse = null;

    console.log('====== MESSAGE TYPE ROUTING ======');
    console.log('Checking message.type:', message.type);
    console.log('Is text?', message.type === 'text');
    console.log('Is interactive?', message.type === 'interactive');
    console.log('Is button?', message.type === 'button');

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
        // Generar token del menú web y enviar botón de acceso
        console.log('[WELCOME] Generating menu web access for welcome message');
        try {
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
          const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

          // 1. Generar token del menú
          const tokenResponse = await fetch(
            `${supabaseUrl}/functions/v1/generate-menu-token`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`
              },
              body: JSON.stringify({
                tenant_id: tenant.id,
                contact_id: contact.id
              })
            }
          );

          const tokenData = await tokenResponse.json();

          if (tokenData.success && tokenData.data.url) {
            const menuUrl = tokenData.data.url;
            console.log('[WELCOME] Menu URL generated:', menuUrl);

            // 2. Enviar mensaje interactivo con botón CTA URL
            interactiveResponse = {
              type: 'cta_url',
              body: {
                text: '¡Hola! 👋 Soy tu asistente de préstamos.\n\nRegistra préstamos, ve su estado y gestiona tu información.\n\n⏱️ Válido por 1 hora.'
              },
              action: {
                name: 'cta_url',
                parameters: {
                  display_text: 'Ingresar al menú',
                  url: menuUrl
                }
              }
            };
          } else {
            console.error('[WELCOME] Error generating menu token:', tokenData);
            responseMessage = '¡Hola! 👋 Soy tu asistente de préstamos.\n\nHubo un error generando tu acceso. Por favor intenta escribir "menú web".';
          }
        } catch (error) {
          console.error('[WELCOME] Exception generating menu access:', error);
          responseMessage = '¡Hola! 👋 Soy tu asistente de préstamos.\n\nHubo un error generando tu acceso. Por favor intenta escribir "menú web".';
        }
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
        // Buscar préstamos que YO hice (lender)
        const { data: lentAgreements } = await supabase
          .from('agreements')
          .select('*, borrower:tenant_contacts!tenant_contact_id(name)')
          .eq('lender_tenant_contact_id', contact.id)
          .in('status', ['active', 'pending_confirmation']);

        // Buscar préstamos que me hicieron (borrower)
        const { data: borrowedAgreements } = await supabase
          .from('agreements')
          .select('*, lender:tenant_contacts!lender_tenant_contact_id(name)')
          .eq('tenant_contact_id', contact.id)
          .in('status', ['active', 'pending_confirmation']);

        const hasLent = lentAgreements && lentAgreements.length > 0;
        const hasBorrowed = borrowedAgreements && borrowedAgreements.length > 0;

        if (!hasLent && !hasBorrowed) {
          responseMessage = 'No tienes acuerdos activos en este momento.';
        } else {
          let statusText = '*📋 Estado de préstamos:*\n\n';

          // Mostrar préstamos que hice
          if (hasLent) {
            statusText += '*💰 Préstamos que hiciste:*\n';
            const groupedLent = sortAndGroupAgreements(lentAgreements);
            groupedLent.forEach((agreement: any, index: number) => {
              const borrowerName = agreement.borrower?.name || 'Desconocido';
              const isPending = agreement.status === 'pending_confirmation';
              statusText += `${index + 1}. A *${borrowerName}*: ${agreement.item_description || agreement.title}\n`;
              if (agreement.due_date) {
                statusText += `   Vence: ${formatDate(agreement.due_date)}\n`;
              }
              if (agreement.amount) {
                statusText += `   Monto: $${formatMoney(agreement.amount)}\n`;
              }
              if (isPending) {
                statusText += `   ⏳ _Confirmación pendiente_\n`;
              }
              statusText += '\n';
            });
          }

          // Mostrar préstamos que me hicieron
          if (hasBorrowed) {
            statusText += '*📥 Préstamos que te hicieron:*\n';
            const groupedBorrowed = sortAndGroupAgreements(borrowedAgreements);
            groupedBorrowed.forEach((agreement: any, index: number) => {
              const lenderName = agreement.lender?.name || 'Desconocido';
              const isPending = agreement.status === 'pending_confirmation';
              statusText += `${index + 1}. De *${lenderName}*: ${agreement.item_description || agreement.title}\n`;
              if (agreement.due_date) {
                statusText += `   Vence: ${formatDate(agreement.due_date)}\n`;
              }
              if (agreement.amount) {
                statusText += `   Monto: $${formatMoney(agreement.amount)}\n`;
              }
              if (isPending) {
                statusText += `   ⏳ _Confirmación pendiente_\n`;
              }
              statusText += '\n';
            });
          }

          responseMessage = statusText;
        }
      } else if (lowerText === 'cancelar' || lowerText === 'cancel') {
        // Cancelar conversación activa
        const conversationManager = new ConversationManager(supabase.supabaseUrl, supabase.supabaseKey);
        await conversationManager.cancelCurrentConversation(tenant.id, contact.id);
        responseMessage = '❌ Conversación cancelada. Puedes iniciar una nueva cuando gustes.';
      } else if (lowerText === 'menú web' || lowerText === 'menu web' || lowerText === 'acceso web') {
        // Enviar plantilla de menú web
        console.log('[MENU_WEB] Sending menu web template');
        try {
          const { WhatsAppTemplates } = await import('../_shared/whatsapp-templates.ts');
          const templates = new WhatsAppTemplates(
            phoneNumberId,
            Deno.env.get('WHATSAPP_ACCESS_TOKEN')!
          );

          const result = await templates.generateAndSendMenuAccess(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
            tenant.id,
            contact.id,
            contact.contact_profiles.phone_e164,
            contact.name
          );

          if (!result.success) {
            responseMessage = 'Hubo un error al generar el link del menú. Por favor intenta de nuevo.';
          }
          // Si es exitoso, la plantilla se envió automáticamente, no necesitamos responseMessage
        } catch (error) {
          console.error('[MENU_WEB] Error:', error);
          responseMessage = 'Hubo un error al enviar el menú. Por favor intenta de nuevo.';
        }
      }

      // Si no se asignó responseMessage ni interactiveResponse, procesar con sistema de flujos conversacionales
      if (!responseMessage && !interactiveResponse) {
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
              // Si el mensaje es null, es un duplicado - no enviar respuesta
              if (result.message === null) {
                console.log('[DUPLICATE] Skipping response for duplicate message');
                return { success: true, skipped: true, reason: 'duplicate_message' };
              }

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
                // Si requiere botones, crear respuesta interactiva
                if (result.requiresButtons) {
                  interactiveResponse = {
                    type: 'button',
                    body: {
                      text: result.message || 'Elige una opción:'
                    },
                    action: {
                      buttons: [
                        {
                          type: 'reply',
                          reply: {
                            id: 'loan_money',
                            title: '💰 Dinero'
                          }
                        },
                        {
                          type: 'reply',
                          reply: {
                            id: 'loan_object',
                            title: '📦 Un objeto'
                          }
                        },
                        {
                          type: 'reply',
                          reply: {
                            id: 'loan_other',
                            title: '✏️ Otra cosa'
                          }
                        }
                      ]
                    }
                  };
                } else if (result.requiresList && result.contactsList) {
                  // Si requiere lista de contactos, crear respuesta interactiva tipo lista
                  console.log('Building contacts list message with', result.contactsList.length, 'contacts');

                  const rows = result.contactsList.map((contact: any) => ({
                    id: `contact_${contact.id}`,
                    title: contact.name.substring(0, 24) // WhatsApp límite: 24 caracteres
                  }));

                  // Agregar opción "Agregar nuevo contacto" al final
                  rows.push({
                    id: 'add_new_contact',
                    title: '➕ Agregar nuevo contacto'
                  });

                  interactiveResponse = {
                    type: 'list',
                    header: {
                      type: 'text',
                      text: '💰 Nuevo préstamo'
                    },
                    body: {
                      text: result.message || '¿A quién se lo vas a prestar?'
                    },
                    action: {
                      button: 'Ver contactos',
                      sections: [
                        {
                          title: 'Tus contactos',
                          rows: rows
                        }
                      ]
                    }
                  };
                } else if (result.requiresDateButtons) {
                  // Si requiere botones de fecha
                  console.log('Building date buttons for due date selection');

                  interactiveResponse = {
                    type: 'button',
                    body: {
                      text: result.message || '¿Para cuándo debe devolver?'
                    },
                    action: {
                      buttons: [
                        {
                          type: 'reply',
                          reply: {
                            id: 'date_tomorrow',
                            title: 'Mañana'
                          }
                        },
                        {
                          type: 'reply',
                          reply: {
                            id: 'date_end_of_month',
                            title: 'A fin de mes'
                          }
                        },
                        {
                          type: 'reply',
                          reply: {
                            id: 'date_custom',
                            title: 'Escribir fecha'
                          }
                        }
                      ]
                    }
                  };
                } else {
                  responseMessage = result.message || 'Continuemos...';
                }
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
      console.log('====== PROCESSING INTERACTIVE/BUTTON MESSAGE ======');
      console.log('Interactive object:', JSON.stringify(message.interactive, null, 2));
      console.log('Button object:', JSON.stringify(message.button, null, 2));

      // Verificar si es respuesta de lista
      if (message.interactive?.list_reply) {
        const selectedId = message.interactive.list_reply.id;
        console.log('List reply received:', selectedId);

        // Registrar evento
        await supabase
          .from('events')
          .insert({
            tenant_id: tenant.id,
            contact_id: contact.id,
            event_type: 'list_item_selected',
            payload: { list_item_id: selectedId, message_id: message.id },
            whatsapp_message_id: message.id
          });

        if (selectedId === 'add_new_contact') {
          // Usuario quiere agregar nuevo contacto
          console.log('User selected: Add new contact');

          // Actualizar directamente el estado de conversación a awaiting_phone_for_new_contact
          const { data: currentState } = await supabase
            .from('conversation_states')
            .select('*')
            .eq('tenant_id', tenant.id)
            .eq('contact_id', contact.id)
            .gt('expires_at', new Date().toISOString())
            .single();

          if (currentState) {
            // Actualizar estado marcando que estamos agregando nuevo contacto
            await supabase
              .from('conversation_states')
              .update({
                current_step: 'awaiting_phone_for_new_contact',
                context: {
                  ...currentState.context,
                  adding_new_contact: true, // Marcador para saber que viene de "agregar nuevo"
                  temp_contact_name: 'Nuevo contacto' // Nombre temporal genérico
                },
                expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
              })
              .eq('id', currentState.id);

            responseMessage = '¿Puedes enviar el contacto o ingresar su número de teléfono y nombre?\n\n(También puedes escribir "sin teléfono" si no lo tienes)';
          } else {
            responseMessage = 'Hubo un problema. Por favor intenta de nuevo escribiendo "nuevo préstamo".';
          }
        } else if (selectedId.startsWith('contact_')) {
          // Usuario seleccionó un contacto existente
          const selectedContactId = selectedId.replace('contact_', '');
          console.log('User selected contact:', selectedContactId);

          // Buscar el nombre del contacto seleccionado
          const { data: selectedContact } = await supabase
            .from('tenant_contacts')
            .select('name')
            .eq('id', selectedContactId)
            .single();

          if (selectedContact) {
            console.log('Selected contact name:', selectedContact.name);
            const conversationManager = new ConversationManager(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

            // Procesar con el nombre del contacto
            const result = await conversationManager.processInput(tenant.id, contact.id, selectedContact.name);

            if (result.success) {
              // Si requiere botones (awaiting_item), crear respuesta interactiva
              if (result.requiresButtons) {
                interactiveResponse = {
                  type: 'button',
                  body: {
                    text: result.message || 'Elige una opción:'
                  },
                  action: {
                    buttons: [
                      {
                        type: 'reply',
                        reply: {
                          id: 'loan_money',
                          title: '💰 Dinero'
                        }
                      },
                      {
                        type: 'reply',
                        reply: {
                          id: 'loan_object',
                          title: '📦 Un objeto'
                        }
                      },
                      {
                        type: 'reply',
                        reply: {
                          id: 'loan_other',
                          title: '✏️ Otra cosa'
                        }
                      }
                    ]
                  }
                };
              } else if (result.requiresDateButtons) {
                // Si requiere botones de fecha
                interactiveResponse = {
                  type: 'button',
                  body: {
                    text: result.message || '¿Para cuándo debe devolver?'
                  },
                  action: {
                    buttons: [
                      {
                        type: 'reply',
                        reply: {
                          id: 'date_tomorrow',
                          title: 'Mañana'
                        }
                      },
                      {
                        type: 'reply',
                        reply: {
                          id: 'date_end_of_month',
                          title: 'A fin de mes'
                        }
                      },
                      {
                        type: 'reply',
                        reply: {
                          id: 'date_custom',
                          title: 'Escribir fecha'
                        }
                      }
                    ]
                  }
                };
              } else {
                responseMessage = result.message;
              }
            } else {
              responseMessage = result.error || 'Hubo un problema. Por favor intenta de nuevo.';
            }
          } else {
            responseMessage = 'No encontré ese contacto. Por favor intenta de nuevo.';
          }
        }
      } else {
        // Procesar respuestas de botones tradicionales
        let buttonId = '';

        if (message.interactive?.button_reply) {
          buttonId = message.interactive.button_reply.id;
          console.log('Extracted buttonId from interactive.button_reply:', buttonId);
        } else if (message.button) {
          buttonId = message.button.payload;
          console.log('Extracted buttonId from button.payload:', buttonId);
        }

        console.log('Final buttonId:', buttonId);

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
        case 'loan_money':
        case 'loan_object':
        case 'loan_other':
          // Botones del flujo "¿Qué le vas a prestar?"
          console.log('Loan item button clicked:', buttonId);
          try {
            const conversationManager = new ConversationManager(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

            // Mapear buttonId a loan_type
            const loanTypeMapping = {
              'loan_money': 'money',
              'loan_object': 'object',
              'loan_other': 'other'
            };

            const loanType = loanTypeMapping[buttonId];

            // Procesar con el loan_type
            const result = await conversationManager.processInput(tenant.id, contact.id, loanType);

            if (result.success) {
              responseMessage = result.message || 'Continuemos...';
            } else {
              responseMessage = result.error || 'Hubo un problema procesando tu respuesta.';
            }
          } catch (error) {
            console.error('Error processing loan item button:', error);
            responseMessage = 'Hubo un error procesando tu respuesta. Por favor intenta de nuevo.';
          }
          break;

        case 'date_tomorrow':
        case 'date_end_of_month':
        case 'date_custom':
          // Botones de selección de fecha
          console.log('Date button clicked:', buttonId);
          try {
            const conversationManager = new ConversationManager(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

            let dateInput = '';

            if (buttonId === 'date_tomorrow') {
              // Calcular mañana
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              dateInput = 'mañana';
            } else if (buttonId === 'date_end_of_month') {
              // Calcular fin de mes
              const today = new Date();
              const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
              const day = endOfMonth.getDate();
              const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
              const month = monthNames[endOfMonth.getMonth()];
              dateInput = `${day} de ${month}`;
            } else if (buttonId === 'date_custom') {
              // Solicitar que escriba la fecha
              responseMessage = 'Por favor escribe la fecha de devolución.\n\nPuedes escribir:\n• "15 de enero"\n• "en una semana"\n• "2025-01-20"\n• etc.';
              break;
            }

            // Procesar la fecha calculada
            const result = await conversationManager.processInput(tenant.id, contact.id, dateInput);

            if (result.success) {
              responseMessage = result.message || 'Fecha registrada correctamente.';
            } else {
              responseMessage = result.error || 'Hubo un problema procesando la fecha.';
            }
          } catch (error) {
            console.error('Error processing date button:', error);
            responseMessage = 'Hubo un error procesando la fecha. Por favor intenta de nuevo.';
          }
          break;

        case 'new_loan':
          // Mostrar opciones: WhatsApp conversacional o Formulario Web
          console.log('Button new_loan clicked, showing options');
          interactiveResponse = {
            type: 'button',
            body: {
              text: '💰 *Nuevo préstamo*\n\n¿Cómo prefieres crearlo?'
            },
            action: {
              buttons: [
                {
                  type: 'reply',
                  reply: {
                    id: 'new_loan_chat',
                    title: '💬 Por WhatsApp'
                  }
                },
                {
                  type: 'reply',
                  reply: {
                    id: 'new_loan_web',
                    title: '🌐 Formulario web'
                  }
                }
              ]
            }
          };
          break;

        case 'new_loan_chat':
          // Iniciar flujo de nuevo préstamo conversacional
          console.log('Button new_loan_chat clicked, starting conversational flow');
          try {
            const conversationManager = new ConversationManager(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

            // Primero, cancelar cualquier conversación existente
            await conversationManager.cancelCurrentConversation(tenant.id, contact.id);
            console.log('Previous conversation cancelled');

            // Ahora crear el nuevo estado desde cero
            await conversationManager.getOrCreateConversationState(tenant.id, contact.id, 'new_loan');
            console.log('New conversation state created');

            // Procesar el primer paso (init) del flujo
            const result = await conversationManager.processInput(tenant.id, contact.id, '', 'new_loan');

            console.log('new_loan flow result:', {
              success: result.success,
              message: result.message?.substring(0, 50),
              requiresList: result.requiresList,
              contactsCount: result.contactsList?.length
            });

            if (result.success) {
              // Verificar si requiere lista de contactos
              if (result.requiresList && result.contactsList) {
                console.log('Building contacts list message with', result.contactsList.length, 'contacts');

                const rows = result.contactsList.map((contact: any) => ({
                  id: `contact_${contact.id}`,
                  title: contact.name.substring(0, 24) // WhatsApp límite: 24 caracteres
                }));

                // Agregar opción "Agregar nuevo contacto" al final
                rows.push({
                  id: 'add_new_contact',
                  title: '➕ Agregar nuevo contacto'
                });

                interactiveResponse = {
                  type: 'list',
                  header: {
                    type: 'text',
                    text: '💰 Nuevo préstamo'
                  },
                  body: {
                    text: result.message || '¿A quién se lo vas a prestar?'
                  },
                  action: {
                    button: 'Ver contactos',
                    sections: [
                      {
                        title: 'Tus contactos',
                        rows: rows
                      }
                    ]
                  }
                };
              } else {
                responseMessage = result.message || '💰 Perfecto, vamos a registrar un nuevo préstamo.\n\n¿A quién se lo vas a prestar?';
              }
            } else {
              console.error('Flow initialization failed:', result.error);
              responseMessage = 'Hubo un problema al iniciar el flujo. Por favor intenta de nuevo.';
            }
          } catch (error) {
            console.error('Error starting new_loan flow:', error);
            responseMessage = 'Hubo un error. Por favor intenta de nuevo escribiendo "nuevo préstamo".';
          }
          break;

        case 'new_loan_web':
          // Generar link del formulario web
          console.log('Button new_loan_web clicked, generating web form link');
          try {
            const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
            const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

            // Llamar a la edge function generate-loan-web-link
            const generateLinkResponse = await fetch(
              `${supabaseUrl}/functions/v1/generate-loan-web-link`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseAnonKey}`
                },
                body: JSON.stringify({
                  tenant_id: tenant.id,
                  contact_id: contact.id
                })
              }
            );

            const linkData = await generateLinkResponse.json();

            if (linkData.success && linkData.data.url) {
              responseMessage = `🌐 *Formulario Web de Préstamo*\n\nAquí está tu link personal para crear un préstamo:\n\n${linkData.data.url}\n\n⏱️ Este link expira en 1 hora.\n\n📱 Ábrelo en tu navegador para registrar el préstamo de forma visual.`;
            } else {
              console.error('Error generating web form link:', linkData);
              responseMessage = 'Hubo un error al generar el link del formulario. Por favor intenta de nuevo o usa la opción "Por WhatsApp".';
            }
          } catch (error) {
            console.error('Error calling generate-loan-web-link:', error);
            responseMessage = 'Hubo un error al generar el link del formulario. Por favor intenta de nuevo o usa la opción "Por WhatsApp".';
          }
          break;

        case 'check_status':
          // Mostrar estado de acuerdos
          // Buscar préstamos que YO hice (lender)
          const { data: lentAgreementsBtn } = await supabase
            .from('agreements')
            .select('*, borrower:tenant_contacts!tenant_contact_id(name)')
            .eq('lender_tenant_contact_id', contact.id)
            .in('status', ['active', 'pending_confirmation']);

          // Buscar préstamos que me hicieron (borrower)
          const { data: borrowedAgreementsBtn } = await supabase
            .from('agreements')
            .select('*, lender:tenant_contacts!lender_tenant_contact_id(name)')
            .eq('tenant_contact_id', contact.id)
            .in('status', ['active', 'pending_confirmation']);

          const hasLentBtn = lentAgreementsBtn && lentAgreementsBtn.length > 0;
          const hasBorrowedBtn = borrowedAgreementsBtn && borrowedAgreementsBtn.length > 0;

          if (!hasLentBtn && !hasBorrowedBtn) {
            responseMessage = 'No tienes acuerdos activos en este momento.\n\n¿Quieres registrar algo? Escribe "nuevo préstamo".';
          } else {
            let statusText = '*📋 Estado de préstamos:*\n\n';

            // Mostrar préstamos que hice
            if (hasLentBtn) {
              statusText += '*💰 Préstamos que hiciste:*\n';
              const groupedLentBtn = sortAndGroupAgreements(lentAgreementsBtn);
              groupedLentBtn.forEach((agreement: any, index: number) => {
                const borrowerName = agreement.borrower?.name || 'Desconocido';
                const isPending = agreement.status === 'pending_confirmation';
                statusText += `${index + 1}. A *${borrowerName}*: ${agreement.item_description || agreement.title}\n`;
                if (agreement.due_date) {
                  statusText += `   Vence: ${formatDate(agreement.due_date)}\n`;
                }
                if (agreement.amount) {
                  statusText += `   Monto: $${formatMoney(agreement.amount)}\n`;
                }
                if (isPending) {
                  statusText += `   ⏳ _Pendiente de confirmación_\n`;
                }
                statusText += '\n';
              });
            }

            // Mostrar préstamos que me hicieron
            if (hasBorrowedBtn) {
              statusText += '*📥 Préstamos que te hicieron:*\n';
              const groupedBorrowedBtn = sortAndGroupAgreements(borrowedAgreementsBtn);
              groupedBorrowedBtn.forEach((agreement: any, index: number) => {
                const lenderName = agreement.lender?.name || 'Desconocido';
                const isPending = agreement.status === 'pending_confirmation';
                statusText += `${index + 1}. De *${lenderName}*: ${agreement.item_description || agreement.title}\n`;
                if (agreement.due_date) {
                  statusText += `   Vence: ${formatDate(agreement.due_date)}\n`;
                }
                if (agreement.amount) {
                  statusText += `   Monto: $${formatMoney(agreement.amount)}\n`;
                }
                if (isPending) {
                  statusText += `   ⏳ _Pendiente de confirmación_\n`;
                }
                statusText += '\n';
              });
            }

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

        case 'web_menu':
          // Enviar plantilla de menú web
          console.log('[MENU_WEB] Button web_menu clicked, sending menu web template');
          try {
            const { WhatsAppTemplates } = await import('../_shared/whatsapp-templates.ts');
            const templates = new WhatsAppTemplates(
              phoneNumberId,
              Deno.env.get('WHATSAPP_ACCESS_TOKEN')!
            );

            const result = await templates.generateAndSendMenuAccess(
              Deno.env.get('SUPABASE_URL')!,
              Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
              tenant.id,
              contact.id,
              contact.contact_profiles.phone_e164,
              contact.name
            );

            if (!result.success) {
              responseMessage = 'Hubo un error al generar el link del menú. Por favor intenta de nuevo.';
            }
            // Si es exitoso, la plantilla se envió automáticamente, no necesitamos responseMessage
          } catch (error) {
            console.error('[MENU_WEB] Error:', error);
            responseMessage = 'Hubo un error al enviar el menú. Por favor intenta de nuevo.';
          }
          break;

        case 'user_profile':
          // Enviar mensaje con WhatsApp Flow para gestionar perfil
          console.log('[PROFILE_FLOW] Button user_profile clicked, sending Flow message');
          console.log('[PROFILE_FLOW] Contact ID:', contact.id);
          console.log('[PROFILE_FLOW] Tenant ID:', tenant.id);
          try {
            const flowDataProvider = new FlowDataProvider(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

            console.log('[PROFILE_FLOW] Generating flow token...');
            // Generar flow_token único para este usuario
            const flowToken = await flowDataProvider.generateFlowToken('profile', tenant.id, contact.id);
            console.log('[PROFILE_FLOW] Flow token generated:', flowToken);

            console.log('[PROFILE_FLOW] Getting profile data...');
            // Obtener datos del perfil para prellenar
            const profileData = await flowDataProvider.getProfileData(contact.id);
            console.log('[PROFILE_FLOW] Profile data retrieved:', JSON.stringify(profileData));

            const flowId = Deno.env.get('WHATSAPP_PROFILE_FLOW_ID') || '';
            console.log('[PROFILE_FLOW] Flow ID from env:', flowId);

            // Enviar mensaje con Flow Button
            interactiveResponse = {
              type: 'flow',
              header: {
                type: 'text',
                text: '👤 Mi Perfil'
              },
              body: {
                text: 'Gestiona tu información personal para recibir recordatorios personalizados.'
              },
              footer: {
                text: '🔒 Tus datos están protegidos'
              },
              action: {
                name: 'flow',
                parameters: {
                  flow_message_version: '3',
                  flow_token: flowToken,
                  flow_id: flowId,
                  flow_cta: 'Abrir perfil',
                  flow_action: 'navigate',
                  flow_action_payload: {
                    screen: 'PROFILE_FORM',
                    data: profileData
                  }
                  // mode: 'draft' // Solo cuando Flow está en DRAFT, ahora está PUBLICADO
                }
              }
            };

            console.log('[PROFILE_FLOW] Interactive response prepared, will send to WhatsApp');

          } catch (error) {
            console.error('[PROFILE_FLOW] ❌ ERROR:', error);
            console.error('[PROFILE_FLOW] Error message:', error.message);
            console.error('[PROFILE_FLOW] Error stack:', error.stack);
            responseMessage = 'Hubo un error al abrir tu perfil. Por favor intenta de nuevo.';
          }
          break;

        case 'opt_in_yes':
          await supabase
            .from('tenant_contacts')
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
            .from('tenant_contacts')
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
            .eq('tenant_contact_id', contact.id)
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

        case 'Sí, confirmo':
        case '✅ Sí, confirmo':
          // Botón de confirmación del template loan_confirmation_request_v1
          console.log('Loan confirmation button clicked: confirmed');
          try {
            // Buscar el acuerdo más reciente del contacto en estado pending_confirmation o active
            const { data: agreement } = await supabase
              .from('agreements')
              .select('*')
              .eq('tenant_contact_id', contact.id)
              .in('status', ['pending_confirmation', 'active'])
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (agreement) {
              // Actualizar acuerdo a activo y confirmado
              await supabase
                .from('agreements')
                .update({
                  status: 'active',
                  borrower_confirmed: true,
                  borrower_confirmed_at: new Date().toISOString()
                })
                .eq('id', agreement.id);

              // Notificar al lender (prestamista)
              if (agreement.lender_tenant_contact_id) {
                const lenderMessage = `✅ ${contact.name} confirmó el préstamo de ${agreement.amount ? '$' + formatMoney(agreement.amount) : agreement.item_description}.\n\nLos recordatorios están activos.`;

                // Enviar mensaje al lender
                const windowManager = new WhatsAppWindowManager(supabase.supabaseUrl, supabase.supabaseKey);
                await windowManager.sendMessage(
                  tenant.id,
                  agreement.lender_tenant_contact_id,
                  lenderMessage,
                  { priority: 'high' }
                );
              }

              responseMessage = '✅ ¡Préstamo confirmado!\n\nTe enviaremos recordatorios cuando se acerque la fecha de devolución.';

              // Verificar si es primera confirmación para enviar mensaje de engagement
              try {
                const { count } = await supabase
                  .from('agreements')
                  .select('*', { count: 'exact', head: true })
                  .eq('tenant_contact_id', contact.id)
                  .eq('borrower_confirmed', true);

                console.log('[ENGAGEMENT] Total confirmations for contact:', count);

                // Solo enviar engagement en primera confirmación
                if (count === 1) {
                  console.log('[ENGAGEMENT] First confirmation detected, sending engagement message');

                  // Generar token del menú web para engagement
                  try {
                    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
                    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

                    const engagementTokenResponse = await fetch(
                      `${supabaseUrl}/functions/v1/generate-menu-token`,
                      {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${supabaseServiceKey}`
                        },
                        body: JSON.stringify({
                          tenant_id: tenant.id,
                          contact_id: contact.id
                        })
                      }
                    );

                    const engagementTokenData = await engagementTokenResponse.json();

                    if (engagementTokenData.success && engagementTokenData.data.url) {
                      const engagementMenuUrl = engagementTokenData.data.url;
                      console.log('[ENGAGEMENT] Menu URL generated:', engagementMenuUrl);

                      // Preparar mensaje de engagement con botón CTA URL
                      interactiveResponse = {
                        type: 'cta_url',
                        body: {
                          text: 'Confirmado! 🎉\n\nComo a ti te prestaron, probablemente tú también prestas a amigos o familia. Registra esos préstamos y te ayudamos con recordatorios para que no se olviden.\n\n⏱️ Válido por 1 hora.'
                        },
                        action: {
                          name: 'cta_url',
                          parameters: {
                            display_text: 'Ir a la app',
                            url: engagementMenuUrl
                          }
                        }
                      };
                    } else {
                      console.error('[ENGAGEMENT] Error generating menu token:', engagementTokenData);
                      // Si falla, no bloquear - el mensaje de confirmación ya se envió
                    }
                  } catch (engagementTokenError) {
                    console.error('[ENGAGEMENT] Exception generating menu token:', engagementTokenError);
                    // Si falla, no bloquear - el mensaje de confirmación ya se envió
                  }
                } else if (count > 1) {
                  console.log('[CONTINUITY] Returning user detected, sending continuity message');

                  // Generar token del menú web para continuidad
                  try {
                    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
                    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

                    const continuityTokenResponse = await fetch(
                      `${supabaseUrl}/functions/v1/generate-menu-token`,
                      {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${supabaseServiceKey}`
                        },
                        body: JSON.stringify({
                          tenant_id: tenant.id,
                          contact_id: contact.id
                        })
                      }
                    );

                    const continuityTokenData = await continuityTokenResponse.json();

                    if (continuityTokenData.success && continuityTokenData.data.url) {
                      const continuityMenuUrl = continuityTokenData.data.url;
                      console.log('[CONTINUITY] Menu URL generated:', continuityMenuUrl);

                      // Preparar mensaje de continuidad con botón CTA URL
                      interactiveResponse = {
                        type: 'cta_url',
                        body: {
                          text: 'Confirmado! ✅\n\nTu préstamo está activo. Gestiona todos tus acuerdos desde la app.\n\n⏱️ Válido por 1 hora.'
                        },
                        action: {
                          name: 'cta_url',
                          parameters: {
                            display_text: 'Ir a la app',
                            url: continuityMenuUrl
                          }
                        }
                      };
                    } else {
                      console.error('[CONTINUITY] Error generating menu token:', continuityTokenData);
                      // Si falla, no bloquear - el mensaje de confirmación ya se envió
                    }
                  } catch (continuityTokenError) {
                    console.error('[CONTINUITY] Exception generating menu token:', continuityTokenError);
                    // Si falla, no bloquear - el mensaje de confirmación ya se envió
                  }
                } else {
                  console.log('[ENGAGEMENT] Count is 0 or invalid, skipping post-confirmation message');
                }
              } catch (engagementError) {
                console.error('[ENGAGEMENT] Error checking confirmations:', engagementError);
                // No bloquear flujo si falla el engagement
              }
            } else {
              responseMessage = 'No encontré un préstamo pendiente de confirmación.';
            }
          } catch (error) {
            console.error('Error confirming loan:', error);
            responseMessage = 'Hubo un error al confirmar. Por favor contacta directamente.';
          }
          break;

        case 'No, rechazar':
        case '❌ No, rechazar':
          // Botón de rechazo del template loan_confirmation_request_v1
          console.log('Loan confirmation button clicked: rejected');
          try {
            // Buscar el acuerdo más reciente del contacto
            const { data: agreement } = await supabase
              .from('agreements')
              .select('*, lender:tenant_contacts!lender_tenant_contact_id(name)')
              .eq('tenant_contact_id', contact.id)
              .in('status', ['pending_confirmation', 'active'])
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (agreement) {
              // Actualizar acuerdo a rechazado
              await supabase
                .from('agreements')
                .update({
                  status: 'rejected',
                  borrower_confirmed: false,
                  borrower_rejection_reason: 'user_rejected'
                })
                .eq('id', agreement.id);

              // Notificar al lender
              if (agreement.lender_tenant_contact_id) {
                const lenderMessage = `❌ ${contact.name} rechazó el préstamo de ${agreement.amount ? '$' + formatMoney(agreement.amount) : agreement.item_description}.\n\nSe ha cancelado el recordatorio.`;

                const windowManager = new WhatsAppWindowManager(supabase.supabaseUrl, supabase.supabaseKey);
                await windowManager.sendMessage(
                  tenant.id,
                  agreement.lender_tenant_contact_id,
                  lenderMessage,
                  { priority: 'high' }
                );
              }

              responseMessage = 'Entendido, el préstamo ha sido rechazado.\n\n¿Puedes decirnos el motivo?\n\n1️⃣ No recibí el dinero/objeto\n2️⃣ El monto es incorrecto\n3️⃣ No conozco a esta persona';
            } else {
              responseMessage = 'No encontré un préstamo pendiente de confirmación.';
            }
          } catch (error) {
            console.error('Error rejecting loan:', error);
            responseMessage = 'Hubo un error al procesar el rechazo. Por favor contacta directamente.';
          }
          break;

        default:
          responseMessage = 'No reconozco esa opción. Por favor usa los botones disponibles.';
      }
      } // Cierre del else que maneja botones tradicionales
    } else if (message.type === 'contacts') {
      // Procesar contactos compartidos
      console.log('====== PROCESSING SHARED CONTACT ======');
      console.log('Contacts:', JSON.stringify(message.contacts, null, 2));

      if (message.contacts && message.contacts.length > 0) {
        const sharedContact = message.contacts[0];
        const contactName = sharedContact.name?.formatted_name || sharedContact.name?.first_name || 'Contacto';
        const contactPhone = sharedContact.phones?.[0]?.phone || sharedContact.phones?.[0]?.wa_id;

        console.log('Extracted from shared contact:', { name: contactName, phone: contactPhone });

        if (contactPhone) {
          try {
            const conversationManager = new ConversationManager(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

            // Verificar si hay un flujo activo esperando contacto
            const currentState = await conversationManager.getCurrentState(tenant.id, contact.id);

            if (currentState && (currentState.current_step === 'awaiting_contact' || currentState.current_step === 'awaiting_phone_for_new_contact')) {
              // Estamos en un flujo que espera contacto
              console.log('Active flow waiting for contact, processing shared contact data');

              // Primero, buscar si existe un tenant_contact con ese nombre o teléfono
              const formattedPhone = parsePhoneNumber(contactPhone);

              // Buscar por teléfono (join con contact_profiles)
              const { data: existingContactByPhone } = await supabase
                .from('tenant_contacts')
                .select('*, contact_profiles!inner(phone_e164)')
                .eq('tenant_id', tenant.id)
                .eq('contact_profiles.phone_e164', formattedPhone)
                .maybeSingle();

              // Buscar por nombre (dentro de tenant_contacts)
              const { data: existingContactByName } = await supabase
                .from('tenant_contacts')
                .select('*')
                .eq('tenant_id', tenant.id)
                .ilike('name', `%${contactName}%`)
                .maybeSingle();

              const existingContact = existingContactByPhone || existingContactByName;

              if (existingContact) {
                // Contacto existe
                console.log('Found existing contact:', existingContact.id, existingContact.name);

                // Si estamos en awaiting_phone_for_new_contact, actualizar estado directamente
                if (currentState.current_step === 'awaiting_phone_for_new_contact') {
                  await supabase
                    .from('conversation_states')
                    .update({
                      current_step: 'awaiting_item',
                      context: {
                        ...currentState.context,
                        contact_id: existingContact.id,
                        contact_info: existingContact.name,
                        temp_contact_name: undefined,
                        adding_new_contact: undefined
                      },
                      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
                    })
                    .eq('id', currentState.id);

                  responseMessage = `Perfecto, encontré a ${existingContact.name} en tus contactos.\n\n¿Qué le vas a prestar a ${existingContact.name}?\n\nElige una opción:`;

                  // Crear respuesta con botones
                  interactiveResponse = {
                    type: 'button',
                    body: { text: responseMessage },
                    action: {
                      buttons: [
                        { type: 'reply', reply: { id: 'loan_money', title: '💰 Dinero' } },
                        { type: 'reply', reply: { id: 'loan_object', title: '📦 Un objeto' } },
                        { type: 'reply', reply: { id: 'loan_other', title: '🔧 Otra cosa' } }
                      ]
                    }
                  };
                  responseMessage = null; // Limpiar para que use interactiveResponse
                } else {
                  // Flujo normal: awaiting_contact
                  const result = await conversationManager.processInput(tenant.id, contact.id, existingContact.name);

                  if (result.success) {
                    responseMessage = result.message || `Perfecto, encontré a ${existingContact.name} en tus contactos.`;
                  } else {
                    responseMessage = result.error || 'Hubo un problema procesando el contacto.';
                  }
                }
              } else {
                // Contacto NO existe, crear contact_profile + tenant_contact (patrón tenant_contacts)
                console.log('Contact not found, creating new contact with shared data:', { name: contactName, phone: formattedPhone });

                // Paso 1: Buscar o crear contact_profile
                let { data: contactProfile } = await supabase
                  .from('contact_profiles')
                  .select('*')
                  .eq('phone_e164', formattedPhone)
                  .maybeSingle();

                if (!contactProfile) {
                  const { data: newProfile, error: profileError } = await supabase
                    .from('contact_profiles')
                    .insert({ phone_e164: formattedPhone })
                    .select()
                    .single();

                  if (profileError || !newProfile) {
                    console.error('Error creating contact_profile from shared contact:', profileError);
                    responseMessage = 'Hubo un problema creando el contacto. Por favor intenta de nuevo.';
                    contactProfile = null;
                  } else {
                    contactProfile = newProfile;
                    console.log('Created new contact_profile:', contactProfile.id);
                  }
                }

                // Paso 2: Crear tenant_contact
                let newContact = null;
                if (contactProfile) {
                  const { data: newTenantContact, error: createError } = await supabase
                    .from('tenant_contacts')
                    .insert({
                      tenant_id: tenant.id,
                      contact_profile_id: contactProfile.id,
                      name: contactName,
                      opt_in_status: 'pending',
                      preferred_language: 'es',
                      metadata: {
                        created_from: 'shared_contact',
                        original_wa_id: sharedContact.phones?.[0]?.wa_id
                      }
                    })
                    .select()
                    .single();

                  if (createError || !newTenantContact) {
                    console.error('Error creating tenant_contact from shared contact:', createError);
                    responseMessage = 'Hubo un problema creando el contacto. Por favor intenta de nuevo.';
                  } else {
                    newContact = newTenantContact;
                    console.log('Created new tenant_contact:', newContact.id, newContact.name);
                  }
                }

                if (!newContact) {
                  responseMessage = 'Hubo un problema creando el contacto. Por favor intenta de nuevo.';
                } else {
                  console.log('Successfully created tenant_contact for shared contact');

                  // Si estamos en awaiting_phone_for_new_contact, actualizar estado directamente
                  if (currentState.current_step === 'awaiting_phone_for_new_contact') {
                    await supabase
                      .from('conversation_states')
                      .update({
                        current_step: 'awaiting_item',
                        context: {
                          ...currentState.context,
                          contact_id: newContact.id,
                          contact_info: newContact.name,
                          temp_contact_name: undefined,
                          adding_new_contact: undefined,
                          new_contact_phone: formattedPhone
                        },
                        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
                      })
                      .eq('id', currentState.id);

                    responseMessage = `Perfecto, registré a ${newContact.name}.\n\n¿Qué le vas a prestar a ${newContact.name}?\n\nElige una opción:`;

                    // Crear respuesta con botones
                    interactiveResponse = {
                      type: 'button',
                      body: { text: responseMessage },
                      action: {
                        buttons: [
                          { type: 'reply', reply: { id: 'loan_money', title: '💰 Dinero' } },
                          { type: 'reply', reply: { id: 'loan_object', title: '📦 Un objeto' } },
                          { type: 'reply', reply: { id: 'loan_other', title: '🔧 Otra cosa' } }
                        ]
                      }
                    };
                    responseMessage = null; // Limpiar para que use interactiveResponse
                  } else {
                    // Flujo normal: awaiting_contact
                    const result = await conversationManager.processInput(tenant.id, contact.id, contactName);

                    if (result.success) {
                      // Actualizar el contexto para incluir contact_id y evitar que pida teléfono
                      await supabase
                        .from('conversation_states')
                        .update({
                          context: {
                            ...result.context,
                            contact_id: newContact.id,
                            contact_info: contactName,
                            new_contact_phone: formattedPhone
                          }
                        })
                        .eq('tenant_id', tenant.id)
                        .eq('contact_id', contact.id)
                        .gt('expires_at', new Date().toISOString());

                      responseMessage = result.message || `Perfecto, registré a ${contactName} (${formattedPhone}).`;
                    } else {
                      responseMessage = result.error || 'Hubo un problema procesando el contacto.';
                    }
                  }
                }
              }
            } else {
              // No hay flujo activo o no está esperando contacto, procesar como texto simple
              console.log('No active flow or not waiting for contact, processing as text');
              const result = await conversationManager.processInput(tenant.id, contact.id, `${contactName} ${contactPhone}`);

              if (result.success) {
                responseMessage = result.message || 'Contacto recibido correctamente.';
              } else {
                responseMessage = result.error || 'Hubo un problema procesando el contacto compartido.';
              }
            }
          } catch (error) {
            console.error('Error processing shared contact:', error);
            responseMessage = 'Hubo un error procesando el contacto. Por favor intenta de nuevo.';
          }
        } else {
          // No hay teléfono, procesar solo con el nombre
          console.log('No phone in shared contact, processing with name only:', contactName);

          try {
            const conversationManager = new ConversationManager(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
            const result = await conversationManager.processInput(tenant.id, contact.id, contactName);

            if (result.success) {
              responseMessage = result.message || `Perfecto, registré a ${contactName}.`;
            } else {
              responseMessage = result.error || 'Hubo un problema procesando el contacto.';
            }
          } catch (error) {
            console.error('Error processing shared contact name:', error);
            responseMessage = 'Hubo un error procesando el contacto. Por favor intenta de nuevo.';
          }
        }
      } else {
        responseMessage = 'No recibí información del contacto. Por favor intenta de nuevo.';
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
          to: contact.contact_profiles.phone_e164.replace('+', ''),
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

    console.log('====== PROCESSING MESSAGE END ======');
    console.log('Response Message:', responseMessage ? responseMessage.substring(0, 100) : 'null');
    console.log('Interactive Response:', interactiveResponse ? 'YES' : 'NO');

    return { success: true };

  } catch (error) {
    console.error('====== ERROR PROCESSING MESSAGE ======');
    console.error('Error details:', error);
    console.error('Error message:', error.message);
    console.error('Stack:', error.stack);
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