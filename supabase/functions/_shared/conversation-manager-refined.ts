// Conversation Manager Refinado - Sistema completo con opt-in y notificaciones
// Implementa estados granulares, validaciones estrictas y flujo de dueño

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Tipos del sistema refinado
type FlowType = 'new_loan' | 'new_service' | 'reschedule' | 'confirm_return' | 'confirm_payment' | 'general_inquiry';
type FlowStep = 'init' | 'awaiting_contact' | 'awaiting_item' | 'awaiting_due_date' | 'awaiting_confirmation' |
                'awaiting_reschedule_date' | 'awaiting_service_details' | 'awaiting_recurrence' |
                'confirming' | 'complete' | 'cancelled' | 'opt_in_pending' | 'due_soon' | 'dia_d' |
                'vencido' | 'reprogramacion' | 'devuelto_pagado';

interface ConversationState {
  id?: string;
  tenant_id: string;
  contact_id: string;
  flow_type: FlowType;
  current_step: FlowStep;
  context: Record<string, any>;
  expires_at: string;
}

interface RefinedFlowDefinition {
  steps: FlowStep[];
  validations: Record<FlowStep, (context: any, input: string) => boolean>;
  transitions: Record<FlowStep, FlowStep | ((context: any, input: string) => FlowStep)>;
  handlers: Record<FlowStep, (context: any, input: string) => any>;
  requiresOptIn: boolean;
}

interface RescheduleOption {
  id: string;
  label: string;
  days: number;
  isCustom: boolean;
}

export class ConversationManagerRefined {
  private supabase: any;
  private flows: Record<FlowType, RefinedFlowDefinition>;
  private rescheduleOptions: RescheduleOption[] = [
    { id: '24h', label: '+24 horas', days: 1, isCustom: false },
    { id: '3d', label: '+3 días', days: 3, isCustom: false },
    { id: 'custom', label: 'Elegir fecha', days: 0, isCustom: true }
  ];

  constructor(supabaseUrl: string, supabaseServiceKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.flows = this.initializeRefinedFlows();
  }

  private initializeRefinedFlows(): Record<FlowType, RefinedFlowDefinition> {
    return {
      new_loan: {
        steps: ['init', 'awaiting_contact', 'awaiting_item', 'awaiting_due_date', 'opt_in_pending', 'confirming', 'complete'],
        requiresOptIn: true,
        validations: {
          init: () => true,
          awaiting_contact: (context, input) => this.validateContact(input),
          awaiting_item: (context, input) => input.trim().length >= 3,
          awaiting_due_date: (context, input) => this.validateDate(input),
          opt_in_pending: (context, input) => ['aceptar', 'acepto', 'sí', 'si', 'ok'].includes(input.toLowerCase()),
          confirming: (context, input) => ['si', 'sí', 'yes', 'confirmar', 'ok'].includes(input.toLowerCase()),
          complete: () => true,
          cancelled: () => true,
          awaiting_confirmation: () => true,
          awaiting_reschedule_date: () => true,
          awaiting_service_details: () => true,
          awaiting_recurrence: () => true,
          due_soon: () => true,
          dia_d: () => true,
          vencido: () => true,
          reprogramacion: () => true,
          devuelto_pagado: () => true
        },
        transitions: {
          init: 'awaiting_contact',
          awaiting_contact: 'awaiting_item',
          awaiting_item: 'awaiting_due_date',
          awaiting_due_date: (context, input) => {
            // Si el contacto no tiene opt-in, ir a opt_in_pending
            return context.contact_opt_in ? 'confirming' : 'opt_in_pending';
          },
          opt_in_pending: 'confirming',
          confirming: 'complete',
          complete: 'complete',
          cancelled: 'cancelled',
          awaiting_confirmation: 'confirming',
          awaiting_reschedule_date: 'confirming',
          awaiting_service_details: 'confirming',
          awaiting_recurrence: 'confirming',
          due_soon: 'due_soon',
          dia_d: 'dia_d',
          vencido: 'vencido',
          reprogramacion: 'confirming',
          devuelto_pagado: 'complete'
        },
        handlers: {
          init: () => ({ message: '¡Perfecto! Vamos a crear un nuevo préstamo. ¿A quién se lo vas a prestar? Puedes escribir su nombre o número de teléfono.' }),
          awaiting_contact: (context, input) => ({ contact_info: input }),
          awaiting_item: (context, input) => ({ item_description: input }),
          awaiting_due_date: (context, input) => ({ due_date: this.parseDate(input) }),
          opt_in_pending: (context, input) => ({ opt_in_accepted: true }),
          confirming: (context) => ({ confirmed: true }),
          complete: () => ({}),
          cancelled: () => ({}),
          awaiting_confirmation: () => ({}),
          awaiting_reschedule_date: () => ({}),
          awaiting_service_details: () => ({}),
          awaiting_recurrence: () => ({}),
          due_soon: () => ({}),
          dia_d: () => ({}),
          vencido: () => ({}),
          reprogramacion: () => ({}),
          devuelto_pagado: () => ({})
        }
      },
      reschedule: {
        steps: ['init', 'reprogramacion', 'confirming', 'complete'],
        requiresOptIn: false,
        validations: {
          init: () => true,
          reprogramacion: (context, input) => {
            const option = this.rescheduleOptions.find(opt =>
              opt.label.toLowerCase().includes(input.toLowerCase()) ||
              opt.id === input.toLowerCase()
            );
            return option !== undefined || this.validateDate(input);
          },
          confirming: (context, input) => ['si', 'sí', 'yes', 'confirmar', 'ok'].includes(input.toLowerCase()),
          complete: () => true,
          cancelled: () => true,
          awaiting_contact: () => true,
          awaiting_item: () => true,
          awaiting_due_date: () => true,
          awaiting_confirmation: () => true,
          awaiting_reschedule_date: () => true,
          awaiting_service_details: () => true,
          awaiting_recurrence: () => true,
          opt_in_pending: () => true,
          due_soon: () => true,
          dia_d: () => true,
          vencido: () => true,
          devuelto_pagado: () => true
        },
        transitions: {
          init: 'reprogramacion',
          reprogramacion: 'confirming',
          confirming: 'complete',
          complete: 'complete',
          cancelled: 'cancelled',
          awaiting_contact: 'reprogramacion',
          awaiting_item: 'reprogramacion',
          awaiting_due_date: 'reprogramacion',
          awaiting_confirmation: 'confirming',
          awaiting_reschedule_date: 'confirming',
          awaiting_service_details: 'reprogramacion',
          awaiting_recurrence: 'reprogramacion',
          opt_in_pending: 'reprogramacion',
          due_soon: 'reprogramacion',
          dia_d: 'reprogramacion',
          vencido: 'reprogramacion',
          devuelto_pagado: 'complete'
        },
        handlers: {
          init: () => ({
            message: 'Para reprogramar, elige una opción:\n\n1️⃣ +24 horas\n2️⃣ +3 días\n3️⃣ Elegir fecha específica\n\n¿Qué prefieres?'
          }),
          reprogramacion: (context, input) => this.handleRescheduleOption(input),
          confirming: (context) => ({ confirmed: true }),
          complete: () => ({}),
          cancelled: () => ({}),
          awaiting_contact: () => ({}),
          awaiting_item: () => ({}),
          awaiting_due_date: () => ({}),
          awaiting_confirmation: () => ({}),
          awaiting_reschedule_date: () => ({}),
          awaiting_service_details: () => ({}),
          awaiting_recurrence: () => ({}),
          opt_in_pending: () => ({}),
          due_soon: () => ({}),
          dia_d: () => ({}),
          vencido: () => ({}),
          devuelto_pagado: () => ({})
        }
      },
      new_service: {
        steps: ['init', 'awaiting_contact', 'awaiting_service_details', 'awaiting_recurrence', 'opt_in_pending', 'confirming', 'complete'],
        requiresOptIn: true,
        validations: {
          init: () => true,
          awaiting_contact: (context, input) => this.validateContact(input),
          awaiting_service_details: (context, input) => input.trim().length >= 3,
          awaiting_recurrence: (context, input) => ['mensual', 'semanal', 'quincenal', 'diario'].includes(input.toLowerCase()),
          opt_in_pending: (context, input) => ['aceptar', 'acepto', 'sí', 'si', 'ok'].includes(input.toLowerCase()),
          confirming: (context, input) => ['si', 'sí', 'yes', 'confirmar', 'ok'].includes(input.toLowerCase()),
          complete: () => true,
          cancelled: () => true,
          awaiting_item: () => true,
          awaiting_due_date: () => true,
          awaiting_confirmation: () => true,
          awaiting_reschedule_date: () => true,
          due_soon: () => true,
          dia_d: () => true,
          vencido: () => true,
          reprogramacion: () => true,
          devuelto_pagado: () => true
        },
        transitions: {
          init: 'awaiting_contact',
          awaiting_contact: 'awaiting_service_details',
          awaiting_service_details: 'awaiting_recurrence',
          awaiting_recurrence: (context, input) => {
            return context.contact_opt_in ? 'confirming' : 'opt_in_pending';
          },
          opt_in_pending: 'confirming',
          confirming: 'complete',
          complete: 'complete',
          cancelled: 'cancelled',
          awaiting_item: 'awaiting_service_details',
          awaiting_due_date: 'awaiting_recurrence',
          awaiting_confirmation: 'confirming',
          awaiting_reschedule_date: 'confirming',
          due_soon: 'due_soon',
          dia_d: 'dia_d',
          vencido: 'vencido',
          reprogramacion: 'confirming',
          devuelto_pagado: 'complete'
        },
        handlers: {
          init: () => ({ message: '¡Perfecto! Vamos a configurar un servicio recurrente. ¿Para quién es este servicio?' }),
          awaiting_contact: (context, input) => ({ contact_info: input }),
          awaiting_service_details: (context, input) => ({ service_description: input }),
          awaiting_recurrence: (context, input) => ({ recurrence: input }),
          opt_in_pending: (context, input) => ({ opt_in_accepted: true }),
          confirming: (context) => ({ confirmed: true }),
          complete: () => ({}),
          cancelled: () => ({}),
          awaiting_item: () => ({}),
          awaiting_due_date: () => ({}),
          awaiting_confirmation: () => ({}),
          awaiting_reschedule_date: () => ({}),
          due_soon: () => ({}),
          dia_d: () => ({}),
          vencido: () => ({}),
          reprogramacion: () => ({}),
          devuelto_pagado: () => ({})
        }
      },
      confirm_return: {
        steps: ['init', 'devuelto_pagado', 'complete'],
        requiresOptIn: false,
        validations: {
          init: () => true,
          devuelto_pagado: (context, input) => ['si', 'sí', 'yes', 'confirmar', 'devuelto', 'entregado'].includes(input.toLowerCase()),
          complete: () => true,
          cancelled: () => true,
          awaiting_contact: () => true,
          awaiting_item: () => true,
          awaiting_due_date: () => true,
          awaiting_confirmation: () => true,
          awaiting_reschedule_date: () => true,
          awaiting_service_details: () => true,
          awaiting_recurrence: () => true,
          opt_in_pending: () => true,
          confirming: () => true,
          due_soon: () => true,
          dia_d: () => true,
          vencido: () => true,
          reprogramacion: () => true
        },
        transitions: {
          init: 'devuelto_pagado',
          devuelto_pagado: 'complete',
          complete: 'complete',
          cancelled: 'cancelled',
          awaiting_contact: 'devuelto_pagado',
          awaiting_item: 'devuelto_pagado',
          awaiting_due_date: 'devuelto_pagado',
          awaiting_confirmation: 'devuelto_pagado',
          awaiting_reschedule_date: 'devuelto_pagado',
          awaiting_service_details: 'devuelto_pagado',
          awaiting_recurrence: 'devuelto_pagado',
          opt_in_pending: 'devuelto_pagado',
          confirming: 'devuelto_pagado',
          due_soon: 'devuelto_pagado',
          dia_d: 'devuelto_pagado',
          vencido: 'devuelto_pagado',
          reprogramacion: 'devuelto_pagado'
        },
        handlers: {
          init: () => ({ message: '¿Confirmas que ya te devolvieron el artículo prestado?' }),
          devuelto_pagado: (context) => ({ confirmed: true }),
          complete: () => ({}),
          cancelled: () => ({}),
          awaiting_contact: () => ({}),
          awaiting_item: () => ({}),
          awaiting_due_date: () => ({}),
          awaiting_confirmation: () => ({}),
          awaiting_reschedule_date: () => ({}),
          awaiting_service_details: () => ({}),
          awaiting_recurrence: () => ({}),
          opt_in_pending: () => ({}),
          confirming: () => ({}),
          due_soon: () => ({}),
          dia_d: () => ({}),
          vencido: () => ({}),
          reprogramacion: () => ({})
        }
      },
      confirm_payment: {
        steps: ['init', 'devuelto_pagado', 'complete'],
        requiresOptIn: false,
        validations: {
          init: () => true,
          devuelto_pagado: (context, input) => ['si', 'sí', 'yes', 'confirmar', 'pagado', 'completado'].includes(input.toLowerCase()),
          complete: () => true,
          cancelled: () => true,
          awaiting_contact: () => true,
          awaiting_item: () => true,
          awaiting_due_date: () => true,
          awaiting_confirmation: () => true,
          awaiting_reschedule_date: () => true,
          awaiting_service_details: () => true,
          awaiting_recurrence: () => true,
          opt_in_pending: () => true,
          confirming: () => true,
          due_soon: () => true,
          dia_d: () => true,
          vencido: () => true,
          reprogramacion: () => true
        },
        transitions: {
          init: 'devuelto_pagado',
          devuelto_pagado: 'complete',
          complete: 'complete',
          cancelled: 'cancelled',
          awaiting_contact: 'devuelto_pagado',
          awaiting_item: 'devuelto_pagado',
          awaiting_due_date: 'devuelto_pagado',
          awaiting_confirmation: 'devuelto_pagado',
          awaiting_reschedule_date: 'devuelto_pagado',
          awaiting_service_details: 'devuelto_pagado',
          awaiting_recurrence: 'devuelto_pagado',
          opt_in_pending: 'devuelto_pagado',
          confirming: 'devuelto_pagado',
          due_soon: 'devuelto_pagado',
          dia_d: 'devuelto_pagado',
          vencido: 'devuelto_pagado',
          reprogramacion: 'devuelto_pagado'
        },
        handlers: {
          init: () => ({ message: '¿Confirmas que ya realizaste el pago?' }),
          devuelto_pagado: (context) => ({ confirmed: true }),
          complete: () => ({}),
          cancelled: () => ({}),
          awaiting_contact: () => ({}),
          awaiting_item: () => ({}),
          awaiting_due_date: () => ({}),
          awaiting_confirmation: () => ({}),
          awaiting_reschedule_date: () => ({}),
          awaiting_service_details: () => ({}),
          awaiting_recurrence: () => ({}),
          opt_in_pending: () => ({}),
          confirming: () => ({}),
          due_soon: () => ({}),
          dia_d: () => ({}),
          vencido: () => ({}),
          reprogramacion: () => ({})
        }
      },
      general_inquiry: {
        steps: ['init', 'complete'],
        requiresOptIn: false,
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
          opt_in_pending: () => true,
          confirming: () => true,
          due_soon: () => true,
          dia_d: () => true,
          vencido: () => true,
          reprogramacion: () => true,
          devuelto_pagado: () => true
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
          opt_in_pending: 'complete',
          confirming: 'complete',
          due_soon: 'complete',
          dia_d: 'complete',
          vencido: 'complete',
          reprogramacion: 'complete',
          devuelto_pagado: 'complete'
        },
        handlers: {
          init: () => ({ message: 'Entiendo que tienes una consulta. ¿En qué puedo ayudarte específicamente?' }),
          complete: () => ({}),
          cancelled: () => ({}),
          awaiting_contact: () => ({}),
          awaiting_item: () => ({}),
          awaiting_due_date: () => ({}),
          awaiting_confirmation: () => ({}),
          awaiting_reschedule_date: () => ({}),
          awaiting_service_details: () => ({}),
          awaiting_recurrence: () => ({}),
          opt_in_pending: () => ({}),
          confirming: () => ({}),
          due_soon: () => ({}),
          dia_d: () => ({}),
          vencido: () => ({}),
          reprogramacion: () => ({}),
          devuelto_pagado: () => ({})
        }
      }
    };
  }

  // Procesar entrada del usuario con sistema refinado
  async processInput(tenantId: string, contactId: string, input: string, flowType?: FlowType): Promise<{
    success: boolean;
    message?: string;
    nextStep?: FlowStep;
    completed?: boolean;
    context?: any;
    error?: string;
    requiresOptIn?: boolean;
    optInSent?: boolean;
  }> {
    try {
      // Detectar intención si no se especifica
      if (!flowType) {
        flowType = this.detectIntent(input);
      }

      const state = await this.getOrCreateConversationState(tenantId, contactId, flowType);
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
      let updatedContext = { ...state.context, ...handlerResult };

      // Verificar opt-in si es necesario
      if (flow.requiresOptIn && state.current_step === 'awaiting_due_date') {
        const contactOptIn = await this.checkContactOptIn(tenantId, contactId);
        updatedContext.contact_opt_in = contactOptIn;

        if (!contactOptIn) {
          // Enviar solicitud de opt-in
          await this.sendOptInRequest(tenantId, contactId, updatedContext);
          updatedContext.opt_in_sent = true;
        }
      }

      // Determinar siguiente paso
      const transition = flow.transitions[state.current_step];
      const nextStep = typeof transition === 'function' ?
        transition(updatedContext, input) : transition;

      const isCompleted = nextStep === 'complete';

      // Actualizar estado en base de datos
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
        context: updatedContext,
        requiresOptIn: flow.requiresOptIn && nextStep === 'opt_in_pending',
        optInSent: updatedContext.opt_in_sent
      };

    } catch (error) {
      console.error('Error processing conversation input:', error);
      return { success: false, error: error.message };
    }
  }

  // Verificar opt-in del contacto
  private async checkContactOptIn(tenantId: string, contactId: string): Promise<boolean> {
    try {
      const { data: contact } = await this.supabase
        .from('contacts')
        .select('opt_in_status')
        .eq('tenant_id', tenantId)
        .eq('id', contactId)
        .single();

      return contact?.opt_in_status === 'opted_in';
    } catch (error) {
      console.error('Error checking opt-in status:', error);
      return false;
    }
  }

  // Enviar solicitud de opt-in
  private async sendOptInRequest(tenantId: string, contactId: string, context: any): Promise<void> {
    try {
      // Obtener información del tenant y contacto
      const { data: tenant } = await this.supabase
        .from('tenants')
        .select('name')
        .eq('id', tenantId)
        .single();

      const { data: contact } = await this.supabase
        .from('contacts')
        .select('name')
        .eq('id', contactId)
        .single();

      if (!tenant || !contact) return;

      // Preparar variables para template de opt-in
      const templateVars = {
        '1': contact.name || 'Usuario',
        '2': tenant.name || 'Empresa',
        '3': context.service_description ? 'servicios mensuales' : 'préstamos y devoluciones'
      };

      // Marcar que se envió opt-in request
      await this.supabase
        .from('agreements')
        .update({
          opt_in_required: true,
          opt_in_sent_at: new Date().toISOString()
        })
        .eq('contact_id', contactId)
        .eq('status', 'active');

      console.log('Opt-in request prepared for template:', templateVars);
    } catch (error) {
      console.error('Error sending opt-in request:', error);
    }
  }

  // Manejar opciones de reprogramación
  private handleRescheduleOption(input: string): any {
    const lowerInput = input.toLowerCase();

    if (lowerInput.includes('24') || lowerInput.includes('1')) {
      const newDate = new Date();
      newDate.setDate(newDate.getDate() + 1);
      return {
        reschedule_option: '24h',
        new_date: newDate.toISOString().split('T')[0]
      };
    }

    if (lowerInput.includes('3') || lowerInput.includes('tres')) {
      const newDate = new Date();
      newDate.setDate(newDate.getDate() + 3);
      return {
        reschedule_option: '3d',
        new_date: newDate.toISOString().split('T')[0]
      };
    }

    // Si es fecha específica
    const parsedDate = this.parseDate(input);
    if (parsedDate) {
      return {
        reschedule_option: 'custom',
        new_date: parsedDate
      };
    }

    return { reschedule_option: 'invalid' };
  }

  // Resto de métodos auxiliares (igual que antes pero con mejoras)

  private detectIntent(input: string): FlowType {
    const text = input.toLowerCase().trim();

    if (text.includes('prestar') || text.includes('préstamo') || text.includes('nuevo préstamo')) {
      return 'new_loan';
    }

    if (text.includes('reprogramar') || text.includes('cambiar fecha') || text.includes('posponer')) {
      return 'reschedule';
    }

    if (text.includes('servicio') || text.includes('mensual') || text.includes('recurrente')) {
      return 'new_service';
    }

    if (text.includes('devolvieron') || text.includes('entregaron') || text.includes('ya devolví')) {
      return 'confirm_return';
    }

    if (text.includes('pagué') || text.includes('pagado') || text.includes('ya pagué')) {
      return 'confirm_payment';
    }

    return 'general_inquiry';
  }

  private getValidationMessage(step: FlowStep): string {
    const messages = {
      awaiting_contact: 'Por favor proporciona un nombre válido o número de teléfono.',
      awaiting_item: 'Por favor describe qué vas a prestar (mínimo 3 caracteres).',
      awaiting_due_date: 'Por favor proporciona una fecha válida. Puedes escribir "mañana", "15 de enero", etc.',
      awaiting_service_details: 'Por favor describe el servicio (mínimo 3 caracteres).',
      awaiting_recurrence: 'Por favor especifica: mensual, semanal, quincenal o diario.',
      opt_in_pending: 'Para continuar, por favor responde "Aceptar" al consentimiento.',
      reprogramacion: 'Elige: 1) +24 horas, 2) +3 días, o 3) Fecha específica.',
      confirming: 'Por favor responde "sí" o "no" para confirmar.',
      devuelto_pagado: 'Por favor confirma: "sí" para completar.',
      init: 'Iniciando conversación...',
      complete: 'Conversación completada.',
      cancelled: 'Conversación cancelada.',
      awaiting_confirmation: 'Por favor confirma tu respuesta.',
      awaiting_reschedule_date: 'Por favor proporciona una fecha válida.',
      due_soon: 'Acuerdo próximo a vencer.',
      dia_d: 'Día de vencimiento.',
      vencido: 'Acuerdo vencido.'
    };

    return messages[step] || 'Por favor proporciona una respuesta válida.';
  }

  private getStepMessage(flowType: FlowType, step: FlowStep, context: any): string {
    if (step === 'complete') {
      return this.getCompletionMessage(flowType, context);
    }

    if (step === 'opt_in_pending') {
      return `Para poder enviarte recordatorios, necesitamos tu consentimiento.\n\n📱 Te enviaremos una solicitud de autorización por separado.\n\n¿Aceptas recibir recordatorios de ${context.service_description || 'préstamos'}?`;
    }

    const messages = {
      new_loan: {
        awaiting_contact: '¡Perfecto! Vamos a crear un nuevo préstamo. ¿A quién se lo vas a prestar?',
        awaiting_item: `¿Qué le vas a prestar a ${context.contact_info}?`,
        awaiting_due_date: `¿Para cuándo debe devolver "${context.item_description}"?`,
        confirming: `Perfecto, voy a registrar:\n\n📝 **Préstamo a:** ${context.contact_info}\n🎯 **Artículo:** ${context.item_description}\n📅 **Fecha límite:** ${context.due_date}\n\n¿Confirmas que todo está correcto?`
      },
      reschedule: {
        reprogramacion: 'Elige una opción para reprogramar:\n\n1️⃣ +24 horas\n2️⃣ +3 días\n3️⃣ Fecha específica\n\n¿Qué prefieres?',
        confirming: `¿Confirmas que quieres reprogramar para el ${context.new_date}?`
      },
      new_service: {
        awaiting_contact: '¡Perfecto! Vamos a configurar un servicio recurrente. ¿Para quién es?',
        awaiting_service_details: `¿Qué servicio le vas a cobrar a ${context.contact_info}?`,
        awaiting_recurrence: `¿Con qué frecuencia quieres cobrar "${context.service_description}"?\n\nOpciones: mensual, semanal, quincenal, diario`,
        confirming: `Voy a configurar:\n\n👤 **Cliente:** ${context.contact_info}\n💼 **Servicio:** ${context.service_description}\n🔄 **Frecuencia:** ${context.recurrence}\n\n¿Confirmas?`
      }
    };

    return messages[flowType]?.[step] || 'Continuemos...';
  }

  private getCompletionMessage(flowType: FlowType, context: any): string {
    const messages = {
      new_loan: `✅ **Préstamo registrado exitosamente**\n\nTe avisaré cuando se acerque la fecha de vencimiento. ${context.opt_in_sent ? 'Esperando confirmación de consentimiento del contacto.' : ''}`,
      reschedule: `✅ **Fecha reprogramada exitosamente**\n\nHe actualizado la fecha del acuerdo para el ${context.new_date}.`,
      new_service: `✅ **Servicio recurrente configurado**\n\nHe programado los cobros ${context.recurrence}. ${context.opt_in_sent ? 'Esperando confirmación de consentimiento del contacto.' : ''}`,
      confirm_return: `✅ **Devolución confirmada**\n\nHe marcado el préstamo como completado. ¡Gracias!`,
      confirm_payment: `✅ **Pago confirmado**\n\nHe registrado el pago. El acuerdo se ha completado.`,
      general_inquiry: `Gracias por tu consulta. Si necesitas ayuda específica, escribe comandos como "nuevo préstamo", "reprogramar" o "estado".`
    };

    return messages[flowType] || '✅ Proceso completado exitosamente.';
  }

  private validateContact(input: string): boolean {
    const trimmed = input.trim();
    if (trimmed.length < 2) return false;

    // Si es solo números, debe parecer un teléfono
    if (/^\d+$/.test(trimmed)) {
      return trimmed.length >= 8; // Mínimo 8 dígitos para teléfono
    }

    return true;
  }

  private validateDate(input: string): boolean {
    const text = input.toLowerCase().trim();

    // Palabras clave para fechas relativas
    const relativeKeywords = ['mañana', 'hoy', 'pasado', 'próximo', 'siguiente', 'semana', 'mes', 'día'];
    if (relativeKeywords.some(keyword => text.includes(keyword))) {
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

  private parseDate(input: string): string | null {
    const text = input.toLowerCase().trim();
    const now = new Date();

    // Fechas relativas comunes
    if (text === 'mañana') {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString().split('T')[0];
    }

    if (text === 'hoy') {
      return now.toISOString().split('T')[0];
    }

    if (text.includes('semana') || text === '7 días') {
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);
      return nextWeek.toISOString().split('T')[0];
    }

    if (text.includes('mes')) {
      const nextMonth = new Date(now);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      return nextMonth.toISOString().split('T')[0];
    }

    // Intentar parsear fecha específica
    try {
      const date = new Date(input);
      if (!isNaN(date.getTime()) && date > now) {
        return date.toISOString().split('T')[0];
      }
    } catch {
      // Fallar silenciosamente
    }

    return null;
  }

  // Métodos de utilidad (igual que antes)
  async getOrCreateConversationState(tenantId: string, contactId: string, flowType: FlowType): Promise<ConversationState> {
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

    const newState: ConversationState = {
      tenant_id: tenantId,
      contact_id: contactId,
      flow_type: flowType,
      current_step: 'init',
      context: {},
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
    };

    const { data: createdState } = await this.supabase
      .from('conversation_states')
      .insert(newState)
      .select()
      .single();

    return createdState;
  }

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

  async cancelCurrentConversation(tenantId: string, contactId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('conversation_states')
      .update({ current_step: 'cancelled' })
      .eq('tenant_id', tenantId)
      .eq('contact_id', contactId)
      .gt('expires_at', new Date().toISOString());

    return !error;
  }

  async cleanupExpiredStates(): Promise<number> {
    const { data } = await this.supabase
      .from('conversation_states')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('id');

    return data?.length || 0;
  }

  // Crear acuerdo cuando se completa un flujo
  async createAgreementFromFlow(tenantId: string, contactId: string, flowType: FlowType, context: any): Promise<{
    success: boolean;
    agreementId?: string;
    error?: string;
  }> {
    try {
      const agreementData = this.prepareAgreementData(tenantId, contactId, flowType, context);

      const { data: agreement, error: agreementError } = await this.supabase
        .from('agreements')
        .insert(agreementData)
        .select()
        .single();

      if (agreementError) {
        throw new Error(`Error creando acuerdo: ${agreementError.message}`);
      }

      // Crear notificación al dueño
      await this.createOwnerNotification(
        tenantId,
        'agreement_completed',
        'Nuevo Acuerdo Creado',
        `Se ha creado un nuevo acuerdo: "${agreement.title}"`,
        agreement.id,
        contactId,
        'normal'
      );

      return { success: true, agreementId: agreement.id };

    } catch (error) {
      console.error('Error creating agreement from flow:', error);
      return { success: false, error: error.message };
    }
  }

  // Preparar datos del acuerdo según el tipo de flujo
  private prepareAgreementData(tenantId: string, contactId: string, flowType: FlowType, context: any): any {
    const baseData = {
      tenant_id: tenantId,
      contact_id: contactId,
      title: context.item_description || context.service_description || 'Acuerdo',
      description: context.description || null,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      opt_in_required: context.contact_opt_in ? false : true,
      opt_in_sent_at: context.opt_in_sent ? new Date().toISOString() : null,
      reminder_sequence_step: 0
    };

    if (flowType === 'new_loan') {
      return {
        ...baseData,
        agreement_type: 'loan',
        due_date: context.due_date ? new Date(context.due_date).toISOString() : null,
        item_description: context.item_description,
        amount: context.amount ? parseFloat(context.amount) : null,
        currency: 'CLP'
      };
    }

    if (flowType === 'new_service') {
      return {
        ...baseData,
        agreement_type: 'service',
        due_date: context.due_date ? new Date(context.due_date).toISOString() : null,
        next_due_date: context.due_date ? new Date(context.due_date).toISOString() : null,
        recurrence_rule: context.recurrence_type || 'monthly',
        rrule: this.generateRRULE(context.recurrence_type, context.due_date),
        amount: context.amount ? parseFloat(context.amount) : null,
        currency: 'CLP'
      };
    }

    return baseData;
  }

  // Generar RRULE para servicios recurrentes
  private generateRRULE(recurrenceType: string, startDate: string): string {
    const date = new Date(startDate);
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');

    switch (recurrenceType) {
      case 'weekly':
        return `FREQ=WEEKLY;DTSTART=${dateStr}`;
      case 'monthly':
        return `FREQ=MONTHLY;DTSTART=${dateStr}`;
      case 'yearly':
        return `FREQ=YEARLY;DTSTART=${dateStr}`;
      default:
        return `FREQ=MONTHLY;DTSTART=${dateStr}`;
    }
  }

  // Crear notificación al dueño
  async createOwnerNotification(
    tenantId: string,
    notificationType: string,
    title: string,
    message: string,
    agreementId?: string,
    contactId?: string,
    priority: string = 'normal'
  ): Promise<void> {
    try {
      await this.supabase.rpc('create_owner_notification', {
        p_tenant_id: tenantId,
        p_notification_type: notificationType,
        p_title: title,
        p_message: message,
        p_agreement_id: agreementId || null,
        p_contact_id: contactId || null,
        p_priority: priority
      });

      console.log(`✅ Notificación al dueño creada: ${title}`);
    } catch (error) {
      console.error('Error creating owner notification:', error);
    }
  }

  // Manejar respuesta de opt-in
  async handleOptInResponse(tenantId: string, contactId: string, response: 'accepted' | 'rejected'): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      // Actualizar estado de opt-in del contacto
      const { error: contactError } = await this.supabase
        .from('contacts')
        .update({
          opt_in_status: response === 'accepted' ? 'opted_in' : 'opted_out',
          opt_in_response_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('tenant_id', tenantId)
        .eq('id', contactId);

      if (contactError) {
        throw new Error(`Error actualizando opt-in: ${contactError.message}`);
      }

      if (response === 'rejected') {
        // Cancelar acuerdos pendientes
        await this.supabase
          .from('agreements')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('tenant_id', tenantId)
          .eq('contact_id', contactId)
          .eq('status', 'active')
          .eq('opt_in_required', true);

        // Notificar al dueño del rechazo
        await this.createOwnerNotification(
          tenantId,
          'opt_in_rejected',
          'Opt-in Rechazado',
          'Un contacto ha rechazado recibir recordatorios por WhatsApp.',
          undefined,
          contactId,
          'high'
        );

        return {
          success: true,
          message: 'Entendido. No recibirás más recordatorios por WhatsApp.'
        };
      } else {
        // Activar acuerdos pendientes
        await this.supabase
          .from('agreements')
          .update({
            opt_in_required: false,
            updated_at: new Date().toISOString()
          })
          .eq('tenant_id', tenantId)
          .eq('contact_id', contactId)
          .eq('opt_in_required', true);

        return {
          success: true,
          message: '¡Perfecto! Ahora recibirás recordatorios oportunos por WhatsApp. Gracias por aceptar.'
        };
      }

    } catch (error) {
      console.error('Error handling opt-in response:', error);
      return { success: false, error: error.message };
    }
  }

  // Manejar confirmación de devolución/pago
  async handleReturnPaymentConfirmation(
    tenantId: string,
    contactId: string,
    agreementId: string,
    type: 'returned' | 'paid'
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      // Actualizar estado del acuerdo
      const { data: agreement, error: updateError } = await this.supabase
        .from('agreements')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', agreementId)
        .eq('tenant_id', tenantId)
        .select('title')
        .single();

      if (updateError) {
        throw new Error(`Error actualizando acuerdo: ${updateError.message}`);
      }

      // Notificar al dueño
      const actionText = type === 'returned' ? 'devuelto' : 'pagado';
      await this.createOwnerNotification(
        tenantId,
        type === 'returned' ? 'return_confirmed' : 'payment_confirmed',
        `${type === 'returned' ? 'Devolución' : 'Pago'} Confirmado`,
        `El cliente confirmó que ha ${actionText} "${agreement.title}".`,
        agreementId,
        contactId,
        'normal'
      );

      return {
        success: true,
        message: `¡Excelente! He registrado que ya ${type === 'returned' ? 'devolviste' : 'pagaste'} "${agreement.title}". Gracias por confirmar.`
      };

    } catch (error) {
      console.error('Error handling return/payment confirmation:', error);
      return { success: false, error: error.message };
    }
  }

  // Manejar solicitud de reprogramación
  async handleRescheduleRequest(
    tenantId: string,
    contactId: string,
    agreementId: string,
    newDate?: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (newDate) {
        updateData.due_date = new Date(newDate).toISOString();
        updateData.status = 'active'; // Reactivar si estaba vencido
      }

      const { data: agreement, error: updateError } = await this.supabase
        .from('agreements')
        .update(updateData)
        .eq('id', agreementId)
        .eq('tenant_id', tenantId)
        .select('title, due_date')
        .single();

      if (updateError) {
        throw new Error(`Error reprogramando acuerdo: ${updateError.message}`);
      }

      // Notificar al dueño
      await this.createOwnerNotification(
        tenantId,
        'reschedule_requested',
        'Reprogramación Solicitada',
        `El cliente solicitó reprogramar "${agreement.title}"${newDate ? ` para el ${new Date(newDate).toLocaleDateString('es-CL')}` : ''}.`,
        agreementId,
        contactId,
        'normal'
      );

      return {
        success: true,
        message: newDate
          ? `Perfecto, he reprogramado "${agreement.title}" para el ${new Date(newDate).toLocaleDateString('es-CL')}.`
          : 'He registrado tu solicitud de reprogramación. Te contactaremos para coordinar la nueva fecha.'
      };

    } catch (error) {
      console.error('Error handling reschedule request:', error);
      return { success: false, error: error.message };
    }
  }
}