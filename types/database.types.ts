// Tipos TypeScript para la base de datos del Bot de Recordatorios
// Generado automáticamente a partir del esquema SQL

// ENUMS DE LA BASE DE DATOS

export type AgreementType = 'loan' | 'service';
export type AgreementStatus = 'active' | 'completed' | 'cancelled' | 'overdue' | 'returned';
export type ReminderType = 'before_24h' | 'due_date' | 'overdue';
export type ReminderRecipients = 'owner' | 'contact' | 'both';
export type OptInStatus = 'pending' | 'opted_in' | 'opted_out';
export type InstanceStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'cancelled';
export type EventType =
  | 'opt_in_sent'
  | 'opt_in_received'
  | 'reminder_sent'
  | 'confirmed_returned'
  | 'confirmed_paid'
  | 'rescheduled'
  | 'button_clicked'
  | 'flow_started'
  | 'flow_completed'
  | 'intent_detected'
  | 'date_rescheduled';

// Nuevos tipos para flujos conversacionales
export type FlowType =
  | 'new_loan'
  | 'new_service'
  | 'reschedule'
  | 'confirm_return'
  | 'confirm_payment'
  | 'general_inquiry';

export type FlowStep =
  | 'init'
  | 'awaiting_contact'
  | 'awaiting_item'
  | 'awaiting_due_date'
  | 'awaiting_confirmation'
  | 'awaiting_reschedule_date'
  | 'awaiting_service_details'
  | 'awaiting_recurrence'
  | 'confirming'
  | 'complete'
  | 'cancelled';
export type MessageDirection = 'inbound' | 'outbound';
export type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed';
export type UserRole = 'owner' | 'admin' | 'member';

// INTERFACES DE TABLAS

export interface Tenant {
  id: string;
  name: string;
  whatsapp_phone_number_id?: string;
  whatsapp_access_token?: string;
  whatsapp_business_account_id?: string;
  timezone: string;
  webhook_verify_token?: string;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  auth_user_id?: string;
  role: UserRole;
  first_name?: string;
  last_name?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
}

export interface Contact {
  id: string;
  tenant_id: string;
  phone_e164: string;
  name: string;
  whatsapp_id?: string;
  opt_in_status: OptInStatus;
  opt_in_date?: string;
  opt_out_date?: string;
  timezone?: string;
  preferred_language: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Agreement {
  id: string;
  tenant_id: string;
  contact_id: string;
  created_by: string;
  type: AgreementType;
  title: string;
  description?: string;
  item_description?: string;
  amount?: number;
  currency: string;
  start_date: string;
  due_date?: string;
  recurrence_rule?: string;
  next_due_date?: string;
  status: AgreementStatus;
  reminder_config: Record<string, any>;
  metadata: Record<string, any>;
  // Nuevos campos para flujos conversacionales
  rrule?: string; // Regla de recurrencia iCalendar
  exdates: string[]; // Fechas excluidas por reprogramaciones
  target_date?: string; // Fecha objetivo actual
  last_reminder_sent?: string; // Último recordatorio enviado
  reminder_count: number; // Cantidad de recordatorios enviados
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface Template {
  id: string;
  tenant_id?: string;
  name: string;
  category: string;
  language: string;
  header?: string;
  body: string;
  footer?: string;
  buttons_config?: Record<string, any>;
  meta_template_name?: string;
  meta_template_id?: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  variables: string[];
  created_at: string;
  updated_at: string;
}

export interface Reminder {
  id: string;
  agreement_id: string;
  reminder_type: ReminderType;
  days_offset: number;
  time_of_day: string;
  recipients: ReminderRecipients;
  template_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReminderInstance {
  id: string;
  reminder_id: string;
  scheduled_for: string;
  sent_at?: string;
  status: InstanceStatus;
  retry_count: number;
  max_retries: number;
  next_retry_at?: string;
  whatsapp_message_id?: string;
  rendered_variables: Record<string, any>;
  error_message?: string;
  error_code?: string;
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: string;
  tenant_id: string;
  contact_id?: string;
  agreement_id?: string;
  reminder_instance_id?: string;
  event_type: EventType;
  payload: Record<string, any>;
  whatsapp_message_id?: string;
  user_agent?: string;
  ip_address?: string;
  created_at: string;
}

export interface WhatsappMessage {
  id: string;
  tenant_id: string;
  contact_id?: string;
  reminder_instance_id?: string;
  wa_message_id?: string;
  wa_conversation_id?: string;
  direction: MessageDirection;
  message_type: string;
  content: Record<string, any>;
  template_id?: string;
  template_variables?: Record<string, any>;
  status?: MessageStatus;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  error_code?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationState {
  id: string;
  tenant_id: string;
  contact_id: string;
  flow_type: FlowType;
  current_step: FlowStep;
  context: Record<string, any>;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentLink {
  id: string;
  tenant_id: string;
  agreement_id: string;
  link_url: string;
  amount: number;
  currency: string;
  description?: string;
  expires_at?: string;
  used_at?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface MetricsDaily {
  id: string;
  tenant_id: string;
  date: string;
  messages_sent: number;
  messages_delivered: number;
  messages_read: number;
  opt_ins_received: number;
  payments_confirmed: number;
  loans_returned: number;
  flows_started: number;
  flows_completed: number;
  created_at: string;
  updated_at: string;
}

// INTERFACES DE RELACIONES CON JOINS

export interface AgreementWithContact extends Agreement {
  contact: Contact;
  reminders: Reminder[];
}

export interface ReminderWithTemplate extends Reminder {
  template: Template;
  agreement: Agreement;
}

export interface ReminderInstanceWithDetails extends ReminderInstance {
  reminder: ReminderWithTemplate;
}

export interface ContactWithAgreements extends Contact {
  agreements: Agreement[];
}

// TIPOS PARA INSERTS/UPDATES

export type TenantInsert = Omit<Tenant, 'id' | 'created_at' | 'updated_at'>;
export type TenantUpdate = Partial<Omit<Tenant, 'id' | 'created_at' | 'updated_at'>>;

export type UserInsert = Omit<User, 'id' | 'created_at' | 'updated_at' | 'last_login_at'>;
export type UserUpdate = Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>;

export type ContactInsert = Omit<Contact, 'id' | 'created_at' | 'updated_at'>;
export type ContactUpdate = Partial<Omit<Contact, 'id' | 'created_at' | 'updated_at'>>;

export type AgreementInsert = Omit<Agreement, 'id' | 'created_at' | 'updated_at' | 'completed_at'>;
export type AgreementUpdate = Partial<Omit<Agreement, 'id' | 'created_at' | 'updated_at'>>;

export type TemplateInsert = Omit<Template, 'id' | 'created_at' | 'updated_at'>;
export type TemplateUpdate = Partial<Omit<Template, 'id' | 'created_at' | 'updated_at'>>;

export type ReminderInsert = Omit<Reminder, 'id' | 'created_at' | 'updated_at'>;
export type ReminderUpdate = Partial<Omit<Reminder, 'id' | 'created_at' | 'updated_at'>>;

export type ReminderInstanceInsert = Omit<ReminderInstance, 'id' | 'created_at' | 'updated_at'>;
export type ReminderInstanceUpdate = Partial<Omit<ReminderInstance, 'id' | 'created_at' | 'updated_at'>>;

export type EventInsert = Omit<Event, 'id' | 'created_at'>;

export type WhatsappMessageInsert = Omit<WhatsappMessage, 'id' | 'created_at' | 'updated_at'>;
export type WhatsappMessageUpdate = Partial<Omit<WhatsappMessage, 'id' | 'created_at' | 'updated_at'>>;

export type ConversationStateInsert = Omit<ConversationState, 'id' | 'created_at' | 'updated_at'>;
export type ConversationStateUpdate = Partial<Omit<ConversationState, 'id' | 'created_at' | 'updated_at'>>;

export type PaymentLinkInsert = Omit<PaymentLink, 'id' | 'created_at' | 'updated_at'>;
export type PaymentLinkUpdate = Partial<Omit<PaymentLink, 'id' | 'created_at' | 'updated_at'>>;

export type MetricsDailyInsert = Omit<MetricsDaily, 'id' | 'created_at' | 'updated_at'>;
export type MetricsDailyUpdate = Partial<Omit<MetricsDaily, 'id' | 'created_at' | 'updated_at'>>;

// TIPOS PARA RESPUESTAS DE FUNCIONES DE BASE DE DATOS

export interface CreateTenantWithOwnerParams {
  tenant_name: string;
  owner_email: string;
  owner_first_name?: string;
  owner_last_name?: string;
}

export interface GenerateReminderInstancesParams {
  reminder_id: string;
  due_date: string;
  timezone?: string;
}

export interface ProcessConfirmationParams {
  tenant_id: string;
  agreement_id: string;
  contact_id: string;
  event_type: EventType;
  whatsapp_message_id?: string;
}