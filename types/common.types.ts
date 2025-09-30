// Tipos comunes para el sistema de Bot de Recordatorios

import { EventType, AgreementType, ReminderType } from './database.types.ts';

// TIPOS PARA CONTEXTO DE CONVERSACIÓN

export interface ConversationContext {
  tenant_id: string;
  contact_id?: string;
  agreement_id?: string;
  current_step?: string;
  data?: Record<string, any>;
  expires_at?: string;
}

// TIPOS PARA PROCESAMIENTO DE MENSAJES

export interface MessageProcessingResult {
  success: boolean;
  response_messages?: OutboundMessageData[];
  events?: EventData[];
  context_updates?: Partial<ConversationContext>;
  error?: string;
}

export interface OutboundMessageData {
  to: string;
  type: 'text' | 'template' | 'interactive';
  content: Record<string, any>;
  template_id?: string;
  variables?: Record<string, any>;
}

export interface EventData {
  tenant_id: string;
  contact_id?: string;
  agreement_id?: string;
  event_type: EventType;
  payload: Record<string, any>;
  whatsapp_message_id?: string;
}

// TIPOS PARA SCHEDULER

export interface SchedulerTask {
  reminder_instance_id: string;
  reminder_id: string;
  agreement_id: string;
  tenant_id: string;
  contact_id: string;
  template_id: string;
  scheduled_for: string;
  variables: Record<string, any>;
}

export interface SchedulerResult {
  processed: number;
  sent: number;
  failed: number;
  errors: SchedulerError[];
}

export interface SchedulerError {
  reminder_instance_id: string;
  error_code: string;
  error_message: string;
  retry_count: number;
}

// TIPOS PARA CONFIGURACIÓN DE RECORDATORIOS

export interface ReminderConfiguration {
  before_24h: boolean;
  due_date: boolean;
  overdue: boolean;
  custom_offsets?: Array<{
    days: number;
    time: string;
    type: ReminderType;
  }>;
}

export interface CreateAgreementData {
  contact_id: string;
  type: AgreementType;
  title: string;
  description?: string;
  item_description?: string;
  amount?: number;
  currency?: string;
  start_date: string;
  due_date?: string;
  recurrence_rule?: string;
  reminder_config?: ReminderConfiguration;
  metadata?: Record<string, any>;
}

// TIPOS PARA VARIABLES DE TEMPLATE

export interface TemplateVariables {
  contact_name: string;
  business_name?: string;
  agreement_title?: string;
  item_description?: string;
  service_description?: string;
  amount?: string;
  currency?: string;
  due_date?: string;
  loan_date?: string;
  [key: string]: string | undefined;
}

// TIPOS PARA BOTONES INTERACTIVOS

export type ButtonAction =
  | 'opt_in_yes'
  | 'opt_in_no'
  | 'loan_returned'
  | 'loan_reschedule'
  | 'contact_owner'
  | 'pay_online'
  | 'paid_cash'
  | 'reschedule_payment';

export interface ButtonClickData {
  button_id: string;
  button_text: string;
  message_id: string;
  timestamp: string;
}

// TIPOS PARA FLUJOS DE NEGOCIO

export interface OptInFlow {
  contact_id: string;
  agreement_description: string;
  message_sent: boolean;
  response_received?: boolean;
  opted_in?: boolean;
  timestamp: string;
}

export interface ConfirmationFlow {
  agreement_id: string;
  contact_id: string;
  confirmation_type: 'return' | 'payment';
  confirmed: boolean;
  timestamp: string;
  details?: Record<string, any>;
}

export interface RescheduleFlow {
  agreement_id: string;
  contact_id: string;
  current_due_date: string;
  new_due_date?: string;
  reason?: string;
  timestamp: string;
}

// TIPOS PARA VALIDACIÓN

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

// TIPOS PARA MÉTRICAS

export interface ReminderMetrics {
  total_sent: number;
  total_delivered: number;
  total_read: number;
  total_failed: number;
  response_rate: number;
  confirmation_rate: number;
}

export interface TenantMetrics {
  active_agreements: number;
  total_contacts: number;
  opt_in_rate: number;
  reminders_this_month: number;
  confirmations_this_month: number;
}

// TIPOS PARA CONFIGURACIÓN

export interface TenantSettings {
  business_name: string;
  default_timezone: string;
  default_language: string;
  whatsapp_settings: {
    phone_number_id: string;
    access_token: string;
    webhook_verify_token: string;
  };
  reminder_settings: {
    default_time: string;
    retry_attempts: number;
    retry_delay_minutes: number;
  };
  notification_settings: {
    notify_owner_on_confirmation: boolean;
    notify_owner_on_reschedule: boolean;
    owner_notification_method: 'whatsapp' | 'email' | 'both';
  };
}

// TIPOS PARA RESPUESTAS DE API

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    total?: number;
    page?: number;
    per_page?: number;
  };
}

export interface WebhookResponse {
  success: boolean;
  message?: string;
  processed_messages?: number;
  errors?: string[];
}

// TIPOS PARA LOGGING

export interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  tenant_id?: string;
  contact_id?: string;
  agreement_id?: string;
  function_name: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

// TIPOS PARA RATE LIMITING

export interface RateLimitInfo {
  remaining: number;
  reset_time: number;
  limit: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retry_after?: number;
  info: RateLimitInfo;
}

// TIPOS PARA TIMEZONE HANDLING

export interface TimezoneInfo {
  timezone: string;
  offset: number;
  is_dst: boolean;
  current_time: string;
}

// TIPOS PARA RECURRENCIA

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  end_date?: string;
  count?: number;
  by_month_day?: number;
  by_weekday?: number[];
}

// TIPOS PARA PAGOS (FUTURO)

export interface PaymentInfo {
  amount: number;
  currency: string;
  payment_method: 'cash' | 'transfer' | 'card' | 'other';
  reference?: string;
  paid_at: string;
  verified: boolean;
}

// TIPOS PARA EXPORTACIÓN/REPORTES

export interface ReportData {
  agreements: Array<{
    id: string;
    contact_name: string;
    type: AgreementType;
    status: string;
    amount?: number;
    due_date?: string;
    created_at: string;
  }>;
  reminders: Array<{
    id: string;
    type: ReminderType;
    sent_at?: string;
    status: string;
    delivered: boolean;
    read: boolean;
  }>;
  metrics: TenantMetrics;
}

// TIPOS PARA CONFIGURACIÓN DE EDGE FUNCTIONS

export interface EdgeFunctionConfig {
  cors_origins: string[];
  max_request_size: number;
  timeout_seconds: number;
  environment: 'development' | 'staging' | 'production';
  log_level: 'debug' | 'info' | 'warn' | 'error';
}