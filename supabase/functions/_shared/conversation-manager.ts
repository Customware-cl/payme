// Conversation Manager para flujos conversacionales
// Gestiona estados, transiciones y validaciones de flujos multi-paso

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Tipos importados del proyecto
type FlowType = 'new_loan' | 'new_service' | 'reschedule' | 'confirm_return' | 'confirm_payment' | 'general_inquiry';
type FlowStep = 'init' | 'awaiting_contact' | 'awaiting_item' | 'awaiting_money_amount' | 'awaiting_object_description' | 'awaiting_other_description' | 'awaiting_due_date' | 'awaiting_confirmation' | 'awaiting_reschedule_date' | 'awaiting_service_details' | 'awaiting_recurrence' | 'confirming' | 'complete' | 'cancelled';

interface ConversationState {
  id?: string;
  tenant_id: string;
  contact_id: string;
  phone_number?: string;
  flow_type: FlowType;
  current_step: FlowStep;
  context: Record<string, any>;
  expires_at: string;
}

interface FlowDefinition {
  steps: FlowStep[];
  validations: Record<FlowStep, (context: any, input: string) => boolean>;
  transitions: Record<FlowStep, FlowStep>;
  handlers: Record<FlowStep, (context: any, input: string) => any>;
}

export class ConversationManager {
  private supabase: any;
  private flows: Record<FlowType, FlowDefinition>;

  constructor(supabaseUrl: string, supabaseServiceKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.flows = this.initializeFlows();
  }

  private initializeFlows(): Record<FlowType, FlowDefinition> {
    return {
      new_loan: {
        steps: ['init', 'awaiting_contact', 'awaiting_item', 'awaiting_money_amount', 'awaiting_object_description', 'awaiting_other_description', 'awaiting_due_date', 'confirming', 'complete'],
        validations: {
          init: () => true,
          awaiting_contact: (context, input) => this.validateContact(input),
          awaiting_phone_for_new_contact: (context, input) => {
            const text = input.toLowerCase().trim();
            // Aceptar "sin teléfono" o números de teléfono válidos
            if (['sin telefono', 'sin teléfono', 'no tengo', 'skip', 'saltar'].includes(text)) {
              return true;
            }
            // Validar que sea un teléfono (al menos 8 dígitos)
            const digitsOnly = input.replace(/\D/g, '');
            return digitsOnly.length >= 8;
          },
          awaiting_item: (context, input) => {
            // Solo aceptar valores válidos de loan_type (money, object, other)
            const validTypes = ['money', 'object', 'other'];
            return validTypes.includes(input.toLowerCase().trim());
          },
          awaiting_money_amount: (context, input) => this.validateMoneyAmount(input),
          awaiting_object_description: (context, input) => input.trim().length >= 3,
          awaiting_other_description: (context, input) => input.trim().length >= 3,
          awaiting_due_date: (context, input) => this.validateDate(input),
          awaiting_confirmation: (context, input) => ['si', 'sí', 'yes', 'confirmar', 'ok'].includes(input.toLowerCase()),
          confirming: () => true,
          complete: () => true,
          cancelled: () => true,
          awaiting_reschedule_date: () => true,
          awaiting_service_details: () => true,
          awaiting_recurrence: () => true
        },
        transitions: {
          init: 'awaiting_contact',
          awaiting_contact: 'awaiting_item', // Esta transición será modificada dinámicamente
          awaiting_phone_for_new_contact: 'awaiting_item',
          awaiting_item: 'awaiting_due_date', // Se modificará dinámicamente según loan_type
          awaiting_money_amount: 'awaiting_due_date',
          awaiting_object_description: 'awaiting_due_date',
          awaiting_other_description: 'awaiting_due_date',
          awaiting_due_date: 'confirming',
          confirming: 'complete',
          complete: 'complete',
          cancelled: 'cancelled',
          awaiting_confirmation: 'confirming',
          awaiting_reschedule_date: 'confirming',
          awaiting_service_details: 'confirming',
          awaiting_recurrence: 'confirming'
        },
        handlers: {
          init: () => ({}), // Init no necesita guardar nada, solo avanza al siguiente paso
          awaiting_contact: (context, input) => ({ contact_info: input }),
          awaiting_phone_for_new_contact: (context, input) => {
            const text = input.toLowerCase().trim();

            // Si dice "sin teléfono", no guardar el teléfono
            if (['sin telefono', 'sin teléfono', 'no tengo', 'skip', 'saltar'].includes(text)) {
              return { new_contact_phone: null };
            }

            // Si viene de "Agregar nuevo contacto", intentar parsear nombre y teléfono
            if (context.adding_new_contact) {
              // Buscar teléfono en el texto (secuencia de al menos 8 dígitos)
              const phoneMatch = input.match(/\d[\d\s\-()]{7,}/);
              const phoneNumber = phoneMatch ? phoneMatch[0].replace(/\D/g, '') : null;

              // Extraer nombre (todo lo que no sea el teléfono)
              let name = input.trim();
              if (phoneMatch) {
                name = input.replace(phoneMatch[0], '').trim();
              }

              // Si encontramos nombre, actualizarlo
              if (name && name.length >= 2) {
                return {
                  temp_contact_name: name,
                  new_contact_phone: phoneNumber
                };
              }
            }

            // Por defecto, guardar como teléfono
            return { new_contact_phone: input.trim() };
          },
          awaiting_item: (context, input) => ({ loan_type: input }), // Guarda el tipo de préstamo
          awaiting_money_amount: (context, input) => {
            console.log('[HANDLER_MONEY] Input:', input);
            const parsedAmount = this.parseMoneyAmount(input);
            console.log('[HANDLER_MONEY] Parsed amount:', parsedAmount);
            const result = { amount: parsedAmount, item_description: 'Dinero' };
            console.log('[HANDLER_MONEY] Result:', result);
            return result;
          },
          awaiting_object_description: (context, input) => ({ item_description: input.trim() }),
          awaiting_other_description: (context, input) => ({ item_description: input.trim() }),
          awaiting_due_date: (context, input) => ({ due_date: this.parseDate(input) }),
          confirming: (context) => ({ confirmed: true }),
          complete: () => ({}),
          cancelled: () => ({}),
          awaiting_confirmation: () => ({}),
          awaiting_reschedule_date: () => ({}),
          awaiting_service_details: () => ({}),
          awaiting_recurrence: () => ({})
        }
      },
      reschedule: {
        steps: ['init', 'awaiting_reschedule_date', 'confirming', 'complete'],
        validations: {
          init: () => true,
          awaiting_reschedule_date: (context, input) => this.validateDate(input),
          confirming: (context, input) => ['si', 'sí', 'yes', 'confirmar', 'ok'].includes(input.toLowerCase()),
          complete: () => true,
          cancelled: () => true,
          awaiting_contact: () => true,
          awaiting_item: () => true,
          awaiting_due_date: () => true,
          awaiting_confirmation: () => true,
          awaiting_service_details: () => true,
          awaiting_recurrence: () => true
        },
        transitions: {
          init: 'awaiting_reschedule_date',
          awaiting_reschedule_date: 'confirming',
          confirming: 'complete',
          complete: 'complete',
          cancelled: 'cancelled',
          awaiting_contact: 'awaiting_reschedule_date',
          awaiting_item: 'awaiting_reschedule_date',
          awaiting_due_date: 'awaiting_reschedule_date',
          awaiting_confirmation: 'confirming',
          awaiting_service_details: 'awaiting_reschedule_date',
          awaiting_recurrence: 'awaiting_reschedule_date'
        },
        handlers: {
          init: () => ({}), // Init no necesita guardar nada, solo avanza al siguiente paso
          awaiting_reschedule_date: (context, input) => ({ new_date: this.parseDate(input) }),
          confirming: (context) => ({ confirmed: true }),
          complete: () => ({}),
          cancelled: () => ({}),
          awaiting_contact: () => ({}),
          awaiting_item: () => ({}),
          awaiting_due_date: () => ({}),
          awaiting_confirmation: () => ({}),
          awaiting_service_details: () => ({}),
          awaiting_recurrence: () => ({})
        }
      },
      new_service: {
        steps: ['init', 'awaiting_contact', 'awaiting_service_details', 'awaiting_recurrence', 'confirming', 'complete'],
        validations: {
          init: () => true,
          awaiting_contact: (context, input) => this.validateContact(input),
          awaiting_service_details: (context, input) => input.trim().length > 3,
          awaiting_recurrence: (context, input) => ['mensual', 'semanal', 'quincenal', 'diario'].includes(input.toLowerCase()),
          confirming: (context, input) => ['si', 'sí', 'yes', 'confirmar', 'ok'].includes(input.toLowerCase()),
          complete: () => true,
          cancelled: () => true,
          awaiting_item: () => true,
          awaiting_due_date: () => true,
          awaiting_confirmation: () => true,
          awaiting_reschedule_date: () => true
        },
        transitions: {
          init: 'awaiting_contact',
          awaiting_contact: 'awaiting_service_details',
          awaiting_service_details: 'awaiting_recurrence',
          awaiting_recurrence: 'confirming',
          confirming: 'complete',
          complete: 'complete',
          cancelled: 'cancelled',
          awaiting_item: 'awaiting_service_details',
          awaiting_due_date: 'awaiting_recurrence',
          awaiting_confirmation: 'confirming',
          awaiting_reschedule_date: 'confirming'
        },
        handlers: {
          init: () => ({}), // Init no necesita guardar nada, solo avanza al siguiente paso
          awaiting_contact: (context, input) => ({ contact_info: input }),
          awaiting_service_details: (context, input) => ({ service_description: input }),
          awaiting_recurrence: (context, input) => ({ recurrence: input }),
          confirming: (context) => ({ confirmed: true }),
          complete: () => ({}),
          cancelled: () => ({}),
          awaiting_item: () => ({}),
          awaiting_due_date: () => ({}),
          awaiting_confirmation: () => ({}),
          awaiting_reschedule_date: () => ({})
        }
      },
      confirm_return: {
        steps: ['init', 'confirming', 'complete'],
        validations: {
          init: () => true,
          confirming: (context, input) => ['si', 'sí', 'yes', 'confirmar', 'devuelto', 'entregado'].includes(input.toLowerCase()),
          complete: () => true,
          cancelled: () => true,
          awaiting_contact: () => true,
          awaiting_item: () => true,
          awaiting_due_date: () => true,
          awaiting_confirmation: () => true,
          awaiting_reschedule_date: () => true,
          awaiting_service_details: () => true,
          awaiting_recurrence: () => true
        },
        transitions: {
          init: 'confirming',
          confirming: 'complete',
          complete: 'complete',
          cancelled: 'cancelled',
          awaiting_contact: 'confirming',
          awaiting_item: 'confirming',
          awaiting_due_date: 'confirming',
          awaiting_confirmation: 'confirming',
          awaiting_reschedule_date: 'confirming',
          awaiting_service_details: 'confirming',
          awaiting_recurrence: 'confirming'
        },
        handlers: {
          init: () => ({}), // Init no necesita guardar nada, solo avanza al siguiente paso
          confirming: (context) => ({ confirmed: true }),
          complete: () => ({}),
          cancelled: () => ({}),
          awaiting_contact: () => ({}),
          awaiting_item: () => ({}),
          awaiting_due_date: () => ({}),
          awaiting_confirmation: () => ({}),
          awaiting_reschedule_date: () => ({}),
          awaiting_service_details: () => ({}),
          awaiting_recurrence: () => ({})
        }
      },
      confirm_payment: {
        steps: ['init', 'confirming', 'complete'],
        validations: {
          init: () => true,
          confirming: (context, input) => ['si', 'sí', 'yes', 'confirmar', 'pagado', 'completado'].includes(input.toLowerCase()),
          complete: () => true,
          cancelled: () => true,
          awaiting_contact: () => true,
          awaiting_item: () => true,
          awaiting_due_date: () => true,
          awaiting_confirmation: () => true,
          awaiting_reschedule_date: () => true,
          awaiting_service_details: () => true,
          awaiting_recurrence: () => true
        },
        transitions: {
          init: 'confirming',
          confirming: 'complete',
          complete: 'complete',
          cancelled: 'cancelled',
          awaiting_contact: 'confirming',
          awaiting_item: 'confirming',
          awaiting_due_date: 'confirming',
          awaiting_confirmation: 'confirming',
          awaiting_reschedule_date: 'confirming',
          awaiting_service_details: 'confirming',
          awaiting_recurrence: 'confirming'
        },
        handlers: {
          init: () => ({}), // Init no necesita guardar nada, solo avanza al siguiente paso
          confirming: (context) => ({ confirmed: true }),
          complete: () => ({}),
          cancelled: () => ({}),
          awaiting_contact: () => ({}),
          awaiting_item: () => ({}),
          awaiting_due_date: () => ({}),
          awaiting_confirmation: () => ({}),
          awaiting_reschedule_date: () => ({}),
          awaiting_service_details: () => ({}),
          awaiting_recurrence: () => ({})
        }
      },
      general_inquiry: {
        steps: ['init', 'complete'],
        validations: {
          init: () => true,
          complete: () => true,
          cancelled: () => true,
          awaiting_contact: () => true,
          awaiting_item: () => true,
          awaiting_due_date: () => true,
          awaiting_confirmation: () => true,
          awaiting_reschedule_date: () => true,
          awaiting_service_details: () => true,
          awaiting_recurrence: () => true,
          confirming: () => true
        },
        transitions: {
          init: 'complete',
          complete: 'complete',
          cancelled: 'cancelled',
          awaiting_contact: 'complete',
          awaiting_item: 'complete',
          awaiting_due_date: 'complete',
          awaiting_confirmation: 'complete',
          awaiting_reschedule_date: 'complete',
          awaiting_service_details: 'complete',
          awaiting_recurrence: 'complete',
          confirming: 'complete'
        },
        handlers: {
          init: () => ({}), // Init no necesita guardar nada, solo avanza al siguiente paso
          complete: () => ({}),
          cancelled: () => ({}),
          awaiting_contact: () => ({}),
          awaiting_item: () => ({}),
          awaiting_due_date: () => ({}),
          awaiting_confirmation: () => ({}),
          awaiting_reschedule_date: () => ({}),
          awaiting_service_details: () => ({}),
          awaiting_recurrence: () => ({}),
          confirming: () => ({})
        }
      }
    };
  }

  // Obtener o crear estado de conversación
  async getOrCreateConversationState(tenantId: string, contactId: string, flowType: FlowType): Promise<ConversationState> {
    console.log('====== getOrCreateConversationState START ======');
    console.log('Tenant ID:', tenantId);
    console.log('Contact ID:', contactId);
    console.log('Requested flowType:', flowType);

    // Buscar estado existente no expirado
    const { data: existingState } = await this.supabase
      .from('conversation_states')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('contact_id', contactId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log('Existing state found:', existingState ? {
      id: existingState.id,
      flow_type: existingState.flow_type,
      current_step: existingState.current_step
    } : 'null');

    if (existingState) {
      // Si el flowType coincide, reutilizar el estado existente
      if (existingState.flow_type === flowType) {
        console.log('Reusing existing state with matching flow_type:', flowType);
        return existingState;
      }

      // Si el flowType es diferente, eliminar el estado anterior y crear uno nuevo
      console.log('CONFLICT: Existing state has flow_type:', existingState.flow_type, 'but requested:', flowType);
      console.log('Deleting old state and creating new one...');

      await this.supabase
        .from('conversation_states')
        .delete()
        .eq('id', existingState.id);

      console.log('Old state deleted, will create new one');
    }

    // Si no hay estado activo, eliminar cualquier estado anterior (expirado o cancelado)
    // para evitar violación del constraint UNIQUE(contact_id)
    await this.supabase
      .from('conversation_states')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('contact_id', contactId);

    // Obtener información del contacto desde tenant_contacts
    const { data: tenantContact, error: contactError } = await this.supabase
      .from('tenant_contacts')
      .select('id, contact_profile_id, contact_profiles(phone_e164, telegram_id)')
      .eq('id', contactId)
      .single();

    if (contactError || !tenantContact) {
      throw new Error(`Contact not found: ${contactError?.message || 'Unknown error'}`);
    }

    // Usar phone_e164 o telegram_id como identificador
    const phoneNumber = tenantContact.contact_profiles?.phone_e164 || tenantContact.contact_profiles?.telegram_id || 'unknown';

    // Crear nuevo estado
    // Para new_loan, incluir el lender_contact_id (quien presta = quien habla)
    const initialContext = flowType === 'new_loan'
      ? { lender_contact_id: contactId }
      : {};

    const newState: ConversationState = {
      tenant_id: tenantId,
      contact_id: contactId,
      phone_number: phoneNumber,
      flow_type: flowType,
      current_step: 'init',
      context: initialContext,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutos
    };

    console.log('Creating new conversation state:', newState);

    const { data: createdState, error } = await this.supabase
      .from('conversation_states')
      .insert(newState)
      .select()
      .single();

    if (error) {
      console.error('Error creating conversation state:', error);
      throw new Error(`Failed to create conversation state: ${error.message}`);
    }

    console.log('Created state successfully:', {
      id: createdState.id,
      flow_type: createdState.flow_type,
      current_step: createdState.current_step
    });
    console.log('====== getOrCreateConversationState END ======');

    return createdState;
  }

  // Procesar entrada del usuario
  async processInput(tenantId: string, contactId: string, input: string, flowType?: FlowType): Promise<{
    success: boolean;
    message?: string;
    nextStep?: FlowStep;
    completed?: boolean;
    context?: any;
    requiresButtons?: boolean;
    error?: string;
  }> {
    try {
      console.log('====== CONVERSATION MANAGER processInput START ======');
      console.log('Input:', input);
      console.log('FlowType param:', flowType);

      // Si no se especifica flowType, buscar estado activo primero antes de detectar intención
      if (!flowType) {
        // Buscar si hay un estado de conversación activo
        const { data: activeState } = await this.supabase
          .from('conversation_states')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('contact_id', contactId)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (activeState && activeState.current_step !== 'complete' && activeState.current_step !== 'cancelled') {
          // Hay un flujo activo no completado, continuar con ese flujo
          flowType = activeState.flow_type;
          console.log('Found active flow, continuing with:', flowType);
        } else {
          // No hay flujo activo, detectar intención del usuario
          flowType = this.detectIntent(input);
          console.log('No active flow, detected new intent:', flowType);
        }
      }

      const state = await this.getOrCreateConversationState(tenantId, contactId, flowType);

      // ===== DETECCIÓN DE MENSAJES DUPLICADOS =====
      // Verificar si el mensaje es idéntico al último procesado (dentro de 5 segundos)
      const lastMessage = state.context?.last_message;
      const lastMessageTime = state.context?.last_message_time;
      const currentTime = Date.now();

      if (lastMessage === input.trim() && lastMessageTime) {
        const timeDiff = (currentTime - lastMessageTime) / 1000; // en segundos
        if (timeDiff < 5) {
          console.log(`[DUPLICATE] Ignoring duplicate message within ${timeDiff.toFixed(1)}s:`, input);
          return {
            success: true,
            message: null, // No responder a mensajes duplicados
            nextStep: state.current_step,
            completed: false,
            context: state.context
          };
        }
      }
      console.log('State retrieved:', {
        id: state?.id,
        flow_type: state?.flow_type,
        current_step: state?.current_step,
        context: state?.context
      });

      if (!state) {
        return { success: false, error: 'No se pudo crear el estado de conversación' };
      }

      const flow = this.flows[state.flow_type];

      if (!flow) {
        return { success: false, error: 'Flujo no encontrado' };
      }

      // Validar entrada
      const isValid = flow.validations[state.current_step](state.context, input);
      if (!isValid) {
        return {
          success: false,
          message: this.getValidationMessage(state.current_step)
        };
      }

      // Procesar entrada
      const handlerResult = flow.handlers[state.current_step](state.context, input);
      console.log('[CONTEXT] Step:', state.current_step, '| Handler result:', JSON.stringify(handlerResult));
      let updatedContext = {
        ...state.context,
        ...handlerResult,
        last_message: input.trim(),
        last_message_time: Date.now()
      };
      console.log('[CONTEXT] Updated:', JSON.stringify(updatedContext));

      // Lógica especial para verificación de contacto en new_loan
      let nextStep = flow.transitions[state.current_step];

      if (state.flow_type === 'new_loan' && state.current_step === 'awaiting_contact') {
        console.log('Verifying if contact exists in database...');

        // Buscar si el contacto existe en tenant_contacts
        const { data: existingContact } = await this.supabase
          .from('tenant_contacts')
          .select('*')
          .eq('tenant_id', tenantId)
          .ilike('name', `%${updatedContext.contact_info}%`)
          .maybeSingle();

        if (existingContact) {
          // Contacto existe, guardar tenant_contact_id
          console.log('Contact found:', existingContact.id, existingContact.name);
          updatedContext.contact_id = existingContact.id;
          updatedContext.contact_info = existingContact.name; // Usar nombre exacto de BD
          // nextStep queda como awaiting_item (por defecto)
        } else {
          // Contacto NO existe, pedir teléfono
          console.log('Contact not found, asking for phone');
          updatedContext.temp_contact_name = updatedContext.contact_info;
          delete updatedContext.contact_info;
          nextStep = 'awaiting_phone_for_new_contact'; // Override
        }
      }

      // Lógica especial para tipo de préstamo en new_loan
      if (state.flow_type === 'new_loan' && state.current_step === 'awaiting_item') {
        console.log('[TRANSITION] Determining next step based on loan_type:', updatedContext.loan_type);

        // Redirigir según el tipo de préstamo seleccionado
        if (updatedContext.loan_type === 'money') {
          nextStep = 'awaiting_money_amount';
          console.log('[TRANSITION] → money type detected, next step:', nextStep);
        } else if (updatedContext.loan_type === 'object') {
          nextStep = 'awaiting_object_description';
          console.log('[TRANSITION] → object type detected, next step:', nextStep);
        } else if (updatedContext.loan_type === 'other') {
          nextStep = 'awaiting_other_description';
          console.log('[TRANSITION] → other type detected, next step:', nextStep);
        } else {
          console.log('[TRANSITION] → NO VALID TYPE! loan_type:', updatedContext.loan_type);
        }
      }

      const isCompleted = nextStep === 'complete';

      // Actualizar estado
      if (!isCompleted) {
        console.log('[DB_UPDATE] Updating state:', { id: state.id, from: state.current_step, to: nextStep });

        const { data: updateResult, error: updateError } = await this.supabase
          .from('conversation_states')
          .update({
            current_step: nextStep,
            context: updatedContext,
            expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
          })
          .eq('id', state.id)
          .select();

        if (updateError) {
          console.log('[DB_UPDATE] ❌ ERROR updating state:', updateError);
        } else {
          console.log('[DB_UPDATE] ✅ State updated successfully:', updateResult);
        }
      } else {
        // Marcar como completado
        await this.supabase
          .from('conversation_states')
          .update({
            current_step: 'complete',
            context: updatedContext
          })
          .eq('id', state.id);
      }

      const finalMessage = this.getStepMessage(state.flow_type, nextStep, updatedContext);

      console.log('====== CONVERSATION MANAGER processInput END ======');
      console.log('Next step:', nextStep);
      console.log('Is completed:', isCompleted);
      console.log('Final message:', finalMessage.substring(0, 100));
      console.log('Flow type used:', state.flow_type);

      // Detectar si este paso requiere botones interactivos
      const requiresButtons = state.flow_type === 'new_loan' && nextStep === 'awaiting_item';

      // Detectar si este paso requiere botones de fecha
      const requiresDateButtons = (state.flow_type === 'new_loan' || state.flow_type === 'reschedule') && nextStep === 'awaiting_due_date';

      // Detectar si este paso requiere lista de contactos
      const requiresList = state.flow_type === 'new_loan' && nextStep === 'awaiting_contact';
      let contactsList = null;

      if (requiresList) {
        console.log('Fetching contacts list for tenant:', tenantId, 'excluding contact:', contactId);
        const { data: contacts } = await this.supabase
          .from('tenant_contacts')
          .select('id, name, contact_profiles(phone_e164)')
          .eq('tenant_id', tenantId)
          .neq('id', contactId) // Excluir el contacto actual (quien está creando el préstamo)
          .order('name')
          .limit(9); // Máximo 9 contactos + "Agregar nuevo" = 10 total (límite de WhatsApp)

        contactsList = contacts || [];
        console.log('Contacts found:', contactsList.length);
      }

      return {
        success: true,
        message: finalMessage,
        nextStep,
        completed: isCompleted,
        context: updatedContext,
        requiresButtons,
        requiresDateButtons,
        requiresList,
        contactsList
      };

    } catch (error) {
      console.error('====== CONVERSATION MANAGER ERROR ======');
      console.error('Error processing conversation input:', error);
      console.error('Error stack:', error.stack);
      return { success: false, error: error.message };
    }
  }

  // Detectar intención del usuario
  private detectIntent(input: string): FlowType {
    // Normalizar texto: lowercase y remover tildes
    const text = input
      .toLowerCase()
      .replace(/[áà]/g, 'a')
      .replace(/[éè]/g, 'e')
      .replace(/[íì]/g, 'i')
      .replace(/[óò]/g, 'o')
      .replace(/[úù]/g, 'u')
      .replace(/ñ/g, 'n')
      .trim();

    // Palabras clave para nuevo préstamo
    if (text.includes('prestar') || text.includes('prestamo') || text.includes('nuevo prestamo') ||
        text.includes('crear prestamo') || text.includes('registrar prestamo')) {
      return 'new_loan';
    }

    // Palabras clave para reprogramar
    if (text.includes('reprogramar') || text.includes('cambiar fecha') || text.includes('posponer') ||
        text.includes('mover fecha') || text.includes('nueva fecha')) {
      return 'reschedule';
    }

    // Palabras clave para servicio recurrente
    if (text.includes('servicio') || text.includes('mensual') || text.includes('recurrente') ||
        text.includes('cobro mensual') || text.includes('suscripcion')) {
      return 'new_service';
    }

    // Palabras clave para confirmación de devolución
    if (text.includes('devolvieron') || text.includes('entregaron') || text.includes('regresaron') ||
        text.includes('ya me dieron') || text.includes('ya tengo')) {
      return 'confirm_return';
    }

    // Palabras clave para confirmación de pago
    if (text.includes('pague') || text.includes('pagado') || text.includes('ya pague') ||
        text.includes('transferi') || text.includes('deposito')) {
      return 'confirm_payment';
    }

    // Por defecto, consulta general
    return 'general_inquiry';
  }

  // Obtener mensaje de validación
  private getValidationMessage(step: FlowStep): string {
    const messages = {
      awaiting_contact: 'Por favor proporciona un nombre válido o número de teléfono.',
      awaiting_phone_for_new_contact: 'Por favor proporciona un número de teléfono válido (mínimo 8 dígitos) o escribe "sin teléfono".',
      awaiting_item: 'Por favor selecciona una opción usando los botones:\n💰 Dinero\n📦 Un objeto\n✏️ Otra cosa',
      awaiting_money_amount: 'Por favor ingresa un monto válido (solo números). Ejemplo: 5000, $5,000, etc.',
      awaiting_object_description: 'Por favor describe qué objeto vas a prestar (mínimo 3 caracteres).',
      awaiting_other_description: 'Por favor describe qué vas a prestar (mínimo 3 caracteres).',
      awaiting_due_date: 'Por favor proporciona una fecha válida. Puedes escribir "mañana", "15 de enero", "en una semana", etc.',
      awaiting_reschedule_date: 'Por favor proporciona una fecha válida para reprogramar.',
      awaiting_service_details: 'Por favor describe el servicio (mínimo 3 caracteres).',
      awaiting_recurrence: 'Por favor especifica la frecuencia: mensual, semanal, quincenal o diario.',
      confirming: 'Por favor responde "sí" o "no" para confirmar.',
      init: 'Iniciando conversación...',
      complete: 'Conversación completada.',
      cancelled: 'Conversación cancelada.',
      awaiting_confirmation: 'Por favor confirma tu respuesta.'
    };

    return messages[step] || 'Por favor proporciona una respuesta válida.';
  }

  // Obtener mensaje para el siguiente paso
  private getStepMessage(flowType: FlowType, step: FlowStep, context: any): string {
    if (step === 'complete') {
      return this.getCompletionMessage(flowType, context);
    }

    const messages = {
      new_loan: {
        init: '¡Perfecto! Vamos a crear un nuevo préstamo.',
        awaiting_contact: '¿A quién se lo vas a prestar?',
        awaiting_phone_for_new_contact: context.adding_new_contact
          ? '¿Puedes enviar el contacto o ingresar su número de teléfono y nombre?'
          : `No encontré a "${context.temp_contact_name}" en tus contactos.\n\n¿Puedes compartir su número de teléfono o enviar el contacto?\n\n(También puedes escribir "sin teléfono" si no lo tienes)`,
        awaiting_item: `¿Qué le vas a prestar a ${context.contact_info || context.temp_contact_name}?\n\nElige una opción:`,
        awaiting_money_amount: `¿Cuánto dinero le vas a prestar a ${context.contact_info || context.temp_contact_name}?\n\nIngresa solo el monto (ejemplo: 5000)`,
        awaiting_object_description: `¿Qué objeto le vas a prestar a ${context.contact_info || context.temp_contact_name}?`,
        awaiting_other_description: `¿Qué le vas a prestar a ${context.contact_info || context.temp_contact_name}?`,
        awaiting_due_date: (() => {
          console.log('[MESSAGE] Context:', JSON.stringify({ amount: context.amount, item: context.item_description, type: context.loan_type }));

          if (context.amount) {
            console.log('[MESSAGE] Using MONEY template');
            return `¿Para cuándo debe devolver el monto $${this.formatMoney(context.amount)}?`;
          } else if (context.item_description) {
            console.log('[MESSAGE] Using ITEM template');
            return `¿Para cuándo debe devolver "${context.item_description}"?`;
          } else {
            console.log('[MESSAGE] Using FALLBACK template');
            return `¿Para cuándo debe devolver el préstamo?`;
          }
        })(),
        confirming: context.amount
          ? `Perfecto, voy a registrar:\n\n📝 **Préstamo a:** ${context.contact_info || context.temp_contact_name}\n💰 **Monto:** $${this.formatMoney(context.amount)}\n📅 **Fecha límite:** ${this.formatDate(context.due_date)}\n\n¿Confirmas que todo está correcto?`
          : `Perfecto, voy a registrar:\n\n📝 **Préstamo a:** ${context.contact_info || context.temp_contact_name}\n🎯 **Artículo:** ${context.item_description}\n📅 **Fecha límite:** ${this.formatDate(context.due_date)}\n\n¿Confirmas que todo está correcto?`
      },
      reschedule: {
        init: 'Vamos a reprogramar una fecha.',
        awaiting_reschedule_date: '¿Para qué fecha quieres reprogramar?',
        confirming: `¿Confirmas que quieres reprogramar para el ${this.formatDate(context.new_date)}?`
      },
      new_service: {
        init: '¡Perfecto! Vamos a configurar un servicio recurrente.',
        awaiting_contact: '¿Para quién es este servicio?',
        awaiting_service_details: `¿Qué servicio le vas a cobrar a ${context.contact_info}?`,
        awaiting_recurrence: `¿Con qué frecuencia quieres cobrar "${context.service_description}"? (mensual, semanal, quincenal, diario)`,
        confirming: `Voy a configurar:\n\n👤 **Cliente:** ${context.contact_info}\n💼 **Servicio:** ${context.service_description}\n🔄 **Frecuencia:** ${context.recurrence}\n\n¿Confirmas?`
      }
    };

    return messages[flowType]?.[step] || 'Continuemos...';
  }

  // Obtener mensaje de completación
  private getCompletionMessage(flowType: FlowType, context: any): string {
    const messages = {
      new_loan: `✅ **Préstamo registrado exitosamente**\n\nTe avisaré cuando se acerque la fecha de vencimiento. El préstamo aparecerá en tu lista de acuerdos activos.`,
      reschedule: `✅ **Fecha reprogramada exitosamente**\n\nHe actualizado la fecha del acuerdo. Te enviaré recordatorios para la nueva fecha.`,
      new_service: `✅ **Servicio recurrente configurado**\n\nHe programado los cobros automáticos. Te notificaré cada vez que sea momento de enviar el recordatorio.`,
      confirm_return: `✅ **Devolución confirmada**\n\nHe marcado el préstamo como completado. ¡Gracias por mantener tus registros actualizados!`,
      confirm_payment: `✅ **Pago confirmado**\n\nHe registrado el pago. El acuerdo se ha marcado como completado.`,
      general_inquiry: `Gracias por tu consulta. Si necesitas ayuda específica, puedes escribir comandos como "nuevo préstamo", "reprogramar" o "estado".`
    };

    return messages[flowType] || '✅ Proceso completado exitosamente.';
  }

  // Validaciones auxiliares
  private validateContact(input: string): boolean {
    const trimmed = input.trim();
    // Debe tener al menos 2 caracteres y no ser solo números (a menos que sea un teléfono válido)
    if (trimmed.length < 2) return false;

    // Si es solo números, debe parecer un teléfono
    if (/^\d+$/.test(trimmed)) {
      return trimmed.length >= 10;
    }

    return true;
  }

  private validateDate(input: string): boolean {
    const text = input.toLowerCase().trim();

    // Palabras clave para fechas relativas
    const relativeKeywords = ['mañana', 'hoy', 'pasado', 'próximo', 'siguiente', 'semana', 'día'];
    if (relativeKeywords.some(keyword => text.includes(keyword))) {
      return true;
    }

    // Nombres de meses en español
    const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    if (monthNames.some(month => text.includes(month))) {
      return true;
    }

    // Validación específica para "mes" (no nombres de meses)
    if (text.match(/\b(en\s+)?(un\s+)?mes\b/) || text.match(/pr[oó]ximo\s+mes/)) {
      return true;
    }

    // Intentar parsear como fecha
    try {
      const parsed = this.parseDate(input);
      return parsed !== null;
    } catch {
      return false;
    }
  }

  private validateMoneyAmount(input: string): boolean {
    // Eliminar caracteres no numéricos excepto punto y coma
    const cleaned = input.replace(/[^0-9.,]/g, '');

    // Debe tener al menos un dígito
    if (!/\d/.test(cleaned)) {
      return false;
    }

    // Intentar convertir a número
    try {
      const amount = this.parseMoneyAmount(input);
      return amount > 0;
    } catch {
      return false;
    }
  }

  private parseMoneyAmount(input: string): number {
    // Eliminar símbolos de moneda, espacios y comas
    let cleaned = input
      .replace(/[$€£¥]/g, '') // Símbolos de moneda
      .replace(/\s/g, '') // Espacios
      .replace(/,/g, ''); // Comas

    // Convertir a número y redondear a entero
    const amount = parseFloat(cleaned);

    if (isNaN(amount)) {
      throw new Error('Invalid money amount');
    }

    // Redondear a entero (si tiene decimales)
    return Math.round(amount);
  }

  // Formatear monto con separador de miles (punto)
  private formatMoney(amount: number): string {
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  // Formatear fecha en formato dd/mm/aa (formato chileno)
  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2); // Últimos 2 dígitos
    return `${day}/${month}/${year}`;
  }

  // Helper para formatear fecha como YYYY-MM-DD sin conversión UTC
  private formatDateLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private parseDate(input: string): string | null {
    const text = input.toLowerCase().trim();

    // Usar timezone de Chile (America/Santiago = UTC-3)
    const now = new Date();
    const chileOffset = -3 * 60; // UTC-3 en minutos
    const localTime = new Date(now.getTime() + (chileOffset - now.getTimezoneOffset()) * 60000);

    // Fechas relativas comunes
    if (text === 'mañana') {
      const tomorrow = new Date(localTime);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return this.formatDateLocal(tomorrow);
    }

    if (text === 'hoy') {
      return this.formatDateLocal(localTime);
    }

    // Parser para fechas con nombres de meses (debe ir ANTES de validación genérica de "mes")
    const monthNames = {
      'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
      'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
    };

    // Buscar patrón "DD de MES" o "D de MES"
    const datePattern = /(\d{1,2})\s+de\s+(\w+)/;
    const match = text.match(datePattern);

    if (match) {
      const day = parseInt(match[1]);
      const monthName = match[2];
      const monthIndex = monthNames[monthName];

      if (monthIndex !== undefined && day >= 1 && day <= 31) {
        const year = localTime.getFullYear();
        const targetDate = new Date(year, monthIndex, day);

        // Si la fecha ya pasó este año, usar el próximo año
        if (targetDate < localTime) {
          targetDate.setFullYear(year + 1);
        }

        return this.formatDateLocal(targetDate);
      }
    }

    if (text.includes('semana')) {
      const nextWeek = new Date(localTime);
      nextWeek.setDate(nextWeek.getDate() + 7);
      return this.formatDateLocal(nextWeek);
    }

    // Validación más específica para "mes" (evitar conflictos con nombres de meses)
    if (text.match(/\b(en\s+)?(un\s+)?mes\b/) || text.match(/pr[oó]ximo\s+mes/)) {
      const nextMonth = new Date(localTime);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      return this.formatDateLocal(nextMonth);
    }

    // Intentar parsear fecha específica (formato flexible)
    try {
      const date = new Date(input);
      if (!isNaN(date.getTime())) {
        return this.formatDateLocal(date);
      }
    } catch {
      // Fallar silenciosamente
    }

    return null;
  }

  // Limpiar estados expirados
  async cleanupExpiredStates(): Promise<number> {
    const { data } = await this.supabase
      .from('conversation_states')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('id');

    return data?.length || 0;
  }

  // Obtener estado actual de conversación
  async getCurrentState(tenantId: string, contactId: string): Promise<ConversationState | null> {
    const { data } = await this.supabase
      .from('conversation_states')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('contact_id', contactId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return data;
  }

  // Cancelar conversación actual
  async cancelCurrentConversation(tenantId: string, contactId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('conversation_states')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('contact_id', contactId);

    return !error;
  }
}