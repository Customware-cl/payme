// Tipos TypeScript para WhatsApp Cloud API
// Basados en la documentación oficial de Meta WhatsApp Business API

// TIPOS PARA WEBHOOK ENTRANTE

export interface WhatsAppWebhookEntry {
  id: string;
  changes: WhatsAppWebhookChange[];
}

export interface WhatsAppWebhookChange {
  value: WhatsAppWebhookValue;
  field: 'messages' | 'message_template_status_update';
}

export interface WhatsAppWebhookValue {
  messaging_product: 'whatsapp';
  metadata: WhatsAppMetadata;
  contacts?: WhatsAppContact[];
  messages?: WhatsAppInboundMessage[];
  statuses?: WhatsAppMessageStatus[];
  errors?: WhatsAppError[];
}

export interface WhatsAppMetadata {
  display_phone_number: string;
  phone_number_id: string;
}

export interface WhatsAppContact {
  profile: {
    name: string;
  };
  wa_id: string;
}

// MENSAJES ENTRANTES

export interface WhatsAppInboundMessage {
  from: string;
  id: string;
  timestamp: string;
  type: WhatsAppMessageType;
  context?: WhatsAppMessageContext;
  text?: WhatsAppTextMessage;
  interactive?: WhatsAppInteractiveInbound;
  button?: WhatsAppButtonReply;
  image?: WhatsAppMediaMessage;
  document?: WhatsAppMediaMessage;
  audio?: WhatsAppMediaMessage;
  video?: WhatsAppMediaMessage;
  location?: WhatsAppLocationMessage;
  contacts?: WhatsAppContactMessage[];
}

export type WhatsAppMessageType =
  | 'text'
  | 'interactive'
  | 'button'
  | 'image'
  | 'document'
  | 'audio'
  | 'video'
  | 'location'
  | 'contacts'
  | 'system'
  | 'unknown';

export interface WhatsAppMessageContext {
  from: string;
  id: string;
  referred_product?: {
    catalog_id: string;
    product_retailer_id: string;
  };
}

export interface WhatsAppTextMessage {
  body: string;
}

export interface WhatsAppInteractiveInbound {
  type: 'button_reply' | 'list_reply';
  button_reply?: {
    id: string;
    title: string;
  };
  list_reply?: {
    id: string;
    title: string;
    description?: string;
  };
}

export interface WhatsAppButtonReply {
  payload: string;
  text: string;
}

export interface WhatsAppMediaMessage {
  caption?: string;
  filename?: string;
  sha256: string;
  id: string;
  mime_type: string;
}

export interface WhatsAppLocationMessage {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface WhatsAppContactMessage {
  addresses?: WhatsAppContactAddress[];
  birthday?: string;
  emails?: WhatsAppContactEmail[];
  name: WhatsAppContactName;
  org?: WhatsAppContactOrg;
  phones?: WhatsAppContactPhone[];
  urls?: WhatsAppContactUrl[];
}

export interface WhatsAppContactAddress {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  country_code?: string;
  type?: 'HOME' | 'WORK';
}

export interface WhatsAppContactEmail {
  email?: string;
  type?: 'HOME' | 'WORK';
}

export interface WhatsAppContactName {
  formatted_name: string;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  suffix?: string;
  prefix?: string;
}

export interface WhatsAppContactOrg {
  company?: string;
  department?: string;
  title?: string;
}

export interface WhatsAppContactPhone {
  phone?: string;
  wa_id?: string;
  type?: 'HOME' | 'WORK';
}

export interface WhatsAppContactUrl {
  url?: string;
  type?: 'HOME' | 'WORK';
}

// ESTADOS DE MENSAJES

export interface WhatsAppMessageStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  conversation?: WhatsAppConversation;
  pricing?: WhatsAppPricing;
  errors?: WhatsAppError[];
}

export interface WhatsAppConversation {
  id: string;
  expiration_timestamp?: string;
  origin: {
    type: 'business_initiated' | 'user_initiated' | 'referral_conversion';
  };
}

export interface WhatsAppPricing {
  billable: boolean;
  pricing_model: 'CBP';
  category: 'business_initiated' | 'user_initiated' | 'referral_conversion';
}

export interface WhatsAppError {
  code: number;
  title: string;
  message: string;
  error_data?: {
    details: string;
  };
}

// TIPOS PARA MENSAJES SALIENTES

export interface WhatsAppOutboundMessage {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'text' | 'template' | 'interactive' | 'image' | 'document' | 'audio' | 'video';
  text?: WhatsAppOutboundText;
  template?: WhatsAppOutboundTemplate;
  interactive?: WhatsAppOutboundInteractive;
  image?: WhatsAppOutboundMedia;
  document?: WhatsAppOutboundMedia;
  audio?: WhatsAppOutboundMedia;
  video?: WhatsAppOutboundMedia;
}

export interface WhatsAppOutboundText {
  preview_url?: boolean;
  body: string;
}

export interface WhatsAppOutboundTemplate {
  name: string;
  language: {
    code: string;
  };
  components?: WhatsAppTemplateComponent[];
}

export interface WhatsAppTemplateComponent {
  type: 'header' | 'body' | 'footer' | 'button';
  parameters?: WhatsAppTemplateParameter[];
  sub_type?: 'quick_reply' | 'url';
  index?: number;
}

export interface WhatsAppTemplateParameter {
  type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
  text?: string;
  currency?: {
    fallback_value: string;
    code: string;
    amount_1000: number;
  };
  date_time?: {
    fallback_value: string;
  };
  image?: WhatsAppOutboundMedia;
  document?: WhatsAppOutboundMedia;
  video?: WhatsAppOutboundMedia;
}

export interface WhatsAppOutboundInteractive {
  type: 'button' | 'list';
  header?: {
    type: 'text' | 'image' | 'document' | 'video';
    text?: string;
    image?: WhatsAppOutboundMedia;
    document?: WhatsAppOutboundMedia;
    video?: WhatsAppOutboundMedia;
  };
  body: {
    text: string;
  };
  footer?: {
    text: string;
  };
  action: WhatsAppInteractiveAction;
}

export interface WhatsAppInteractiveAction {
  buttons?: WhatsAppInteractiveButton[];
  button?: string;
  sections?: WhatsAppInteractiveSection[];
}

export interface WhatsAppInteractiveButton {
  type: 'reply';
  reply: {
    id: string;
    title: string;
  };
}

export interface WhatsAppInteractiveSection {
  title: string;
  rows: WhatsAppInteractiveRow[];
}

export interface WhatsAppInteractiveRow {
  id: string;
  title: string;
  description?: string;
}

export interface WhatsAppOutboundMedia {
  id?: string;
  link?: string;
  caption?: string;
  filename?: string;
}

// RESPUESTAS DE LA API

export interface WhatsAppSendMessageResponse {
  messaging_product: 'whatsapp';
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
    message_status?: 'accepted' | 'failed';
  }>;
}

export interface WhatsAppUploadMediaResponse {
  id: string;
}

export interface WhatsAppGetMediaResponse {
  id: string;
  mime_type: string;
  sha256: string;
  file_size: number;
  url: string;
}

// TIPOS PARA CONFIGURACIÓN DE CLIENTE

export interface WhatsAppClientConfig {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId?: string;
  apiVersion?: string;
  baseUrl?: string;
}

// TIPOS PARA TEMPLATES

export interface WhatsAppTemplateInfo {
  name: string;
  language: string;
  category: 'AUTHENTICATION' | 'MARKETING' | 'UTILITY';
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  components: WhatsAppTemplateComponentInfo[];
}

export interface WhatsAppTemplateComponentInfo {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'VIDEO';
  text?: string;
  buttons?: WhatsAppTemplateButtonInfo[];
}

export interface WhatsAppTemplateButtonInfo {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
  text: string;
  url?: string;
  phone_number?: string;
}

// TIPOS PARA ERRORES ESPECÍFICOS DE WHATSAPP

export interface WhatsAppApiError {
  error: {
    message: string;
    type: string;
    code: number;
    fbtrace_id: string;
    error_subcode?: number;
    error_user_title?: string;
    error_user_msg?: string;
    error_data?: {
      messaging_product: string;
      details: string;
    };
  };
}

// UTILIDADES DE TIPOS

export type WhatsAppPhoneNumber = string; // Formato E.164
export type WhatsAppMessageId = string;
export type WhatsAppUserId = string; // wa_id