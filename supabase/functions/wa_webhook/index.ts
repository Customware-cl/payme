// Edge Function: WhatsApp Webhook Handler
// v2.7.0 - Modo Simplificado (Desactivación temporal de IA y flujos)
// 2025-11-12

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ConversationManager } from "../_shared/conversation-manager.ts";
import { FlowHandlers } from "../_shared/flow-handlers.ts";
import { IntentDetector } from "../_shared/intent-detector.ts";
import { WhatsAppWindowManager } from "../_shared/whatsapp-window-manager.ts";
import { FlowDataProvider } from "../_shared/flow-data-provider.ts";

// ============================================================================
// 🚧 FEATURE FLAGS - Modo Simplificado
// ============================================================================
// Cambiar a `true` para reactivar funcionalidades
const FEATURES = {
  AI_PROCESSING: false,           // IA para texto, audio, imágenes
  CONVERSATIONAL_FLOWS: false,    // Flujos de nuevo préstamo por WhatsApp
  INTERACTIVE_BUTTONS: false,     // Botones: new_loan, help, reschedule, etc.
  // Siempre activos:
  CHECK_STATUS: true,             // Ver estado de préstamos
  MARK_RETURNED: true,            // Marcar como devuelto
  MENU_ACCESS: true               // Acceso al portal web
};
// ============================================================================

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

/**
 * Envía mensaje de bienvenida a un usuario nuevo si no se ha enviado previamente
 * @param supabase Cliente de Supabase
 * @param tenant Tenant del usuario
 * @param whatsappId ID de WhatsApp del usuario
 * @returns true si se envió exitosamente, false si ya se había enviado o hubo error
 */
async function sendWelcomeMessageIfNeeded(
  supabase: any,
  tenant: any,
  whatsappId: string
): Promise<boolean> {
  try {
    // 1. Verificar si ya se envió mensaje de bienvenida
    if (tenant.welcome_message_sent) {
      console.log('[WELCOME] Mensaje de bienvenida ya fue enviado previamente para tenant:', tenant.id);
      return false;
    }

    console.log('[WELCOME] Enviando mensaje de bienvenida a tenant:', tenant.id);

    // 2. Preparar mensaje de bienvenida
    const welcomeMessage = '¡Hola! 👋 Te damos la bienvenida a Payme, tu asistente de préstamos.\n\n' +
      'Aquí puedes:\n' +
      '✅ Registrar préstamos que hiciste o te hicieron\n' +
      '✅ Ver el estado de tus préstamos\n' +
      '✅ Recibir recordatorios de pago automáticos\n\n' +
      '💡 Comandos útiles:\n' +
      '• Escribe "estado" para ver tus préstamos activos\n' +
      '• Escribe "menu" para acceder al portal web';

    // 3. Enviar mensaje usando WhatsApp API
    const whatsappAccessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const whatsappPhoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

    if (!whatsappAccessToken || !whatsappPhoneNumberId) {
      console.error('[WELCOME] Credenciales de WhatsApp no configuradas');
      return false;
    }

    const response = await fetch(
      `https://graph.facebook.com/v17.0/${whatsappPhoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${whatsappAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: whatsappId,
          type: 'text',
          text: {
            body: welcomeMessage
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[WELCOME] Error enviando mensaje:', errorText);
      return false;
    }

    console.log('[WELCOME] ✓ Mensaje de bienvenida enviado exitosamente');

    // 4. Marcar flag welcome_message_sent como true
    const { error: updateError } = await supabase
      .from('tenants')
      .update({ welcome_message_sent: true })
      .eq('id', tenant.id);

    if (updateError) {
      console.error('[WELCOME] Error actualizando flag welcome_message_sent:', updateError);
      // No es crítico, el mensaje ya se envió
    } else {
      console.log('[WELCOME] ✓ Flag welcome_message_sent actualizado');
    }

    return true;

  } catch (error) {
    console.error('[WELCOME] Exception enviando mensaje de bienvenida:', error);
    return false;
  }
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

    // 1. ENRUTAMIENTO INTELIGENTE MULTI-TENANT
    // Primero formatear el teléfono del remitente
    const formattedPhone = parsePhoneNumber(message.from);

    // 1.1. Intentar encontrar tenant del remitente (si es un owner con su propio tenant)
    let tenant = null;
    console.log('[ROUTING] Buscando tenant para:', formattedPhone);

    // Buscar contact_profile del remitente
    const { data: senderProfile } = await supabase
      .from('contact_profiles')
      .select('id')
      .eq('phone_e164', formattedPhone)
      .maybeSingle();

    if (senderProfile) {
      // Verificar si este contact_profile tiene su propio tenant (es un owner)
      const { data: userTenant } = await supabase
        .from('tenants')
        .select('*')
        .eq('owner_contact_profile_id', senderProfile.id)
        .maybeSingle();

      if (userTenant) {
        tenant = userTenant;
        console.log('[ROUTING] ✓ Mensaje enrutado al tenant del usuario:', tenant.name);
      }
    }

    // 1.2. Auto-crear tenant si no existe (arquitectura multi-tenant P2P)
    let isNewUser = false; // Flag para detectar si es usuario nuevo

    if (!tenant && !senderProfile) {
      console.log('[ROUTING] Número nuevo detectado, auto-creando contact_profile y tenant');
      isNewUser = true; // Usuario completamente nuevo

      // Crear contact_profile para el número nuevo
      const { data: newProfile, error: profileError } = await supabase
        .from('contact_profiles')
        .insert({ phone_e164: formattedPhone })
        .select()
        .single();

      if (profileError || !newProfile) {
        console.error('[ROUTING] ✗ Error creando contact_profile:', profileError);
        return { success: false, error: 'Failed to create profile' };
      }

      console.log('[ROUTING] ✓ Contact profile creado:', newProfile.id);

      // Auto-crear tenant usando la función ensure_user_tenant
      const { data: newTenantId, error: tenantError } = await supabase
        .rpc('ensure_user_tenant', { p_contact_profile_id: newProfile.id });

      if (tenantError || !newTenantId) {
        console.error('[ROUTING] ✗ Error creando tenant:', tenantError);
        return { success: false, error: 'Failed to create tenant' };
      }

      console.log('[ROUTING] ✓ Tenant auto-creado:', newTenantId);

      // Obtener el tenant recién creado
      const { data: newTenant } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', newTenantId)
        .single();

      tenant = newTenant;
    } else if (!tenant && senderProfile) {
      // El usuario ya tiene contact_profile pero no tenant, crear tenant
      console.log('[ROUTING] Contact profile existe pero sin tenant, auto-creando tenant');
      isNewUser = true; // Usuario semi-nuevo (tiene profile pero no tenant)

      const { data: newTenantId, error: tenantError } = await supabase
        .rpc('ensure_user_tenant', { p_contact_profile_id: senderProfile.id });

      if (tenantError || !newTenantId) {
        console.error('[ROUTING] ✗ Error creando tenant:', tenantError);
        return { success: false, error: 'Failed to create tenant' };
      }

      console.log('[ROUTING] ✓ Tenant auto-creado:', newTenantId);

      const { data: newTenant } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', newTenantId)
        .single();

      tenant = newTenant;
    }

    if (!tenant) {
      console.error('[ROUTING] ✗ No se pudo determinar tenant para:', formattedPhone);
      return { success: false, error: 'Tenant not found' };
    }

    console.log('[ROUTING] ✓ Tenant determinado:', {
      id: tenant.id,
      name: tenant.name,
      welcome_message_sent: tenant.welcome_message_sent,
      acquisition_type: tenant.acquisition_type,
      invited_by_tenant_id: tenant.invited_by_tenant_id,
      is_new_user: isNewUser
    });

    // 2. Obtener o crear tenant_contact (patrón tenant_contacts)
    // formattedPhone ya fue declarado en el enrutamiento multi-tenant (línea 157)
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

    // 2.5. Usar tenant_contact directamente (deprecación de contacts legacy)
    const contact = tenantContact;
    console.log('[Webhook] Using tenant_contact:', contact.id);

    // 2.6. Nota: Para usuarios nuevos orgánicos, NO enviamos mensaje de bienvenida aquí.
    //      El mensaje de bienvenida se enviará automáticamente junto con la URL del menú
    //      en el flujo de "MENU_ACCESS" más adelante (que detecta isNewUser y personaliza el mensaje).
    //      Solo enviamos mensaje de bienvenida separado para usuarios invitados después de confirmar/rechazar préstamo.

    // 3. Registrar mensaje entrante
    const { error: messageInsertError } = await supabase
      .from('whatsapp_messages')
      .insert({
        tenant_id: tenant.id,
        tenant_contact_id: contact.id,  // FASE 2: usar tenant_contact_id (modern)
        contact_id: null,  // Legacy column, deprecated (será eliminada en FASE 4)
        wa_message_id: message.id,
        direction: 'inbound',
        message_type: message.type,
        content: { text: message.text, interactive: message.interactive, button: message.button, contacts: message.contacts }
      });

    if (messageInsertError) {
      console.error('[Webhook] Error inserting message:', messageInsertError);
    } else {
      console.log('[Webhook] Message saved successfully');
    }

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
      } else if (cleanText.includes('si, confirmo') || cleanText.includes('sí, confirmo') ||
                 cleanText.includes('no, rechazar')) {
        // Handler para botones de confirmación de préstamo
        const isConfirm = cleanText.includes('si, confirmo') || cleanText.includes('sí, confirmo');
        console.log(`[LOAN_CONFIRMATION] Processing ${isConfirm ? 'confirmation' : 'rejection'} from borrower`);

        try {
          // Buscar el agreement más reciente pendiente de confirmación donde el usuario es borrower
          // En arquitectura P2P: buscar por borrower_tenant_id (mi tenant = tenant que recibe préstamo)
          const { data: pendingLoan, error: fetchError } = await supabase
            .from('agreements')
            .select('*')
            .eq('borrower_tenant_id', tenant.id) // MI tenant es el borrower
            .eq('status', 'pending_confirmation')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (fetchError) {
            console.error('[LOAN_CONFIRMATION] Error fetching pending loan:', fetchError);
            responseMessage = 'Hubo un error al procesar tu respuesta. Por favor intenta de nuevo.';
          } else if (!pendingLoan) {
            console.log('[LOAN_CONFIRMATION] No pending loan found for borrower');
            responseMessage = 'No encontré ningún préstamo pendiente de confirmación.\n\nSi necesitas ayuda, escribe "menu".';
          } else {
            // Procesar confirmación o rechazo
            if (isConfirm) {
              // CONFIRMAR: cambiar status a active y llenar borrower_tenant_id
              const { error: updateError } = await supabase
                .from('agreements')
                .update({
                  status: 'active',
                  borrower_tenant_id: tenant.id, // Asociar tenant del borrower que confirma
                  updated_at: new Date().toISOString()
                })
                .eq('id', pendingLoan.id);

              if (updateError) {
                console.error('[LOAN_CONFIRMATION] Error confirming loan:', updateError);
                responseMessage = 'Hubo un error al confirmar el préstamo. Por favor intenta de nuevo.';
              } else {
                // Registrar evento
                await supabase
                  .from('events')
                  .insert({
                    tenant_id: tenant.id,
                    tenant_contact_id: contact.id,
                    agreement_id: pendingLoan.id,
                    event_type: 'confirmed_returned', // Reutilizamos tipo existente
                    payload: {
                      action: 'loan_confirmed_by_borrower',
                      contact_name: contact.name,
                      agreement_title: pendingLoan.title,
                      confirmed_at: new Date().toISOString()
                    }
                  });

                const loanDescription = pendingLoan.amount
                  ? `$${formatMoney(pendingLoan.amount)}`
                  : (pendingLoan.description || pendingLoan.title);

                responseMessage = `✅ *Préstamo confirmado*\n\nHas confirmado recibir: ${loanDescription}\n\n📅 Fecha de devolución: ${formatDate(pendingLoan.due_date)}\n\n💡 Escribe "estado" para ver tus préstamos activos.`;

                console.log('[LOAN_CONFIRMATION] Loan confirmed successfully:', pendingLoan.id);

                // Enviar mensaje de bienvenida si es la primera vez que interactúa (usuario invitado)
                console.log('[LOAN_CONFIRMATION] Checking welcome message for tenant:', {
                  tenant_id: tenant.id,
                  tenant_name: tenant.name,
                  welcome_message_sent: tenant.welcome_message_sent,
                  acquisition_type: tenant.acquisition_type,
                  invited_by_tenant_id: tenant.invited_by_tenant_id,
                  whatsapp_id: contact.whatsapp_id
                });

                if (contact.whatsapp_id) {
                  const welcomeSent = await sendWelcomeMessageIfNeeded(supabase, tenant, contact.whatsapp_id);
                  console.log('[LOAN_CONFIRMATION] Welcome message result:', welcomeSent);
                } else {
                  console.log('[LOAN_CONFIRMATION] ⚠️ No whatsapp_id available for contact');
                }
              }
            } else {
              // RECHAZAR: cambiar status a rejected
              const { error: updateError } = await supabase
                .from('agreements')
                .update({
                  status: 'rejected',
                  updated_at: new Date().toISOString()
                })
                .eq('id', pendingLoan.id);

              if (updateError) {
                console.error('[LOAN_CONFIRMATION] Error rejecting loan:', updateError);
                responseMessage = 'Hubo un error al rechazar el préstamo. Por favor intenta de nuevo.';
              } else {
                // Registrar evento
                await supabase
                  .from('events')
                  .insert({
                    tenant_id: tenant.id,
                    tenant_contact_id: contact.id,
                    agreement_id: pendingLoan.id,
                    event_type: 'button_clicked',
                    payload: {
                      action: 'loan_rejected_by_borrower',
                      contact_name: contact.name,
                      agreement_title: pendingLoan.title,
                      rejected_at: new Date().toISOString()
                    }
                  });

                responseMessage = `❌ *Préstamo rechazado*\n\nHas rechazado el préstamo. Se notificará al prestamista.\n\n💡 Si tienes alguna duda, escribe "menu" para acceder al portal.`;

                console.log('[LOAN_CONFIRMATION] Loan rejected successfully:', pendingLoan.id);

                // Enviar mensaje de bienvenida si es la primera vez que interactúa (usuario invitado)
                console.log('[LOAN_CONFIRMATION] Checking welcome message for tenant (rejection):', {
                  tenant_id: tenant.id,
                  tenant_name: tenant.name,
                  welcome_message_sent: tenant.welcome_message_sent,
                  acquisition_type: tenant.acquisition_type,
                  invited_by_tenant_id: tenant.invited_by_tenant_id,
                  whatsapp_id: contact.whatsapp_id
                });

                if (contact.whatsapp_id) {
                  const welcomeSent = await sendWelcomeMessageIfNeeded(supabase, tenant, contact.whatsapp_id);
                  console.log('[LOAN_CONFIRMATION] Welcome message result (rejection):', welcomeSent);
                } else {
                  console.log('[LOAN_CONFIRMATION] ⚠️ No whatsapp_id available for contact (rejection)');
                }
              }
            }
          }
        } catch (error) {
          console.error('[LOAN_CONFIRMATION] Exception processing confirmation:', error);
          responseMessage = 'Hubo un error al procesar tu respuesta. Por favor intenta de nuevo escribiendo "menu".';
        }
      } else if (isNewUser ||
                 lowerText === 'hola' || lowerText === 'hi' || lowerText === 'menu' || lowerText === 'inicio' ||
                 lowerText === 'ayuda' || lowerText === 'help' ||
                 lowerText === 'estado' || lowerText === 'status' ||
                 lowerText === 'cancelar' || lowerText === 'cancel' ||
                 lowerText === 'menú web' || lowerText === 'menu web' || lowerText === 'acceso web') {
        // Usuarios nuevos o comandos específicos generan acceso al menú web
        console.log(`[MENU_ACCESS] ${isNewUser ? 'New user' : `Command "${lowerText}"`} redirecting to menu access`);
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
                contact_id: contact.id,
                token_type: 'llt'
              })
            }
          );

          const tokenData = await tokenResponse.json();

          if (tokenData.success && tokenData.data.url) {
            const menuUrl = tokenData.data.url;
            console.log('[MENU_ACCESS] Menu URL generated:', menuUrl);

            // 2. Enviar mensaje interactivo con botón CTA URL
            // Diferenciar mensaje según si es usuario nuevo o existente
            const welcomeMessage = isNewUser
              ? '¡Hola! 👋 Te damos la bienvenida a Payme, tu asistente de préstamos.\n\nAquí puedes:\n✅ Registrar préstamos que hiciste o te hicieron\n✅ Ver el estado de tus préstamos\n✅ Recibir recordatorios de pago automáticos\n\nTodo lo controlas desde el siguiente enlace 👇\n\n⏱️ Válido por 30 días\n\n💡 Comandos útiles:\n• Escribe "estado" para ver tus préstamos activos\n• Escribe "menu" para obtener nuevamente este enlace'
              : '¡Hola! 👋 Soy tu asistente de préstamos.\n\nRegistra préstamos, ve su estado y gestiona tu información.\n\n⏱️ Válido por 30 días.';

            interactiveResponse = {
              type: 'cta_url',
              body: {
                text: welcomeMessage
              },
              action: {
                name: 'cta_url',
                parameters: {
                  display_text: 'Acceder a Payme',
                  url: menuUrl
                }
              }
            };
          } else {
            console.error('[MENU_ACCESS] Error generating menu token:', tokenData);
            responseMessage = '¡Hola! 👋 Te damos la bienvenida a Payme.\n\nHubo un error generando tu acceso. Por favor intenta de nuevo escribiendo "menu".';
          }
        } catch (error) {
          console.error('[MENU_ACCESS] Exception generating menu access:', error);
          responseMessage = '¡Hola! 👋 Te damos la bienvenida a Payme.\n\nHubo un error generando tu acceso. Por favor intenta de nuevo escribiendo "menu".';
        }
      }

      // Si no se asignó responseMessage ni interactiveResponse, procesar con sistema de flujos conversacionales
      if (!responseMessage && !interactiveResponse) {
        try {
          const conversationManager = new ConversationManager(supabase.supabaseUrl, supabase.supabaseKey);

          // Verificar si hay conversación activa
          const currentState = await conversationManager.getCurrentState(tenant.id, contact.id);
          let flowType = null;
          let aiProcessed = false;  // Flag para indicar si AI Agent ya procesó

          // Si NO hay flujo activo, delegar a AI Agent (si está habilitado)
          if (!currentState && FEATURES.AI_PROCESSING) {
            console.log('[AI-AGENT] No active flow, delegating to AI agent');

            try {
              const aiResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-agent`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
                },
                body: JSON.stringify({
                  tenant_id: tenant.id,
                  contact_id: contact.id,
                  message: text,
                  message_type: 'text',
                  metadata: {}
                })
              });

              const aiResult = await aiResponse.json();

              if (aiResult.success) {
                responseMessage = aiResult.response;
                aiProcessed = true;  // ✅ Marcar que AI ya procesó

                // Si hay acciones que requieren confirmación, agregar botones
                if (aiResult.needs_confirmation && aiResult.actions && aiResult.actions.length > 0) {
                  interactiveResponse = {
                    type: 'button',
                    body: { text: responseMessage },
                    action: {
                      buttons: [
                        { type: 'reply', reply: { id: 'confirm_yes', title: '✅ Confirmar' } },
                        { type: 'reply', reply: { id: 'confirm_no', title: '❌ Cancelar' } }
                      ]
                    }
                  };
                  responseMessage = null;
                }
              } else {
                console.error('[AI-AGENT] Error:', aiResult.error);
                // Fallback a IntentDetector si falla AI
                const intentDetector = new IntentDetector();
                const intentResult = intentDetector.detectIntent(text);
                flowType = intentResult.intent;

                console.log('[AI-AGENT] Fallback to IntentDetector:', {
                  intent: intentResult.intent,
                  confidence: intentResult.confidence
                });

                if (intentResult.confidence < 0.15) {
                  const suggestions = intentDetector.getSuggestions(text);
                  responseMessage = `No estoy seguro de lo que necesitas. ¿Te refieres a alguno de estos?\n\n${suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nO escribe "ayuda" para ver todas las opciones.`;
                }
              }
            } catch (error) {
              console.error('[AI-AGENT] Exception:', error);
              // Fallback a IntentDetector
              const intentDetector = new IntentDetector();
              const intentResult = intentDetector.detectIntent(text);
              flowType = intentResult.intent;

              if (intentResult.confidence < 0.15) {
                const suggestions = intentDetector.getSuggestions(text);
                responseMessage = `No estoy seguro de lo que necesitas. ¿Te refieres a alguno de estos?\n\n${suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nO escribe "ayuda" para ver todas las opciones.`;
              }
            }
          } else if (!currentState && !FEATURES.AI_PROCESSING) {
            // IA desactivada - enviar mensaje alternativo
            console.log('[AI-AGENT] AI processing disabled, sending fallback message');
            responseMessage = 'Por el momento solo puedo ayudarte con acceso al menú web. 🌐\n\nEscribe "hola" o "menu" para obtener tu enlace de acceso.\n\n📊 También puedes escribir "estado" para ver tus préstamos activos.';
            aiProcessed = true; // Marcar como procesado para no entrar al flujo
          }

          // ✅ Solo llamar a conversationManager si AI NO procesó y flujos están activos
          if (!responseMessage && !aiProcessed && FEATURES.CONVERSATIONAL_FLOWS) {
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
            tenant_contact_id: contact.id,  // FASE 2: usar tenant_contact_id (modern)
            contact_id: null,  // Legacy column, deprecated
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
            tenant_contact_id: contact.id,  // FASE 2: usar tenant_contact_id (modern)
            contact_id: null,  // Legacy column, deprecated
            event_type: 'button_clicked',
            payload: { button_id: buttonId, message_id: message.id },
            whatsapp_message_id: message.id
          });

        // Filtro de botones según feature flags
        const allowedButtons = ['check_status']; // Siempre permitidos
        const isDynamicMarkReturned = buttonId.startsWith('loan_') && buttonId.endsWith('_mark_returned');
        const isInteractiveButton = ['new_loan', 'new_loan_chat', 'new_loan_web', 'help', 'reschedule', 'new_service', 'web_menu', 'user_profile', 'opt_in_yes', 'opt_in_no', 'loan_returned'].includes(buttonId);
        const isFlowButton = ['loan_money', 'loan_object', 'loan_other', 'date_tomorrow', 'date_end_of_month', 'date_custom'].includes(buttonId);
        // Botones de confirmación de préstamo (SIEMPRE permitidos - core business)
        const isLoanConfirmationButton = buttonId.toLowerCase().includes('confirm') ||
                                         buttonId.toLowerCase().includes('reject') ||
                                         buttonId.toLowerCase().includes('rechazar') ||
                                         buttonId.toLowerCase().includes('si_confirmo') ||
                                         buttonId.toLowerCase().includes('no_rechazar');

        // Verificar si el botón está permitido según los feature flags
        const isButtonAllowed = allowedButtons.includes(buttonId) ||
                                isDynamicMarkReturned ||
                                isLoanConfirmationButton ||
                                (FEATURES.INTERACTIVE_BUTTONS && isInteractiveButton) ||
                                (FEATURES.CONVERSATIONAL_FLOWS && isFlowButton);

        if (!isButtonAllowed) {
          console.log(`[BUTTON] Button "${buttonId}" is disabled`);
          responseMessage = 'Esta funcionalidad está temporalmente desactivada. 🚧\n\nPuedes:\n📊 Escribir "estado" para ver tus préstamos\n🌐 Escribir "menu" para acceder al portal web';
        } else {
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

            // Usar token del tenant (multi-tenant) con fallback a env var
            const waAccessToken = tenant.whatsapp_access_token || Deno.env.get('WHATSAPP_ACCESS_TOKEN')!;
            console.log('[MENU_WEB] Using token from:', tenant.whatsapp_access_token ? 'tenant' : 'env var');

            const templates = new WhatsAppTemplates(
              phoneNumberId,
              waAccessToken
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
              tenant_contact_id: contact.id,  // FASE 2: usar tenant_contact_id (modern)
              contact_id: null,  // Legacy column, deprecated
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
                tenant_contact_id: contact.id,  // FASE 2: usar tenant_contact_id (modern)
                contact_id: null,  // Legacy column, deprecated
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

        // Casos para botones de confirmación de préstamo (cuando vienen como tipo "button")
        default:
          // Detectar botones de confirmación/rechazo por su ID
          const isConfirmButton = buttonId.toLowerCase().includes('confirm') ||
                                  buttonId.toLowerCase().includes('si_confirmo');
          const isRejectButton = buttonId.toLowerCase().includes('reject') ||
                                 buttonId.toLowerCase().includes('rechazar') ||
                                 buttonId.toLowerCase().includes('no_rechazar');

          if (isConfirmButton || isRejectButton) {
            console.log(`[LOAN_CONFIRMATION_BUTTON] Processing ${isConfirmButton ? 'confirmation' : 'rejection'} button`);

            try {
              // Buscar el agreement más reciente pendiente de confirmación donde el usuario es borrower
              // En arquitectura P2P: buscar por borrower_tenant_id (mi tenant = tenant que recibe préstamo)
              const { data: pendingLoan, error: fetchError } = await supabase
                .from('agreements')
                .select('*')
                .eq('borrower_tenant_id', tenant.id) // MI tenant es el borrower
                .eq('status', 'pending_confirmation')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

              if (fetchError) {
                console.error('[LOAN_CONFIRMATION_BUTTON] Error fetching pending loan:', fetchError);
                responseMessage = 'Hubo un error al procesar tu respuesta. Por favor intenta de nuevo.';
              } else if (!pendingLoan) {
                console.log('[LOAN_CONFIRMATION_BUTTON] No pending loan found');
                responseMessage = 'No encontré ningún préstamo pendiente de confirmación.\n\nSi necesitas ayuda, escribe "menu".';
              } else {
                // Procesar confirmación o rechazo
                if (isConfirmButton) {
                  // CONFIRMAR: cambiar status a active y llenar borrower_tenant_id
                  const { error: updateError } = await supabase
                    .from('agreements')
                    .update({
                      status: 'active',
                      borrower_tenant_id: tenant.id, // Asociar tenant del borrower que confirma
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', pendingLoan.id);

                  if (updateError) {
                    console.error('[LOAN_CONFIRMATION_BUTTON] Error confirming:', updateError);
                    responseMessage = 'Hubo un error al confirmar el préstamo. Por favor intenta de nuevo.';
                  } else {
                    await supabase.from('events').insert({
                      tenant_id: tenant.id,
                      tenant_contact_id: contact.id,
                      agreement_id: pendingLoan.id,
                      event_type: 'confirmed_returned',
                      payload: {
                        action: 'loan_confirmed_by_borrower',
                        contact_name: contact.name,
                        agreement_title: pendingLoan.title,
                        confirmed_at: new Date().toISOString()
                      }
                    });

                    const loanDescription = pendingLoan.amount
                      ? `$${formatMoney(pendingLoan.amount)}`
                      : (pendingLoan.description || pendingLoan.title);

                    responseMessage = `✅ *Préstamo confirmado*\n\nHas confirmado recibir: ${loanDescription}\n\n📅 Fecha de devolución: ${formatDate(pendingLoan.due_date)}\n\n💡 Escribe "estado" para ver tus préstamos activos.`;
                    console.log('[LOAN_CONFIRMATION_BUTTON] Loan confirmed successfully:', pendingLoan.id);

                    // Enviar mensaje de bienvenida si es la primera vez que interactúa (usuario invitado)
                    console.log('[LOAN_CONFIRMATION_BUTTON] Checking welcome message for tenant:', {
                      tenant_id: tenant.id,
                      tenant_name: tenant.name,
                      welcome_message_sent: tenant.welcome_message_sent,
                      acquisition_type: tenant.acquisition_type,
                      invited_by_tenant_id: tenant.invited_by_tenant_id,
                      whatsapp_id: contact.whatsapp_id
                    });

                    if (contact.whatsapp_id) {
                      const welcomeSent = await sendWelcomeMessageIfNeeded(supabase, tenant, contact.whatsapp_id);
                      console.log('[LOAN_CONFIRMATION_BUTTON] Welcome message result:', welcomeSent);
                    } else {
                      console.log('[LOAN_CONFIRMATION_BUTTON] ⚠️ No whatsapp_id available for contact');
                    }
                  }
                } else {
                  // RECHAZAR
                  const { error: updateError } = await supabase
                    .from('agreements')
                    .update({
                      status: 'rejected',
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', pendingLoan.id);

                  if (updateError) {
                    console.error('[LOAN_CONFIRMATION_BUTTON] Error rejecting:', updateError);
                    responseMessage = 'Hubo un error al rechazar el préstamo. Por favor intenta de nuevo.';
                  } else {
                    await supabase.from('events').insert({
                      tenant_id: tenant.id,
                      tenant_contact_id: contact.id,
                      agreement_id: pendingLoan.id,
                      event_type: 'button_clicked',
                      payload: {
                        action: 'loan_rejected_by_borrower',
                        contact_name: contact.name,
                        agreement_title: pendingLoan.title,
                        rejected_at: new Date().toISOString()
                      }
                    });

                    responseMessage = `❌ *Préstamo rechazado*\n\nHas rechazado el préstamo. Se notificará al prestamista.\n\n💡 Si tienes alguna duda, escribe "menu" para acceder al portal.`;
                    console.log('[LOAN_CONFIRMATION_BUTTON] Loan rejected successfully:', pendingLoan.id);

                    // Enviar mensaje de bienvenida si es la primera vez que interactúa (usuario invitado)
                    console.log('[LOAN_CONFIRMATION_BUTTON] Checking welcome message for tenant (rejection):', {
                      tenant_id: tenant.id,
                      tenant_name: tenant.name,
                      welcome_message_sent: tenant.welcome_message_sent,
                      acquisition_type: tenant.acquisition_type,
                      invited_by_tenant_id: tenant.invited_by_tenant_id,
                      whatsapp_id: contact.whatsapp_id
                    });

                    if (contact.whatsapp_id) {
                      const welcomeSent = await sendWelcomeMessageIfNeeded(supabase, tenant, contact.whatsapp_id);
                      console.log('[LOAN_CONFIRMATION_BUTTON] Welcome message result (rejection):', welcomeSent);
                    } else {
                      console.log('[LOAN_CONFIRMATION_BUTTON] ⚠️ No whatsapp_id available for contact (rejection)');
                    }
                  }
                }
              }
            } catch (error) {
              console.error('[LOAN_CONFIRMATION_BUTTON] Exception:', error);
              responseMessage = 'Hubo un error al procesar tu respuesta. Por favor intenta de nuevo escribiendo "menu".';
            }
            break;
          }

          // Manejar payloads dinámicos de botones HSM (ej: loan_123_mark_returned)
          if (buttonId.startsWith('loan_') && buttonId.endsWith('_mark_returned')) {
            const agreementId = buttonId.split('_')[1];
            console.log('Procesando botón "Marcar como devuelto" para préstamo:', agreementId);

            try {
              // Buscar el préstamo específico
              const { data: specificLoan, error: loanError } = await supabase
                .from('agreements')
                .select('*, lender:tenant_contacts!lender_tenant_contact_id(id, name)')
                .eq('id', agreementId)
                .eq('tenant_contact_id', contact.id)
                .single();

              if (loanError || !specificLoan) {
                responseMessage = 'No encontré ese préstamo. Por favor verifica desde el menú.';
                break;
              }

              if (specificLoan.status === 'completed') {
                responseMessage = 'Este préstamo ya está marcado como devuelto.';
                break;
              }

              if (specificLoan.status !== 'active' && specificLoan.status !== 'due_soon' && specificLoan.status !== 'overdue') {
                responseMessage = 'Este préstamo no puede ser marcado como devuelto en su estado actual.';
                break;
              }

              // Marcar como completado
              await supabase
                .from('agreements')
                .update({
                  status: 'completed',
                  completed_at: new Date().toISOString()
                })
                .eq('id', agreementId);

              // Notificar al lender
              if (specificLoan.lender_tenant_contact_id) {
                const windowManager = new WhatsAppWindowManager(
                  Deno.env.get('SUPABASE_URL')!,
                  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
                );
                const loanText = specificLoan.amount
                  ? `$${formatMoney(specificLoan.amount)}`
                  : specificLoan.item_description;
                const notifyMessage = `✅ ${contact.name} marcó como devuelto el préstamo de ${loanText}.`;

                await windowManager.sendMessage(
                  tenant.id,
                  specificLoan.lender_tenant_contact_id,
                  notifyMessage,
                  { priority: 'normal' }
                );
              }

              // Registrar evento
              await supabase
                .from('events')
                .insert({
                  tenant_id: tenant.id,
                  tenant_contact_id: contact.id,  // FASE 2: usar tenant_contact_id (modern)
                  contact_id: null,  // Legacy column, deprecated
                  agreement_id: agreementId,
                  event_type: 'loan_marked_returned_from_reminder',
                  payload: {
                    contact_name: contact.name,
                    agreement_title: specificLoan.title,
                    confirmed_at: new Date().toISOString(),
                    source: 'quick_reply_button'
                  }
                });

              const loanDescription = specificLoan.amount
                ? `$${formatMoney(specificLoan.amount)}`
                : specificLoan.item_description;

              responseMessage = `✅ ¡Perfecto! He registrado que devolviste "${loanDescription}". ¡Gracias!`;
            } catch (error) {
              console.error('Error procesando marcar como devuelto:', error);
              responseMessage = 'Hubo un error al procesar tu solicitud. Por favor intenta de nuevo.';
            }
            break;
          }

          responseMessage = 'No reconozco esa opción. Por favor usa los botones disponibles.';
        }
        } // Cierre del else que verifica isButtonAllowed
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
    } else if (message.type === 'audio' && FEATURES.AI_PROCESSING) {
      // Procesar mensajes de audio con Whisper (transcripción)
      console.log('====== PROCESSING AUDIO MESSAGE ======');
      console.log('Audio object:', JSON.stringify(message.audio, null, 2));

      try {
        const { downloadWhatsAppMedia, blobToFile } = await import('../_shared/whatsapp-media-download.ts');
        const { OpenAIClient } = await import('../_shared/openai-client.ts');

        const audioId = message.audio?.id;
        if (!audioId) {
          responseMessage = 'No pude procesar el audio. Por favor intenta de nuevo.';
        } else {
          // Descargar audio
          const accessToken = tenant.whatsapp_access_token || Deno.env.get('WHATSAPP_ACCESS_TOKEN');
          const downloadResult = await downloadWhatsAppMedia(audioId, phoneNumberId, accessToken!);

          if (!downloadResult.success || !downloadResult.data) {
            console.error('[Audio] Download failed:', downloadResult.error);
            responseMessage = 'Hubo un error descargando el audio. Por favor intenta de nuevo.';
          } else {
            // Transcribir con Whisper
            const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
            if (!openaiApiKey) {
              responseMessage = 'El procesamiento de audio no está configurado. Por favor contacta soporte.';
            } else {
              const openai = new OpenAIClient(openaiApiKey);
              const audioFile = blobToFile(downloadResult.data, 'audio.ogg', downloadResult.mimeType);

              const transcriptionResult = await openai.transcribeAudio(audioFile, {
                language: 'es',
                prompt: 'Transcripción de mensaje de voz sobre préstamos y pagos en español chileno.'
              });

              if (!transcriptionResult.success || !transcriptionResult.transcription) {
                console.error('[Audio] Transcription failed:', transcriptionResult.error);
                responseMessage = 'No pude entender el audio. Por favor intenta de nuevo o escribe un mensaje de texto.';
              } else {
                const transcription = transcriptionResult.transcription;
                console.log('[Audio] Transcription:', transcription);

                // Procesar transcripción con AI Agent
                const aiResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-agent`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
                  },
                  body: JSON.stringify({
                    tenant_id: tenant.id,
                    contact_id: contact.id,
                    message: transcription,
                    message_type: 'audio_transcription',
                    metadata: {
                      audio_id: audioId,
                      original_mime_type: downloadResult.mimeType
                    }
                  })
                });

                const aiResult = await aiResponse.json();

                if (aiResult.success) {
                  responseMessage = `🎤 Audio recibido: "${transcription.substring(0, 100)}${transcription.length > 100 ? '...' : ''}"\n\n${aiResult.response}`;

                  // Si hay acciones que requieren confirmación, agregar botones
                  if (aiResult.needs_confirmation && aiResult.actions && aiResult.actions.length > 0) {
                    const action = aiResult.actions[0];
                    // Crear botones de confirmación
                    interactiveResponse = {
                      type: 'button',
                      body: { text: responseMessage },
                      action: {
                        buttons: [
                          { type: 'reply', reply: { id: 'confirm_yes', title: '✅ Confirmar' } },
                          { type: 'reply', reply: { id: 'confirm_no', title: '❌ Cancelar' } }
                        ]
                      }
                    };
                    responseMessage = null;
                  }
                } else {
                  responseMessage = `🎤 Audio: "${transcription}"\n\nHubo un error procesando tu mensaje. Por favor intenta de nuevo.`;
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('[Audio] Processing error:', error);
        responseMessage = 'Hubo un error procesando el audio. Por favor intenta de nuevo.';
      }
    } else if (message.type === 'image' && FEATURES.AI_PROCESSING) {
      // Procesar mensajes de imagen con GPT-4 Vision
      console.log('====== PROCESSING IMAGE MESSAGE ======');
      console.log('Image object:', JSON.stringify(message.image, null, 2));

      try {
        const { downloadWhatsAppMedia } = await import('../_shared/whatsapp-media-download.ts');
        const { OpenAIClient } = await import('../_shared/openai-client.ts');

        const imageId = message.image?.id;
        const caption = message.image?.caption || '';

        if (!imageId) {
          responseMessage = 'No pude procesar la imagen. Por favor intenta de nuevo.';
        } else {
          // Descargar imagen
          const accessToken = tenant.whatsapp_access_token || Deno.env.get('WHATSAPP_ACCESS_TOKEN');
          const downloadResult = await downloadWhatsAppMedia(imageId, phoneNumberId, accessToken!);

          if (!downloadResult.success || !downloadResult.data) {
            console.error('[Image] Download failed:', downloadResult.error);
            responseMessage = 'Hubo un error descargando la imagen. Por favor intenta de nuevo.';
          } else {
            // Convertir Blob a base64 para enviar a OpenAI
            const arrayBuffer = await downloadResult.data.arrayBuffer();
            const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
            const dataUrl = `data:${downloadResult.mimeType || 'image/jpeg'};base64,${base64}`;

            const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
            if (!openaiApiKey) {
              responseMessage = 'El análisis de imágenes no está configurado. Por favor contacta soporte.';
            } else {
              const openai = new OpenAIClient(openaiApiKey);

              // Crear prompt para análisis
              const analysisPrompt = caption
                ? `Analiza esta imagen enviada por un usuario de una app de préstamos. El usuario agregó este texto: "${caption}".

Determina:
1. ¿Qué tipo de imagen es? (comprobante de pago, transferencia, foto de objeto prestado, etc.)
2. Si es un comprobante, extrae: monto, destinatario/origen, fecha, tipo de transacción
3. ¿Qué acción quiere realizar el usuario? (registrar préstamo, confirmar pago, etc.)

Responde en español chileno de forma concisa.`
                : `Analiza esta imagen enviada por un usuario de una app de préstamos.

Determina:
1. ¿Qué tipo de imagen es? (comprobante de pago, transferencia, foto de objeto prestado, etc.)
2. Si es un comprobante, extrae: monto, destinatario/origen, fecha
3. ¿Qué acción podría querer realizar el usuario?

Responde en español chileno de forma concisa.`;

              const visionResult = await openai.analyzeImage(dataUrl, analysisPrompt, {
                model: 'gpt-5-nano',
                max_tokens: 500,
                detail: 'auto',
                verbosity: 'low' // GPT-5: respuestas concisas
              });

              if (!visionResult.success || !visionResult.analysis) {
                console.error('[Image] Analysis failed:', visionResult.error);
                responseMessage = 'No pude analizar la imagen. Por favor agrega una descripción de texto.';
              } else {
                const analysis = visionResult.analysis;
                console.log('[Image] Analysis:', analysis);

                // Construir mensaje para AI Agent
                const aiMessage = caption
                  ? `[Imagen recibida]\n\nAnálisis de la imagen: ${analysis}\n\nTexto del usuario: ${caption}`
                  : `[Imagen recibida]\n\nAnálisis de la imagen: ${analysis}`;

                // Procesar con AI Agent
                const aiResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-agent`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
                  },
                  body: JSON.stringify({
                    tenant_id: tenant.id,
                    contact_id: contact.id,
                    message: aiMessage,
                    message_type: 'image_analysis',
                    metadata: {
                      image_id: imageId,
                      caption: caption,
                      analysis: analysis,
                      mime_type: downloadResult.mimeType
                    }
                  })
                });

                const aiResult = await aiResponse.json();

                if (aiResult.success) {
                  responseMessage = `📷 Imagen analizada:\n${analysis}\n\n${aiResult.response}`;

                  // Si hay acciones que requieren confirmación, agregar botones
                  if (aiResult.needs_confirmation && aiResult.actions && aiResult.actions.length > 0) {
                    interactiveResponse = {
                      type: 'button',
                      body: { text: responseMessage },
                      action: {
                        buttons: [
                          { type: 'reply', reply: { id: 'confirm_yes', title: '✅ Confirmar' } },
                          { type: 'reply', reply: { id: 'confirm_no', title: '❌ Cancelar' } }
                        ]
                      }
                    };
                    responseMessage = null;
                  }
                } else {
                  responseMessage = `📷 Análisis: ${analysis}\n\nHubo un error procesando tu solicitud.`;
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('[Image] Processing error:', error);
        responseMessage = 'Hubo un error procesando la imagen. Por favor intenta de nuevo.';
      }
    } else if (message.type === 'audio' && !FEATURES.AI_PROCESSING) {
      // Audio recibido pero IA desactivada
      console.log('[Audio] AI processing disabled');
      responseMessage = 'Por el momento no puedo procesar mensajes de audio. 🚧\n\nPor favor escribe un mensaje de texto o:\n📊 Escribe "estado" para ver tus préstamos\n🌐 Escribe "menu" para acceder al portal web';
    } else if (message.type === 'image' && !FEATURES.AI_PROCESSING) {
      // Imagen recibida pero IA desactivada
      console.log('[Image] AI processing disabled');
      responseMessage = 'Por el momento no puedo procesar imágenes. 🚧\n\nPor favor escribe un mensaje de texto o:\n📊 Escribe "estado" para ver tus préstamos\n🌐 Escribe "menu" para acceder al portal web';
    }

    // 5. Enviar respuesta
    if (interactiveResponse) {
      // Enviar mensaje interactivo con botones directamente
      try {
        // Usar token del tenant (multi-tenant) con fallback a env var
        const accessToken = tenant.whatsapp_access_token || Deno.env.get('WHATSAPP_ACCESS_TOKEN');
        console.log('[INTERACTIVE] Using token from:', tenant.whatsapp_access_token ? 'tenant' : 'env var');

        // Resolver phone_e164 (legacy contact vs tenant contact con JOIN)
        let phoneE164: string;

        if (contact.phone_e164) {
          // Es legacy contact (tabla contacts) con phone_e164 directo
          phoneE164 = contact.phone_e164;
          console.log('[INTERACTIVE] Using phone from legacy contact:', phoneE164);
        } else if (contact.contact_profiles?.phone_e164) {
          // Es tenant contact con JOIN a contact_profiles
          const contactProfile = Array.isArray(contact.contact_profiles)
            ? contact.contact_profiles[0]
            : contact.contact_profiles;
          phoneE164 = contactProfile.phone_e164;
          console.log('[INTERACTIVE] Using phone from tenant contact JOIN:', phoneE164);
        } else {
          // Fallback: buscar en tenant_contacts con JOIN
          console.log('[INTERACTIVE] Phone not found, querying with JOIN...');
          const { data: contactWithPhone } = await supabase
            .from('tenant_contacts')
            .select('contact_profiles(phone_e164)')
            .eq('id', contact.id)
            .maybeSingle();

          const profile = Array.isArray(contactWithPhone?.contact_profiles)
            ? contactWithPhone.contact_profiles[0]
            : contactWithPhone?.contact_profiles;

          phoneE164 = profile?.phone_e164 || '';
          console.log('[INTERACTIVE] Phone from fallback query:', phoneE164);
        }

        if (!phoneE164) {
          console.error('[INTERACTIVE] Could not resolve phone number for contact:', contact.id);
          throw new Error('Phone number not found for contact');
        }

        const payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: phoneE164.replace('+', ''),
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