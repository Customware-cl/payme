// Exportación central de todos los tipos

// Database types
export * from './database.types.ts';

// WhatsApp API types
export * from './whatsapp.types.ts';

// Common types
export * from './common.types.ts';

// Re-exports for convenience
export type {
  Tenant,
  User,
  Contact,
  Agreement,
  Template,
  Reminder,
  ReminderInstance,
  Event,
  WhatsappMessage,
} from './database.types.ts';

export type {
  WhatsAppWebhookEntry,
  WhatsAppInboundMessage,
  WhatsAppOutboundMessage,
  WhatsAppMessageStatus,
  WhatsAppClientConfig,
} from './whatsapp.types.ts';

export type {
  MessageProcessingResult,
  SchedulerTask,
  TemplateVariables,
  ApiResponse,
  ConversationContext,
} from './common.types.ts';