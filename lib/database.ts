// Utilidades para la base de datos
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  Tenant,
  Contact,
  Agreement,
  Template,
  ReminderInstance,
  Event,
  WhatsappMessage,
  ContactInsert,
  AgreementInsert,
  EventInsert,
  WhatsappMessageInsert,
  ReminderInstanceUpdate,
  OptInStatus,
  InstanceStatus,
  MessageStatus
} from '../types';

/**
 * Cliente de base de datos con utilidades específicas para el bot
 */
export class DatabaseClient {
  private supabase: SupabaseClient;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  // MÉTODOS PARA TENANTS

  async getTenantByPhoneId(phoneId: string): Promise<Tenant | null> {
    const { data, error } = await this.supabase
      .from('tenants')
      .select('*')
      .eq('whatsapp_phone_number_id', phoneId)
      .single();

    if (error) {
      console.error('Error getting tenant by phone ID:', error);
      return null;
    }

    return data;
  }

  // MÉTODOS PARA CONTACTS

  async getContactByPhone(tenantId: string, phone: string): Promise<Contact | null> {
    const { data, error } = await this.supabase
      .from('contacts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('phone_e164', phone)
      .single();

    if (error) {
      console.error('Error getting contact by phone:', error);
      return null;
    }

    return data;
  }

  async createContact(contactData: ContactInsert): Promise<Contact | null> {
    const { data, error } = await this.supabase
      .from('contacts')
      .insert(contactData)
      .select()
      .single();

    if (error) {
      console.error('Error creating contact:', error);
      return null;
    }

    return data;
  }

  async updateContactOptIn(contactId: string, status: OptInStatus): Promise<boolean> {
    const updateData: any = {
      opt_in_status: status,
    };

    if (status === 'opted_in') {
      updateData.opt_in_date = new Date().toISOString();
    } else if (status === 'opted_out') {
      updateData.opt_out_date = new Date().toISOString();
    }

    const { error } = await this.supabase
      .from('contacts')
      .update(updateData)
      .eq('id', contactId);

    if (error) {
      console.error('Error updating contact opt-in:', error);
      return false;
    }

    return true;
  }

  // MÉTODOS PARA AGREEMENTS

  async getAgreement(agreementId: string): Promise<Agreement | null> {
    const { data, error } = await this.supabase
      .from('agreements')
      .select('*')
      .eq('id', agreementId)
      .single();

    if (error) {
      console.error('Error getting agreement:', error);
      return null;
    }

    return data;
  }

  async getAgreementWithContact(agreementId: string): Promise<any | null> {
    const { data, error } = await this.supabase
      .from('agreements')
      .select(`
        *,
        contact:contacts(*)
      `)
      .eq('id', agreementId)
      .single();

    if (error) {
      console.error('Error getting agreement with contact:', error);
      return null;
    }

    return data;
  }

  async createAgreement(agreementData: AgreementInsert): Promise<Agreement | null> {
    const { data, error } = await this.supabase
      .from('agreements')
      .insert(agreementData)
      .select()
      .single();

    if (error) {
      console.error('Error creating agreement:', error);
      return null;
    }

    return data;
  }

  // MÉTODOS PARA TEMPLATES

  async getTemplate(templateId: string): Promise<Template | null> {
    const { data, error } = await this.supabase
      .from('templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error) {
      console.error('Error getting template:', error);
      return null;
    }

    return data;
  }

  async getTemplateByName(name: string, tenantId?: string): Promise<Template | null> {
    let query = this.supabase
      .from('templates')
      .select('*')
      .eq('name', name);

    if (tenantId) {
      query = query.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
    } else {
      query = query.is('tenant_id', null);
    }

    const { data, error } = await query.single();

    if (error) {
      console.error('Error getting template by name:', error);
      return null;
    }

    return data;
  }

  // MÉTODOS PARA REMINDER INSTANCES

  async getPendingReminderInstances(limit: number = 100): Promise<ReminderInstance[]> {
    const { data, error } = await this.supabase
      .from('reminder_instances')
      .select(`
        *,
        reminder:reminders(
          *,
          agreement:agreements(
            *,
            contact:contacts(*)
          ),
          template:templates(*)
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Error getting pending reminder instances:', error);
      return [];
    }

    return data || [];
  }

  async updateReminderInstance(
    instanceId: string,
    updates: ReminderInstanceUpdate
  ): Promise<boolean> {
    const { error } = await this.supabase
      .from('reminder_instances')
      .update(updates)
      .eq('id', instanceId);

    if (error) {
      console.error('Error updating reminder instance:', error);
      return false;
    }

    return true;
  }

  async markReminderInstanceSent(
    instanceId: string,
    whatsappMessageId: string
  ): Promise<boolean> {
    return this.updateReminderInstance(instanceId, {
      status: 'sent',
      sent_at: new Date().toISOString(),
      whatsapp_message_id: whatsappMessageId,
    });
  }

  async markReminderInstanceFailed(
    instanceId: string,
    errorMessage: string,
    errorCode?: string
  ): Promise<boolean> {
    const { data: instance } = await this.supabase
      .from('reminder_instances')
      .select('retry_count, max_retries')
      .eq('id', instanceId)
      .single();

    if (!instance) return false;

    const updates: ReminderInstanceUpdate = {
      error_message: errorMessage,
      error_code: errorCode,
      retry_count: instance.retry_count + 1,
    };

    if (instance.retry_count + 1 >= instance.max_retries) {
      updates.status = 'failed';
    } else {
      // Programar siguiente retry (exponential backoff)
      const delayMinutes = Math.pow(2, instance.retry_count) * 5; // 5, 10, 20, 40 minutos
      const nextRetry = new Date(Date.now() + delayMinutes * 60000);
      updates.next_retry_at = nextRetry.toISOString();
    }

    return this.updateReminderInstance(instanceId, updates);
  }

  // MÉTODOS PARA EVENTS

  async createEvent(eventData: EventInsert): Promise<Event | null> {
    const { data, error } = await this.supabase
      .from('events')
      .insert(eventData)
      .select()
      .single();

    if (error) {
      console.error('Error creating event:', error);
      return null;
    }

    return data;
  }

  // MÉTODOS PARA WHATSAPP MESSAGES

  async createWhatsappMessage(messageData: WhatsappMessageInsert): Promise<WhatsappMessage | null> {
    const { data, error } = await this.supabase
      .from('whatsapp_messages')
      .insert(messageData)
      .select()
      .single();

    if (error) {
      console.error('Error creating WhatsApp message:', error);
      return null;
    }

    return data;
  }

  async updateWhatsappMessageStatus(
    waMessageId: string,
    status: MessageStatus,
    timestamp?: string
  ): Promise<boolean> {
    const updates: any = { status };

    if (timestamp) {
      switch (status) {
        case 'delivered':
          updates.delivered_at = timestamp;
          break;
        case 'read':
          updates.read_at = timestamp;
          break;
      }
    }

    const { error } = await this.supabase
      .from('whatsapp_messages')
      .update(updates)
      .eq('wa_message_id', waMessageId);

    if (error) {
      console.error('Error updating WhatsApp message status:', error);
      return false;
    }

    return true;
  }

  async getWhatsappMessageByWaId(waMessageId: string): Promise<WhatsappMessage | null> {
    const { data, error } = await this.supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('wa_message_id', waMessageId)
      .single();

    if (error) {
      console.error('Error getting WhatsApp message by WA ID:', error);
      return null;
    }

    return data;
  }

  // MÉTODOS PARA FUNCIONES DE BASE DE DATOS

  async processConfirmation(
    tenantId: string,
    agreementId: string,
    contactId: string,
    eventType: string,
    whatsappMessageId?: string
  ): Promise<boolean> {
    const { data, error } = await this.supabase.rpc('process_confirmation', {
      p_tenant_id: tenantId,
      p_agreement_id: agreementId,
      p_contact_id: contactId,
      p_event_type: eventType,
      p_whatsapp_message_id: whatsappMessageId,
    });

    if (error) {
      console.error('Error processing confirmation:', error);
      return false;
    }

    return data;
  }

  async generateReminderInstances(
    reminderId: string,
    dueDate: string,
    timezone?: string
  ): Promise<number> {
    const { data, error } = await this.supabase.rpc('generate_reminder_instances', {
      p_reminder_id: reminderId,
      p_due_date: dueDate,
      p_timezone: timezone,
    });

    if (error) {
      console.error('Error generating reminder instances:', error);
      return 0;
    }

    return data || 0;
  }

  // UTILIDADES DE BÚSQUEDA

  async searchContactsByName(tenantId: string, name: string, limit: number = 10): Promise<Contact[]> {
    const { data, error } = await this.supabase
      .from('contacts')
      .select('*')
      .eq('tenant_id', tenantId)
      .ilike('name', `%${name}%`)
      .limit(limit);

    if (error) {
      console.error('Error searching contacts by name:', error);
      return [];
    }

    return data || [];
  }

  async getActiveAgreementsByContact(contactId: string): Promise<Agreement[]> {
    const { data, error } = await this.supabase
      .from('agreements')
      .select('*')
      .eq('contact_id', contactId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error getting active agreements by contact:', error);
      return [];
    }

    return data || [];
  }

  // MÉTRICAS Y REPORTES

  async getTenantMetrics(tenantId: string): Promise<any> {
    const [
      { count: totalContacts },
      { count: activeAgreements },
      { count: optedInContacts },
    ] = await Promise.all([
      this.supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
      this.supabase
        .from('agreements')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'active'),
      this.supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('opt_in_status', 'opted_in'),
    ]);

    return {
      total_contacts: totalContacts || 0,
      active_agreements: activeAgreements || 0,
      opted_in_contacts: optedInContacts || 0,
      opt_in_rate: totalContacts ? (optedInContacts || 0) / totalContacts : 0,
    };
  }
}

/**
 * Singleton para el cliente de base de datos
 */
let dbClient: DatabaseClient | null = null;

export function getDatabase(): DatabaseClient {
  if (!dbClient) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    dbClient = new DatabaseClient(supabaseUrl, supabaseServiceKey);
  }

  return dbClient;
}