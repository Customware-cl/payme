// Flow Handlers - Implementaciones específicas para cada flujo
// Maneja la lógica de negocio y persistencia de datos para cada tipo de flujo

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Función auxiliar para parsear números de teléfono
function parsePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (!cleaned.startsWith('52')) {
    cleaned = '52' + cleaned;
  }
  return '+' + cleaned;
}

// Función auxiliar para generar UUID simple
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Función auxiliar para formatear monto con separador de miles
function formatMoney(amount: number): string {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export class FlowHandlers {
  private supabase: any;

  constructor(supabaseUrl: string, supabaseServiceKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  // Handler para flujo de Nuevo Préstamo
  async handleNewLoanFlow(tenantId: string, contactId: string, context: any): Promise<{
    success: boolean;
    agreementId?: string;
    error?: string;
  }> {
    try {
      console.log('Handling new loan flow completion:', { tenantId, contactId, context });

      // 1. Obtener información del tenant y usuario creador
      const { data: tenant } = await this.supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .single();

      if (!tenant) {
        throw new Error('Tenant not found');
      }

      // Obtener usuario owner del tenant como created_by
      const { data: ownerUser } = await this.supabase
        .from('users')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('role', 'owner')
        .single();

      if (!ownerUser) {
        throw new Error('Owner user not found');
      }

      // 2. Obtener o crear contacto
      let contact = null;

      if (context.contact_id) {
        // Caso 1: Ya tenemos contact_id (contacto existente)
        console.log('Using existing contact_id:', context.contact_id);
        const { data: existingContact } = await this.supabase
          .from('contacts')
          .select('*')
          .eq('id', context.contact_id)
          .single();

        if (!existingContact) {
          throw new Error('Contact with id ' + context.contact_id + ' not found');
        }

        contact = existingContact;
        console.log('Found existing contact:', contact.name);

      } else if (context.temp_contact_name) {
        // Caso 2: Nuevo contacto que necesita ser creado
        console.log('Creating new contact:', context.temp_contact_name);

        const contactName = context.temp_contact_name;
        let phoneNumber;

        if (context.new_contact_phone) {
          // Caso 2a: Tiene teléfono proporcionado
          phoneNumber = parsePhoneNumber(context.new_contact_phone);
          console.log('Using provided phone:', phoneNumber);
        } else {
          // Caso 2b: Sin teléfono, usar placeholder
          const timestamp = Date.now().toString().slice(-10);
          const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
          phoneNumber = `+PEND${timestamp}${random}`;
          console.log('Using placeholder phone:', phoneNumber);
        }

        const { data: newContact, error: createError } = await this.supabase
          .from('contacts')
          .insert({
            tenant_id: tenantId,
            phone_e164: phoneNumber,
            name: contactName,
            opt_in_status: 'pending',
            preferred_language: 'es',
            metadata: {
              created_from: 'new_loan_flow',
              needs_phone: !context.new_contact_phone
            }
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating contact:', createError);
          throw new Error(`Failed to create contact: ${createError.message}`);
        }

        if (!newContact) {
          throw new Error('Contact insert returned null');
        }

        contact = newContact;
        console.log('Created new contact:', contact.id);

      } else {
        throw new Error('Neither contact_id nor temp_contact_name provided in context');
      }

      if (!contact) {
        console.error('Contact is still null after all attempts');
        throw new Error('Failed to create or find contact');
      }

      console.log('Final contact selected:', contact.id);

      // 3. Crear el acuerdo de préstamo
      const dueDate = context.due_date;
      const agreementId = generateUUID();

      // Preparar título y descripción según el tipo de préstamo
      const title = context.amount
        ? `Préstamo de $${formatMoney(context.amount)}`
        : `Préstamo: ${context.item_description}`;

      const { data: agreement } = await this.supabase
        .from('agreements')
        .insert({
          id: agreementId,
          tenant_id: tenantId,
          contact_id: contact.id,
          lender_contact_id: context.lender_contact_id || null, // Quien presta (quien habla por WhatsApp)
          created_by: ownerUser.id,
          type: 'loan',
          title: title,
          description: `Préstamo creado mediante flujo conversacional`,
          item_description: context.item_description || 'Dinero',
          amount: context.amount || null, // Monto si es dinero
          currency: 'MXN',
          start_date: new Date().toISOString().split('T')[0],
          due_date: dueDate,
          status: 'active',
          reminder_config: {
            enabled: true,
            before_24h: true,
            due_date: true,
            overdue: true
          },
          metadata: {
            created_from: 'new_loan_flow',
            loan_type: context.loan_type || 'unknown',
            original_context: context
          },
          exdates: [],
          reminder_count: 0
        })
        .select()
        .single();

      if (!agreement) {
        throw new Error('Failed to create agreement');
      }

      // 4. Configurar recordatorios automáticamente
      await this.setupDefaultReminders(agreementId, tenantId);

      // 5. Registrar evento de flujo completado
      await this.supabase
        .from('events')
        .insert({
          tenant_id: tenantId,
          contact_id: contact.id,
          agreement_id: agreementId,
          event_type: 'flow_completed',
          payload: {
            flow_type: 'new_loan',
            context: context,
            contact_name: contact.name,
            agreement_title: agreement.title
          }
        });

      // 6. Actualizar métricas diarias
      await this.updateDailyMetrics(tenantId, 'flows_completed');

      console.log('New loan flow completed successfully:', { agreementId, contactId: contact.id });

      // 7. Enviar mensaje de confirmación al contacto (borrower)
      if (contact && agreement) {
        try {
          await this.sendLoanConfirmationToContact(tenantId, contact, agreement, context);
          console.log('Loan confirmation message sent to contact');
        } catch (notificationError) {
          console.error('Failed to send confirmation to contact:', notificationError);
          // No fallar el flujo si falla el envío de mensaje
        }
      }

      return {
        success: true,
        agreementId: agreementId
      };

    } catch (error) {
      console.error('Error handling new loan flow:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Handler para flujo de Reprogramación
  async handleRescheduleFlow(tenantId: string, contactId: string, context: any): Promise<{
    success: boolean;
    agreementId?: string;
    error?: string;
  }> {
    try {
      console.log('Handling reschedule flow completion:', { tenantId, contactId, context });

      // 1. Buscar acuerdo activo más reciente del contacto
      const { data: agreement } = await this.supabase
        .from('agreements')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('contact_id', contactId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!agreement) {
        throw new Error('No se encontró un acuerdo activo para reprogramar');
      }

      const newDate = context.new_date;
      const originalDate = agreement.due_date || agreement.target_date;

      // 2. Actualizar el acuerdo con nueva fecha
      const { error: updateError } = await this.supabase
        .from('agreements')
        .update({
          due_date: newDate,
          target_date: newDate,
          // Agregar fecha original a exdates si es diferente
          exdates: originalDate && originalDate !== newDate
            ? [...(agreement.exdates || []), originalDate]
            : agreement.exdates || [],
          updated_at: new Date().toISOString()
        })
        .eq('id', agreement.id);

      if (updateError) {
        throw new Error(`Error updating agreement: ${updateError.message}`);
      }

      // 3. Cancelar recordatorios pendientes para la fecha anterior
      await this.supabase
        .from('reminder_instances')
        .update({ status: 'cancelled' })
        .in('reminder_id',
          this.supabase
            .from('reminders')
            .select('id')
            .eq('agreement_id', agreement.id)
        )
        .eq('status', 'pending');

      // 4. Generar nuevos recordatorios para la nueva fecha
      await this.regenerateReminders(agreement.id, newDate);

      // 5. Registrar evento de reprogramación
      await this.supabase
        .from('events')
        .insert({
          tenant_id: tenantId,
          contact_id: contactId,
          agreement_id: agreement.id,
          event_type: 'date_rescheduled',
          payload: {
            flow_type: 'reschedule',
            original_date: originalDate,
            new_date: newDate,
            context: context
          }
        });

      // 6. Actualizar métricas
      await this.updateDailyMetrics(tenantId, 'flows_completed');

      console.log('Reschedule flow completed successfully:', { agreementId: agreement.id, newDate });

      return {
        success: true,
        agreementId: agreement.id
      };

    } catch (error) {
      console.error('Error handling reschedule flow:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Handler para flujo de Servicio Recurrente
  async handleNewServiceFlow(tenantId: string, contactId: string, context: any): Promise<{
    success: boolean;
    agreementId?: string;
    error?: string;
  }> {
    try {
      console.log('Handling new service flow completion:', { tenantId, contactId, context });

      // 1. Obtener usuario owner
      const { data: ownerUser } = await this.supabase
        .from('users')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('role', 'owner')
        .single();

      if (!ownerUser) {
        throw new Error('Owner user not found');
      }

      // 2. Buscar o crear contacto (similar a new loan)
      let contact = null;
      const contactInfo = context.contact_info;

      if (/^\+?\d+$/.test(contactInfo.replace(/[\s\-()]/g, ''))) {
        const formattedPhone = parsePhoneNumber(contactInfo);

        const { data: existingContact } = await this.supabase
          .from('contacts')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('phone_e164', formattedPhone)
          .maybeSingle();

        contact = existingContact || await this.createContact(tenantId, formattedPhone, `Contacto ${formattedPhone}`);
      } else {
        const { data: existingContact } = await this.supabase
          .from('contacts')
          .select('*')
          .eq('tenant_id', tenantId)
          .ilike('name', `%${contactInfo}%`)
          .maybeSingle();

        contact = existingContact || await this.createContact(tenantId, '+52PENDING', contactInfo);
      }

      // 3. Crear regla de recurrencia basada en la frecuencia
      const rrule = this.generateRRule(context.recurrence);
      const nextDueDate = this.calculateNextDueDate(context.recurrence);
      const agreementId = generateUUID();

      // 4. Crear acuerdo de servicio
      const { data: agreement } = await this.supabase
        .from('agreements')
        .insert({
          id: agreementId,
          tenant_id: tenantId,
          contact_id: contact.id,
          created_by: ownerUser.id,
          type: 'service',
          title: `Servicio: ${context.service_description}`,
          description: `Servicio recurrente creado mediante flujo conversacional`,
          item_description: context.service_description,
          currency: 'MXN',
          start_date: new Date().toISOString().split('T')[0],
          due_date: nextDueDate,
          next_due_date: nextDueDate,
          recurrence_rule: rrule,
          rrule: rrule,
          status: 'active',
          reminder_config: {
            enabled: true,
            before_24h: true,
            due_date: true,
            overdue: true
          },
          metadata: {
            created_from: 'new_service_flow',
            original_context: context,
            recurrence_type: context.recurrence
          },
          exdates: [],
          reminder_count: 0
        })
        .select()
        .single();

      if (!agreement) {
        throw new Error('Failed to create service agreement');
      }

      // 5. Configurar recordatorios
      await this.setupDefaultReminders(agreementId, tenantId);

      // 6. Registrar evento
      await this.supabase
        .from('events')
        .insert({
          tenant_id: tenantId,
          contact_id: contact.id,
          agreement_id: agreementId,
          event_type: 'flow_completed',
          payload: {
            flow_type: 'new_service',
            context: context,
            contact_name: contact.name,
            agreement_title: agreement.title,
            recurrence: context.recurrence
          }
        });

      // 7. Actualizar métricas
      await this.updateDailyMetrics(tenantId, 'flows_completed');

      console.log('New service flow completed successfully:', { agreementId, recurrence: context.recurrence });

      return {
        success: true,
        agreementId: agreementId
      };

    } catch (error) {
      console.error('Error handling new service flow:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Funciones auxiliares privadas

  private async createContact(tenantId: string, phone: string, name: string): Promise<any> {
    const { data: newContact } = await this.supabase
      .from('contacts')
      .insert({
        tenant_id: tenantId,
        phone_e164: phone,
        name: name,
        opt_in_status: 'pending',
        preferred_language: 'es',
        metadata: { created_from: 'conversation_flow' }
      })
      .select()
      .single();

    return newContact;
  }

  private async setupDefaultReminders(agreementId: string, tenantId: string): Promise<void> {
    // Obtener templates por defecto del tenant
    const { data: templates } = await this.supabase
      .from('templates')
      .select('*')
      .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
      .eq('approval_status', 'approved')
      .in('category', ['before_24h', 'due_date', 'overdue']);

    if (!templates || templates.length === 0) {
      console.warn('No templates found for reminders');
      return;
    }

    // Crear recordatorios estándar
    const reminders = [
      {
        agreement_id: agreementId,
        reminder_type: 'before_24h',
        days_offset: -1,
        time_of_day: '10:00',
        recipients: 'contact',
        template_id: templates.find(t => t.category === 'before_24h')?.id || templates[0].id,
        is_active: true
      },
      {
        agreement_id: agreementId,
        reminder_type: 'due_date',
        days_offset: 0,
        time_of_day: '09:00',
        recipients: 'contact',
        template_id: templates.find(t => t.category === 'due_date')?.id || templates[0].id,
        is_active: true
      },
      {
        agreement_id: agreementId,
        reminder_type: 'overdue',
        days_offset: 1,
        time_of_day: '16:00',
        recipients: 'both',
        template_id: templates.find(t => t.category === 'overdue')?.id || templates[0].id,
        is_active: true
      }
    ];

    await this.supabase
      .from('reminders')
      .insert(reminders);
  }

  private async regenerateReminders(agreementId: string, newDueDate: string): Promise<void> {
    // Obtener recordatorios activos
    const { data: reminders } = await this.supabase
      .from('reminders')
      .select('*')
      .eq('agreement_id', agreementId)
      .eq('is_active', true);

    if (!reminders) return;

    // Generar nuevas instancias para cada recordatorio
    for (const reminder of reminders) {
      await this.supabase.rpc('generate_reminder_instances', {
        reminder_id: reminder.id,
        due_date: newDueDate
      });
    }
  }

  private generateRRule(recurrence: string): string {
    const rules = {
      'diario': 'FREQ=DAILY;INTERVAL=1',
      'semanal': 'FREQ=WEEKLY;INTERVAL=1',
      'quincenal': 'FREQ=WEEKLY;INTERVAL=2',
      'mensual': 'FREQ=MONTHLY;INTERVAL=1'
    };

    return rules[recurrence.toLowerCase()] || 'FREQ=MONTHLY;INTERVAL=1';
  }

  private calculateNextDueDate(recurrence: string): string {
    const now = new Date();
    const next = new Date(now);

    switch (recurrence.toLowerCase()) {
      case 'diario':
        next.setDate(next.getDate() + 1);
        break;
      case 'semanal':
        next.setDate(next.getDate() + 7);
        break;
      case 'quincenal':
        next.setDate(next.getDate() + 14);
        break;
      case 'mensual':
      default:
        next.setMonth(next.getMonth() + 1);
        break;
    }

    return next.toISOString().split('T')[0];
  }

  private async updateDailyMetrics(tenantId: string, metricType: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    try {
      await this.supabase.rpc('upsert_daily_metric', {
        p_tenant_id: tenantId,
        p_date: today,
        p_metric_type: metricType,
        p_increment: 1
      });
    } catch (error) {
      console.error('Error updating daily metrics:', error);
    }
  }

  // Función para formatear fecha en formato dd/mm/aa (formato chileno)
  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  }

  // Enviar mensaje de confirmación al contacto (borrower) después de crear el préstamo
  private async sendLoanConfirmationToContact(
    tenantId: string,
    borrowerContact: any,
    agreement: any,
    context: any
  ): Promise<void> {
    try {
      console.log('[NOTIFICATION] Sending loan confirmation to borrower:', borrowerContact.id);

      // 1. Verificar que el contacto tenga WhatsApp ID o teléfono válido
      if (!borrowerContact.phone_e164 || borrowerContact.phone_e164.startsWith('+PEND')) {
        console.log('[NOTIFICATION] Borrower has no valid phone number, skipping notification');
        return;
      }

      // 2. Obtener información del tenant (phone_number_id para enviar mensaje)
      const { data: tenant } = await this.supabase
        .from('tenants')
        .select('whatsapp_phone_number_id')
        .eq('id', tenantId)
        .single();

      if (!tenant || !tenant.whatsapp_phone_number_id) {
        console.error('[NOTIFICATION] Tenant has no WhatsApp phone number ID configured');
        return;
      }

      // 3. Obtener información del prestamista (lender)
      let lenderName = 'Alguien';
      if (context.lender_contact_id) {
        const { data: lenderContact } = await this.supabase
          .from('contacts')
          .select('name')
          .eq('id', context.lender_contact_id)
          .single();

        if (lenderContact) {
          lenderName = lenderContact.name;
        }
      }

      // 4. Preparar variable {{3}} según tipo de préstamo
      let loanItem = '';
      if (context.amount) {
        // Préstamo de dinero: "$49.000"
        loanItem = `$${formatMoney(context.amount)}`;
      } else {
        // Préstamo de objeto: "un HP Pavilion", "una bicicleta", etc.
        loanItem = context.item_description;
      }

      // 5. Enviar template de WhatsApp con botones
      const templateParams = {
        name: 'loan_confirmation_request_v1',
        language: { code: 'es' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: borrowerContact.name },           // {{1}}
              { type: 'text', text: lenderName },                     // {{2}}
              { type: 'text', text: loanItem },                       // {{3}}
              { type: 'text', text: this.formatDateLong(agreement.due_date) } // {{4}}
            ]
          }
        ]
      };

      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: borrowerContact.phone_e164.replace('+', ''),
        type: 'template',
        template: templateParams
      };

      // 6. Enviar mensaje a través de WhatsApp API
      const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${tenant.whatsapp_phone_number_id}/messages`,
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
        console.log('[NOTIFICATION] Template message sent successfully:', result.messages[0].id);

        // 7. Registrar mensaje en base de datos
        await this.supabase
          .from('whatsapp_messages')
          .insert({
            tenant_id: tenantId,
            contact_id: borrowerContact.id,
            wa_message_id: result.messages[0].id,
            direction: 'outbound',
            message_type: 'template',
            content: { template: templateParams },
            status: 'sent',
            sent_at: new Date().toISOString()
          });

        console.log('[NOTIFICATION] Template message logged in database');
      } else {
        console.error('[NOTIFICATION] Failed to send template:', result);
        throw new Error(`WhatsApp API error: ${JSON.stringify(result)}`);
      }

    } catch (error) {
      console.error('[NOTIFICATION] Error sending loan confirmation:', error);
      throw error;
    }
  }

  // Función para formatear fecha en formato largo (31 de octubre 2025)
  private formatDateLong(dateString: string): string {
    const date = new Date(dateString);
    const months = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];

    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    return `${day} de ${month} ${year}`;
  }
}