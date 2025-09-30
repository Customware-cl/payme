// Telegram Conversation Manager
// ConversationManager adaptado específicamente para usuarios de Telegram

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Tipos importados del proyecto
type FlowType = 'new_loan' | 'new_service' | 'reschedule' | 'confirm_return' | 'confirm_payment' | 'general_inquiry';
type FlowStep = 'init' | 'awaiting_contact' | 'awaiting_item' | 'awaiting_due_date' | 'awaiting_confirmation' | 'awaiting_reschedule_date' | 'awaiting_service_details' | 'awaiting_recurrence' | 'confirming' | 'complete' | 'cancelled';

interface ConversationState {
  id?: string;
  tenant_id: string;
  contact_id: string;
  phone_number?: string; // Opcional para Telegram
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

export class TelegramConversationManager {
  private supabase: any;
  private flows: Record<FlowType, FlowDefinition>;

  constructor(supabaseUrl: string, supabaseServiceKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.flows = this.initializeFlows();
  }

  private initializeFlows(): Record<FlowType, FlowDefinition> {
    return {
      new_loan: {
        steps: ['init', 'awaiting_contact', 'awaiting_item', 'awaiting_due_date', 'confirming', 'complete'],
        validations: {
          init: () => true,
          awaiting_contact: (context, input) => this.validateContact(input),
          awaiting_item: (context, input) => input.trim().length > 3,
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
          awaiting_contact: 'awaiting_item',
          awaiting_item: 'awaiting_due_date',
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
          init: () => ({ message: '¡Perfecto! Vamos a crear un nuevo préstamo. ¿A quién se lo vas a prestar? Puedes escribir su nombre o número de teléfono.' }),
          awaiting_contact: (context, input) => ({ contact_info: input }),
          awaiting_item: (context, input) => ({ item_description: input }),
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
          awaiting_confirmation: 'complete',
          awaiting_service_details: 'confirming',
          awaiting_recurrence: 'confirming'
        },
        handlers: {
          init: () => ({ message: 'Vamos a reprogramar una fecha. ¿Para cuándo quieres reprogramar?' }),
          awaiting_reschedule_date: (context, input) => ({ new_due_date: this.parseDate(input) }),
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
        steps: ['init', 'awaiting_service_details', 'awaiting_recurrence', 'confirming', 'complete'],
        validations: {
          init: () => true,
          awaiting_service_details: (context, input) => input.trim().length > 5,
          awaiting_recurrence: (context, input) => this.validateRecurrence(input),
          confirming: (context, input) => ['si', 'sí', 'yes', 'confirmar', 'ok'].includes(input.toLowerCase()),
          complete: () => true,
          cancelled: () => true,
          awaiting_contact: () => true,
          awaiting_item: () => true,
          awaiting_due_date: () => true,
          awaiting_confirmation: () => true,
          awaiting_reschedule_date: () => true
        },
        transitions: {
          init: 'awaiting_service_details',
          awaiting_service_details: 'awaiting_recurrence',
          awaiting_recurrence: 'confirming',
          confirming: 'complete',
          complete: 'complete',
          cancelled: 'cancelled',
          awaiting_contact: 'awaiting_service_details',
          awaiting_item: 'awaiting_service_details',
          awaiting_due_date: 'awaiting_recurrence',
          awaiting_confirmation: 'complete',
          awaiting_reschedule_date: 'confirming'
        },
        handlers: {
          init: () => ({ message: 'Perfecto! Vamos a crear un nuevo servicio mensual. ¿Qué tipo de servicio ofreces?' }),
          awaiting_service_details: (context, input) => ({ service_description: input }),
          awaiting_recurrence: (context, input) => ({ recurrence: this.parseRecurrence(input) }),
          confirming: (context) => ({ confirmed: true }),
          complete: () => ({}),
          cancelled: () => ({}),
          awaiting_contact: () => ({}),
          awaiting_item: () => ({}),
          awaiting_due_date: () => ({}),
          awaiting_confirmation: () => ({}),
          awaiting_reschedule_date: () => ({})
        }
      },
      confirm_return: {
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
          init: () => ({ message: '✅ ¡Perfecto! He registrado que devolviste el artículo. Gracias!' }),
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
      },
      confirm_payment: {
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
          init: () => ({ message: '✅ ¡Excelente! He registrado tu pago. Gracias!' }),
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
          init: () => ({ message: 'He recibido tu consulta. ¿En qué más puedo ayudarte?' }),
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

  // Obtener o crear estado de conversación - adaptado para Telegram
  async getOrCreateConversationState(tenantId: string, contactId: string, flowType: FlowType): Promise<ConversationState> {
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

    if (existingState) {
      return existingState;
    }

    // Obtener información del contacto para phone_number
    const { data: contact, error: contactError } = await this.supabase
      .from('contacts')
      .select('phone_e164, telegram_id')
      .eq('id', contactId)
      .single();

    if (contactError || !contact) {
      throw new Error(`Contact not found: ${contactError?.message || 'Unknown error'}`);
    }

    // Para usuarios de Telegram, usar telegram_id como identificador
    const phoneNumber = contact.phone_e164 || `telegram_${contact.telegram_id}` || null;

    // Crear nuevo estado
    const newState: ConversationState = {
      tenant_id: tenantId,
      contact_id: contactId,
      phone_number: phoneNumber, // Puede ser null ahora
      flow_type: flowType,
      current_step: 'init',
      context: {},
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutos
    };

    const { data: createdState, error } = await this.supabase
      .from('conversation_states')
      .insert(newState)
      .select()
      .single();

    if (error) {
      console.error('Error creating conversation state:', error);
      throw new Error(`Failed to create conversation state: ${error.message}`);
    }

    return createdState;
  }

  // Procesar entrada del usuario
  async processInput(tenantId: string, contactId: string, input: string, flowType?: FlowType): Promise<{
    success: boolean;
    message?: string;
    nextStep?: FlowStep;
    completed?: boolean;
    context?: any;
    error?: string;
  }> {
    try {
      // Si no se especifica flowType, detectar intención
      if (!flowType) {
        flowType = this.detectIntent(input);
      }

      const state = await this.getOrCreateConversationState(tenantId, contactId, flowType);

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
      const updatedContext = { ...state.context, ...handlerResult };

      // Obtener siguiente paso
      const nextStep = flow.transitions[state.current_step];
      const isCompleted = nextStep === 'complete';

      // Actualizar estado
      if (!isCompleted) {
        await this.supabase
          .from('conversation_states')
          .update({
            current_step: nextStep,
            context: updatedContext,
            expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
          })
          .eq('id', state.id);
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

      return {
        success: true,
        message: this.getStepMessage(state.flow_type, nextStep, updatedContext),
        nextStep,
        completed: isCompleted,
        context: updatedContext
      };

    } catch (error) {
      console.error('Error processing input:', error);
      return {
        success: false,
        error: error.message || 'Error procesando entrada'
      };
    }
  }

  // Métodos auxiliares adaptados de ConversationManager original
  private detectIntent(input: string): FlowType {
    const lowerInput = input.toLowerCase();

    if (lowerInput.includes('préstamo') || lowerInput.includes('prestamo') || lowerInput.includes('prestar')) {
      return 'new_loan';
    }
    if (lowerInput.includes('servicio') || lowerInput.includes('mensual') || lowerInput.includes('recurrente')) {
      return 'new_service';
    }
    if (lowerInput.includes('reprogramar') || lowerInput.includes('cambiar fecha') || lowerInput.includes('postergar')) {
      return 'reschedule';
    }
    if (lowerInput.includes('devolví') || lowerInput.includes('pagué') || lowerInput.includes('confirmr')) {
      return 'confirm_return';
    }

    return 'general_inquiry';
  }

  private validateContact(input: string): boolean {
    return input.trim().length >= 2;
  }

  private validateDate(input: string): boolean {
    const datePatterns = [
      /^\d{1,2}\/\d{1,2}\/\d{4}$/,
      /^\d{1,2}-\d{1,2}-\d{4}$/,
      /^en \d+ días?$/i,
      /^mañana$/i,
      /^hoy$/i,
      /^la próxima semana$/i,
      /^el próximo mes$/i
    ];

    return datePatterns.some(pattern => pattern.test(input.trim()));
  }

  private validateRecurrence(input: string): boolean {
    const recurrencePatterns = [
      /mensual/i,
      /semanal/i,
      /cada.*días?/i,
      /cada.*semanas?/i,
      /cada.*mes/i
    ];

    return recurrencePatterns.some(pattern => pattern.test(input.trim()));
  }

  private parseDate(input: string): string {
    const now = new Date();
    const lowerInput = input.toLowerCase().trim();

    if (lowerInput === 'mañana') {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString();
    }

    if (lowerInput === 'hoy') {
      return now.toISOString();
    }

    const daysMatch = lowerInput.match(/en (\d+) días?/);
    if (daysMatch) {
      const days = parseInt(daysMatch[1]);
      const futureDate = new Date(now);
      futureDate.setDate(futureDate.getDate() + days);
      return futureDate.toISOString();
    }

    // Intento de parsing directo
    try {
      const parsed = new Date(input);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    } catch {}

    // Fallback: una semana desde hoy
    const oneWeek = new Date(now);
    oneWeek.setDate(oneWeek.getDate() + 7);
    return oneWeek.toISOString();
  }

  private parseRecurrence(input: string): string {
    const lowerInput = input.toLowerCase();

    if (lowerInput.includes('mensual') || lowerInput.includes('mes')) {
      return 'FREQ=MONTHLY;INTERVAL=1';
    }
    if (lowerInput.includes('semanal') || lowerInput.includes('semana')) {
      return 'FREQ=WEEKLY;INTERVAL=1';
    }

    return 'FREQ=MONTHLY;INTERVAL=1'; // Default mensual
  }

  private getStepMessage(flowType: FlowType, step: FlowStep, context: any): string {
    const stepMessages: Record<FlowType, Record<FlowStep, string>> = {
      new_loan: {
        init: '¡Perfecto! Vamos a crear un nuevo préstamo. ¿A quién se lo vas a prestar?',
        awaiting_contact: '¿Qué le vas a prestar a ' + (context.contact_info || 'esta persona') + '?',
        awaiting_item: '¿Para cuándo debe devolver "' + (context.item_description || 'el artículo') + '"?',
        awaiting_due_date: '¿Confirmas crear este préstamo?\n\n*Resumen:*\n• Para: ' + (context.contact_info || 'N/A') + '\n• Artículo: ' + (context.item_description || 'N/A') + '\n• Fecha: ' + (context.due_date ? new Date(context.due_date).toLocaleDateString() : 'N/A'),
        awaiting_confirmation: '',
        awaiting_reschedule_date: '',
        awaiting_service_details: '',
        awaiting_recurrence: '',
        confirming: '✅ ¡Préstamo creado exitosamente! Te enviaremos recordatorios automáticos.',
        complete: '',
        cancelled: ''
      },
      new_service: {
        init: 'Perfecto! Vamos a crear un nuevo servicio mensual. ¿Qué tipo de servicio ofreces?',
        awaiting_service_details: '¿Con qué frecuencia cobras este servicio? (ej: "mensual", "cada 15 días")',
        awaiting_recurrence: '¿Confirmas crear este servicio?\n\n*Resumen:*\n• Servicio: ' + (context.service_description || 'N/A') + '\n• Frecuencia: ' + (context.recurrence || 'N/A'),
        confirming: '✅ ¡Servicio mensual configurado! Te ayudaremos con los recordatorios.',
        init: '',
        awaiting_contact: '',
        awaiting_item: '',
        awaiting_due_date: '',
        awaiting_confirmation: '',
        awaiting_reschedule_date: '',
        complete: '',
        cancelled: ''
      },
      reschedule: {
        init: 'Vamos a reprogramar una fecha. ¿Para cuándo quieres reprogramar?',
        awaiting_reschedule_date: '¿Confirmas reprogramar para ' + (context.new_due_date ? new Date(context.new_due_date).toLocaleDateString() : 'la nueva fecha') + '?',
        confirming: '✅ ¡Fecha reprogramada exitosamente!',
        awaiting_contact: '',
        awaiting_item: '',
        awaiting_due_date: '',
        awaiting_confirmation: '',
        awaiting_service_details: '',
        awaiting_recurrence: '',
        complete: '',
        cancelled: ''
      },
      confirm_return: {
        init: '✅ ¡Perfecto! He registrado que devolviste el artículo. Gracias!',
        awaiting_contact: '',
        awaiting_item: '',
        awaiting_due_date: '',
        awaiting_confirmation: '',
        awaiting_reschedule_date: '',
        awaiting_service_details: '',
        awaiting_recurrence: '',
        confirming: '',
        complete: '',
        cancelled: ''
      },
      confirm_payment: {
        init: '✅ ¡Excelente! He registrado tu pago. Gracias!',
        awaiting_contact: '',
        awaiting_item: '',
        awaiting_due_date: '',
        awaiting_confirmation: '',
        awaiting_reschedule_date: '',
        awaiting_service_details: '',
        awaiting_recurrence: '',
        confirming: '',
        complete: '',
        cancelled: ''
      },
      general_inquiry: {
        init: 'He recibido tu consulta. ¿En qué más puedo ayudarte?',
        awaiting_contact: '',
        awaiting_item: '',
        awaiting_due_date: '',
        awaiting_confirmation: '',
        awaiting_reschedule_date: '',
        awaiting_service_details: '',
        awaiting_recurrence: '',
        confirming: '',
        complete: '',
        cancelled: ''
      }
    };

    return stepMessages[flowType]?.[step] || 'Continuemos...';
  }

  private getValidationMessage(step: FlowStep): string {
    const validationMessages: Record<FlowStep, string> = {
      init: '',
      awaiting_contact: 'Por favor proporciona un nombre válido (mínimo 2 caracteres).',
      awaiting_item: 'Por favor describe qué vas a prestar (mínimo 3 caracteres).',
      awaiting_due_date: 'Por favor proporciona una fecha válida (ej: "mañana", "en 5 días", "15/01/2024").',
      awaiting_confirmation: 'Por favor confirma con "sí" o "confirmar".',
      awaiting_reschedule_date: 'Por favor proporciona una fecha válida para reprogramar.',
      awaiting_service_details: 'Por favor describe el servicio (mínimo 5 caracteres).',
      awaiting_recurrence: 'Por favor especifica la frecuencia (ej: "mensual", "semanal").',
      confirming: '',
      complete: '',
      cancelled: ''
    };

    return validationMessages[step] || 'Entrada no válida. Por favor intenta de nuevo.';
  }

  // Otros métodos útiles
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

  async cancelCurrentConversation(tenantId: string, contactId: string): Promise<void> {
    await this.supabase
      .from('conversation_states')
      .update({
        current_step: 'cancelled',
        expires_at: new Date().toISOString() // Expira inmediatamente
      })
      .eq('tenant_id', tenantId)
      .eq('contact_id', contactId)
      .gt('expires_at', new Date().toISOString());
  }
}