// Webhook Telegram con Estado Conversacional Persistente
// Usa metadata de contacts para persistir estado
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
  AWAITING_CONTACT_INFO: 'awaiting_contact_info',
  AWAITING_ITEM: 'awaiting_item',
  AWAITING_DATE: 'awaiting_date',
  CONFIRMING: 'confirming'
};

// Funciones de persistencia usando tenant_contacts.metadata
async function getConversationState(supabase: any, tenantContactId: string) {
  try {
    const { data: tenantContact } = await supabase
      .from('tenant_contacts')
      .select('metadata')
      .eq('id', tenantContactId)
      .single();

    const state = tenantContact?.metadata?.conversation_state || null;

    // Verificar si ha expirado
    if (state && state.expires_at && new Date(state.expires_at) < new Date()) {
      return null;
    }

    return state;
  } catch (error) {
    console.log('Error getting conversation state:', error);
    return null;
  }
}

async function saveConversationState(supabase: any, tenantContactId: string, state: any) {
  try {
    const { data: tenantContact } = await supabase
      .from('tenant_contacts')
      .select('metadata')
      .eq('id', tenantContactId)
      .single();

    const currentMetadata = tenantContact?.metadata || {};
    const newMetadata = {
      ...currentMetadata,
      conversation_state: {
        ...state,
        expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
      }
    };

    const { error } = await supabase
      .from('tenant_contacts')
      .update({ metadata: newMetadata })
      .eq('id', tenantContactId);

    if (error) {
      console.log('Error saving conversation state:', error);
      return false;
    }

    console.log('State saved successfully for tenant contact:', tenantContactId);
    return true;
  } catch (error) {
    console.log('Error saving conversation state:', error);
    return false;
  }
}

async function clearConversationState(supabase: any, tenantContactId: string) {
  try {
    const { data: tenantContact } = await supabase
      .from('tenant_contacts')
      .select('metadata')
      .eq('id', tenantContactId)
      .single();

    const currentMetadata = tenantContact?.metadata || {};
    delete currentMetadata.conversation_state;

    await supabase
      .from('tenant_contacts')
      .update({ metadata: currentMetadata })
      .eq('id', tenantContactId);

    console.log('State cleared for tenant contact:', tenantContactId);
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

      // Manejar tanto mensajes como callback queries
      let chatId, text, userName, userId, username, callbackData, messageId;

      if (update.message) {
        // Mensaje de texto normal
        chatId = update.message.chat.id;
        text = update.message.text;
        userName = update.message.from.first_name;
        userId = update.message.from.id;
        username = update.message.from.username;
      } else if (update.callback_query) {
        // Botón inline presionado
        chatId = update.callback_query.message.chat.id;
        text = update.callback_query.data; // El callback_data se trata como texto
        callbackData = update.callback_query.data;
        userName = update.callback_query.from.first_name;
        userId = update.callback_query.from.id;
        username = update.callback_query.from.username;
        messageId = update.callback_query.message.message_id;
      }

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

      // 1. Obtener token del bot
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

      // 2. Buscar o crear contacto usando nuevas tablas
      let tenantContact = null;

      // Primero buscar si ya existe un tenant_contact para este usuario
      // Buscar contact_profile por telegram_id primero
      const { data: userProfile } = await supabase
        .from('contact_profiles')
        .select('id')
        .eq('telegram_id', userId.toString())
        .maybeSingle();

      let existingTenantContact = null;
      if (userProfile) {
        const { data: tenantContactData } = await supabase
          .from('tenant_contacts')
          .select(`
            *,
            contact_profiles (
              id, phone_e164, telegram_id, telegram_username,
              telegram_first_name, telegram_last_name
            )
          `)
          .eq('tenant_id', tenantId)
          .eq('contact_profile_id', userProfile.id)
          .maybeSingle();

        existingTenantContact = tenantContactData;
      }

      if (existingTenantContact) {
        tenantContact = existingTenantContact;
        console.log('Found existing tenant contact:', tenantContact.id);
      } else if (text) {
        console.log('Creating new contact profile and tenant contact for user:', userId);

        // Buscar si ya existe un contact_profile para este telegram_id
        let { data: contactProfile } = await supabase
          .from('contact_profiles')
          .select('*')
          .eq('telegram_id', userId.toString())
          .maybeSingle();

        // Si no existe el profile, crearlo
        if (!contactProfile) {
          const { data: newProfile, error: profileError } = await supabase
            .from('contact_profiles')
            .insert({
              telegram_id: userId.toString(),
              telegram_username: username || null,
              telegram_first_name: userName,
              telegram_last_name: update.message?.from?.last_name || null
            })
            .select()
            .single();

          if (profileError) {
            console.error('Error creating contact profile:', profileError);
            return new Response(JSON.stringify({ success: false, error: 'Failed to create contact profile' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          contactProfile = newProfile;
          console.log('Successfully created contact profile:', contactProfile.id);
        }

        // Crear el tenant_contact
        const { data: newTenantContact, error: tenantContactError } = await supabase
          .from('tenant_contacts')
          .insert({
            tenant_id: tenantId,
            contact_profile_id: contactProfile.id,
            name: userName,
            preferred_channel: 'telegram',
            telegram_opt_in_status: 'pending',
            preferred_language: 'es',
            metadata: { chat_id: chatId }
          })
          .select(`
            *,
            contact_profiles (
              id, phone_e164, telegram_id, telegram_username,
              telegram_first_name, telegram_last_name
            )
          `)
          .single();

        if (tenantContactError) {
          console.error('Error creating tenant contact:', tenantContactError);
          return new Response(JSON.stringify({ success: false, error: 'Failed to create tenant contact' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        tenantContact = newTenantContact;
        console.log('Successfully created tenant contact:', tenantContact.id);
      }

      if (!tenantContact) {
        return new Response(JSON.stringify({ success: false, error: 'No contact found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 3. Obtener estado conversacional persistente
      let conversationState = await getConversationState(supabase, tenantContact.id);

      // 4. Procesar mensaje
      let responseText = '';
      let replyMarkup: any = null;

      console.log('Current conversation state:', conversationState);
      console.log('Processing text:', text);
      console.log('Callback data:', callbackData);

      // Mapear callback_data a comandos
      if (callbackData) {
        switch (callbackData) {
          case 'new_loan':
            text = 'nuevo préstamo';
            break;
          case 'status':
            text = 'estado';
            break;
          case 'help':
            text = 'ayuda';
            break;
          case 'date_tomorrow':
            text = 'mañana';
            break;
          case 'date_week':
            text = 'en una semana';
            break;
          case 'date_month':
            text = 'en un mes';
            break;
          case 'date_custom':
            text = 'fecha personalizada';
            break;
          case 'confirm_yes':
            text = 'confirmar';
            break;
          case 'confirm_no':
            text = 'cancelar';
            break;
        }
      }

      // Actualizar lowerText después del mapeo
      const lowerText = text?.toLowerCase() || '';

      // Comandos que reinician conversación
      if (lowerText === '/start' || lowerText === 'hola') {
        await clearConversationState(supabase, tenantContact.id);
        responseText = `¡Hola ${userName}! 👋 Soy tu asistente de recordatorios.

¿Qué te gustaría hacer?`;

        // Agregar inline keyboard para comandos principales
        replyMarkup = {
          inline_keyboard: [
            [{ text: "💰 Nuevo préstamo", callback_data: "new_loan" }],
            [{ text: "📋 Estado", callback_data: "status" }],
            [{ text: "ℹ️ Ayuda", callback_data: "help" }]
          ]
        };

      } else if (lowerText === 'cancelar' || lowerText === 'cancel') {
        await clearConversationState(supabase, tenantContact.id);
        responseText = '❌ Conversación cancelada. Puedes iniciar una nueva cuando gustes.';

      } else if (lowerText.includes('ayuda') || lowerText === '/help') {
        responseText = `🤖 *Comandos disponibles:*

• *Nuevo préstamo* - Registrar algo prestado
• *Estado* - Ver acuerdos activos
• *Cancelar* - Cancelar conversación actual
• *Ayuda* - Ver este mensaje`;

      } else if (lowerText.includes('estado')) {
        // Consultar préstamos activos
        try {
          // Simplificar consulta sin JOINs complejos
          const { data: activeAgreements, error: agreementsError } = await supabase
            .from('agreements')
            .select('id, title, item_description, due_date, status, created_at, description')
            .eq('tenant_id', tenantId)
            .eq('status', 'active')
            .order('due_date', { ascending: true });

          if (agreementsError) {
            console.error('Error fetching agreements:', agreementsError);
            responseText = '⚠️ Error consultando tus préstamos. Intenta nuevamente.';
          } else if (!activeAgreements || activeAgreements.length === 0) {
            responseText = '📝 No tienes préstamos activos en este momento.';
          } else {
            let agreementsList = '📋 *Tus préstamos activos:*\n\n';

            activeAgreements.forEach((agreement, index) => {
              const dueDate = new Date(agreement.due_date);
              const today = new Date();
              const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

              let statusEmoji = '📅';
              if (daysUntilDue < 0) statusEmoji = '🔴'; // Vencido
              else if (daysUntilDue <= 3) statusEmoji = '🟡'; // Próximo a vencer

              // Extraer nombre del contacto de la descripción
              const contactName = agreement.description?.split(' a ')[1]?.split('.')[0] || 'Desconocido';

              agreementsList += `${statusEmoji} *${index + 1}.* ${agreement.item_description}\n`;
              agreementsList += `👤 Para: ${contactName}\n`;
              agreementsList += `📅 Vence: ${dueDate.toLocaleDateString('es-CL')}\n`;
              agreementsList += `🆔 ID: ${agreement.id.substring(0, 8)}\n\n`;
            });

            agreementsList += `💡 Tip: Puedes marcar como devuelto escribiendo "devuelto [ID]"`;
            responseText = agreementsList;
          }
        } catch (error) {
          console.error('Error in estado command:', error);
          responseText = '⚠️ Error consultando tus préstamos. Intenta nuevamente.';
        }

      } else if (!conversationState) {
        // No hay conversación activa
        if (lowerText.includes('préstamo') || lowerText.includes('prestar')) {
          // Iniciar nueva conversación
          const newState = {
            step: STEPS.AWAITING_CONTACT,
            context: {},
            created: new Date().toISOString()
          };

          const saved = await saveConversationState(supabase, tenantContact.id, newState);
          console.log('New conversation state saved:', saved);

          responseText = `¡Perfecto! Vamos a crear un nuevo préstamo. 📝

¿A quién se lo vas a prestar? Puedes escribir su nombre.`;

        } else {
          responseText = `Recibido: "${text}"

Para iniciar un préstamo, escribe "Nuevo préstamo"
Para ver comandos, escribe "ayuda"`;
        }

      } else {
        // Hay conversación activa, procesar según el paso
        console.log('Processing active conversation, step:', conversationState.step);
        const context = { ...conversationState.context };

        switch (conversationState.step) {
          case STEPS.AWAITING_CONTACT:
            if (text && text.trim().length >= 2) {
              const contactName = text.trim();

              // Buscar si el contacto ya existe en la base de datos (usando nuevas tablas)
              const { data: existingTenantContact } = await supabase
                .from('tenant_contacts')
                .select(`
                  id, name,
                  contact_profiles (
                    id, phone_e164, telegram_id, telegram_username
                  )
                `)
                .eq('tenant_id', tenantId)
                .ilike('name', `%${contactName}%`)
                .neq('id', tenantContact.id) // Excluir el usuario actual
                .maybeSingle();

              if (existingTenantContact) {
                // Contacto encontrado, continuar con el flujo normal
                context.contact_info = contactName;
                context.tenant_contact_id = existingTenantContact.id;
                context.contact_profile_id = existingTenantContact.contact_profiles.id;
                const newState = { ...conversationState, step: STEPS.AWAITING_ITEM, context };
                await saveConversationState(supabase, tenantContact.id, newState);
                responseText = `Perfecto, el préstamo será para: *${contactName}* ✅

¿Qué le vas a prestar? Describe el objeto o dinero.`;
              } else {
                // Contacto no encontrado, solicitar información adicional
                context.contact_info = contactName;
                const newState = { ...conversationState, step: STEPS.AWAITING_CONTACT_INFO, context };
                await saveConversationState(supabase, tenantContact.id, newState);
                responseText = `No encontré a *${contactName}* en tus contactos.

Para poder enviarle recordatorios, necesito más información:

¿Cuál es su número de teléfono o usuario de Telegram?
Ejemplos: "+56912345678" o "@username"`;
              }
            } else {
              responseText = 'Por favor ingresa un nombre válido. ¿A quién se lo vas a prestar?';
            }
            break;

          case STEPS.AWAITING_CONTACT_INFO:
            if (text && text.trim().length >= 3) {
              const contactInfo = text.trim();

              // Validar formato y preparar datos para contact_profile
              let profileData = {};
              let tenantContactData = {
                tenant_id: tenantId,
                name: context.contact_info,
                preferred_language: 'es'
              };

              if (contactInfo.startsWith('+')) {
                // Es un número de teléfono
                profileData.phone_e164 = contactInfo;
                tenantContactData.preferred_channel = 'whatsapp';
              } else if (contactInfo.startsWith('@')) {
                // Es usuario de Telegram
                profileData.telegram_username = contactInfo.substring(1);
                tenantContactData.preferred_channel = 'telegram';
              } else {
                responseText = `Formato no válido. Por favor ingresa:
• Número de teléfono: "+56912345678"
• Usuario de Telegram: "@username"`;
                break;
              }

              try {
                // 1. Buscar si ya existe un contact_profile con esta info
                let contactProfile;

                if (profileData.phone_e164) {
                  const { data: existingProfile } = await supabase
                    .from('contact_profiles')
                    .select('*')
                    .eq('phone_e164', profileData.phone_e164)
                    .maybeSingle();
                  contactProfile = existingProfile;
                } else if (profileData.telegram_username) {
                  const { data: existingProfile } = await supabase
                    .from('contact_profiles')
                    .select('*')
                    .eq('telegram_username', profileData.telegram_username)
                    .maybeSingle();
                  contactProfile = existingProfile;
                }

                // 2. Si no existe, crear contact_profile
                if (!contactProfile) {
                  const { data: newProfile, error: profileError } = await supabase
                    .from('contact_profiles')
                    .insert(profileData)
                    .select()
                    .single();

                  if (profileError) {
                    console.error('Error creating contact profile:', profileError);
                    responseText = 'Hubo un error guardando el contacto. Intenta nuevamente.';
                    break;
                  }
                  contactProfile = newProfile;
                }

                // 3. Crear tenant_contact
                tenantContactData.contact_profile_id = contactProfile.id;

                const { data: newTenantContact, error: tenantContactError } = await supabase
                  .from('tenant_contacts')
                  .insert(tenantContactData)
                  .select()
                  .single();

                if (tenantContactError) {
                  console.error('Error creating tenant contact:', tenantContactError);
                  responseText = 'Hubo un error guardando el contacto. Intenta nuevamente.';
                } else {
                  context.tenant_contact_id = newTenantContact.id;
                  context.contact_profile_id = contactProfile.id;
                  context.contact_phone = contactInfo;
                  const newState = { ...conversationState, step: STEPS.AWAITING_ITEM, context };
                  await saveConversationState(supabase, tenantContact.id, newState);

                  responseText = `Perfecto, he guardado a *${context.contact_info}* en tus contactos. ✅

¿Qué le vas a prestar? Describe el objeto o dinero.`;
                }
              } catch (error) {
                console.error('Error in contact creation process:', error);
                responseText = 'Hubo un error guardando el contacto. Intenta nuevamente.';
              }
            } else {
              responseText = 'Por favor ingresa información de contacto válida (teléfono o usuario de Telegram).';
            }
            break;

          case STEPS.AWAITING_ITEM:
            if (text && text.trim().length >= 3) {
              context.item_description = text.trim();
              const newState = { ...conversationState, step: STEPS.AWAITING_DATE, context };
              await saveConversationState(supabase, tenantContact.id, newState);
              responseText = `Excelente: *${text.trim()}*

¿Cuándo debe devolvértelo?`;

              // Agregar botones para fechas comunes
              replyMarkup = {
                inline_keyboard: [
                  [{ text: "🌅 Mañana", callback_data: "date_tomorrow" }],
                  [{ text: "📅 En una semana", callback_data: "date_week" }],
                  [{ text: "🗓️ En un mes", callback_data: "date_month" }],
                  [{ text: "✏️ Fecha personalizada", callback_data: "date_custom" }]
                ]
              };
            } else {
              responseText = 'Por favor describe mejor lo que vas a prestar. ¿Qué es exactamente?';
            }
            break;

          case STEPS.AWAITING_DATE:
            // Manejo especial para fecha personalizada
            if (lowerText === 'fecha personalizada') {
              responseText = 'Escribe la fecha personalizada (ej: "15 de enero", "en 2 semanas", "el viernes"):';
              break;
            }

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
            await saveConversationState(supabase, tenantContact.id, newState);

            responseText = `📋 *Resumen del préstamo:*

👤 Para: ${context.contact_info}
📦 Qué: ${context.item_description}
📅 Vence: ${dateStr}

¿Todo está correcto?`;

              // Agregar botones de confirmación
              replyMarkup = {
                inline_keyboard: [
                  [{ text: "✅ Confirmar", callback_data: "confirm_yes" }],
                  [{ text: "❌ Cancelar", callback_data: "confirm_no" }]
                ]
              };
            break;

          case STEPS.CONFIRMING:
            if (['si', 'sí', 'yes', 'confirmar', 'ok', 'correcto'].includes(lowerText)) {
              // Guardar préstamo en agreements
              try {
                // Parsear fecha simple
                let dueDate = null;
                const today = new Date();
                const dueDateStr = context.due_date.toLowerCase();

                if (dueDateStr.includes('mañana')) {
                  dueDate = new Date(today);
                  dueDate.setDate(dueDate.getDate() + 1);
                } else if (dueDateStr.includes('semana')) {
                  dueDate = new Date(today);
                  dueDate.setDate(dueDate.getDate() + 7);
                } else if (dueDateStr.includes('mes')) {
                  dueDate = new Date(today);
                  dueDate.setMonth(dueDate.getMonth() + 1);
                } else {
                  // Intentar parsear fecha específica o usar en 30 días por defecto
                  dueDate = new Date(today);
                  dueDate.setDate(dueDate.getDate() + 30);
                }

                // Crear un user temporal si no existe o usar uno existente
                let createdBy = null;
                const { data: existingUser } = await supabase
                  .from('users')
                  .select('id')
                  .eq('tenant_id', tenantId)
                  .limit(1)
                  .maybeSingle();

                if (existingUser) {
                  createdBy = existingUser.id;
                } else {
                  // Crear usuario básico si no existe
                  const { data: newUser, error: userError } = await supabase
                    .from('users')
                    .insert({
                      tenant_id: tenantId,
                      email: `telegram_${userId}@temp.local`,
                      role: 'member',
                      first_name: userName || 'Usuario Telegram'
                    })
                    .select('id')
                    .single();

                  if (userError) {
                    console.error('Error creating user:', userError);
                    throw new Error('Could not create user');
                  }
                  createdBy = newUser.id;
                }

                // Simplificar: solo usar campos que sabemos que existen
                const agreementData = {
                  tenant_id: tenantId,
                  created_by: createdBy,
                  type: 'loan',
                  title: `Préstamo: ${context.item_description}`,
                  description: `Préstamo de ${context.item_description} a ${context.contact_info}`,
                  item_description: context.item_description,
                  start_date: today.toISOString().split('T')[0],
                  due_date: dueDate.toISOString().split('T')[0],
                  status: 'active'
                };

                // Agregar tenant_contact_id (nueva referencia)
                if (context.tenant_contact_id) {
                  agreementData.tenant_contact_id = context.tenant_contact_id;
                }

                const { data: agreement, error: agreementError } = await supabase
                  .from('agreements')
                  .insert(agreementData)
                  .select()
                  .single();

                if (agreementError) {
                  console.error('Error creating agreement:', agreementError);
                  responseText = '⚠️ Hubo un error guardando el préstamo. Intenta nuevamente.';
                } else {
                  console.log('Préstamo guardado exitosamente:', agreement);
                  await clearConversationState(supabase, tenantContact.id);

                  responseText = `✅ ¡Perfecto! Tu préstamo ha sido registrado.

📋 *Datos guardados:*
👤 Para: ${context.contact_info}
📦 Qué: ${context.item_description}
📅 Vence: ${context.due_date}
🆔 ID: ${agreement.id.substring(0, 8)}

🔔 Te enviaré recordatorios automáticos cerca de la fecha de vencimiento.`;
                }
              } catch (error) {
                console.error('Error in confirmation process:', error);
                responseText = '⚠️ Hubo un error guardando el préstamo. Intenta nuevamente.';
              }
            } else {
              responseText = 'Por favor confirma escribiendo "si" o "confirmar" para guardar el préstamo, o "cancelar" para salir.';
            }
            break;

          default:
            await clearConversationState(supabase, tenantContact.id);
            responseText = 'Estado no reconocido. He reiniciado la conversación. Escribe "Nuevo préstamo" para comenzar.';
        }
      }

      // 5. Responder a callback query si es necesario
      if (callbackData && update.callback_query) {
        await fetch(`https://api.telegram.org/bot${tenant.telegram_bot_token}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: update.callback_query.id
          })
        });
      }

      // 6. Enviar respuesta
      if (responseText) {
        // Preparar el payload del mensaje
        const messagePayload: any = {
          chat_id: chatId,
          text: responseText,
          parse_mode: 'Markdown'
        };

        // Agregar teclado inline si está definido
        if (replyMarkup) {
          messagePayload.reply_markup = replyMarkup;
        }

        const telegramResponse = await fetch(`https://api.telegram.org/bot${tenant.telegram_bot_token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messagePayload)
        });

        const result = await telegramResponse.json();

        if (result.ok) {
          console.log('Response sent successfully');

          // Registrar mensaje en tabla messages
          await supabase
            .from('messages')
            .insert({
              tenant_id: tenantId,
              tenant_contact_id: tenantContact.id,
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
          console.error('Telegram API error:', result);
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