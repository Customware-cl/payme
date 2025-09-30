// WhatsApp 24-Hour Window Manager
// Gestiona la ventana de 24 horas para envío de mensajes de WhatsApp Business

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface MessageQueueItem {
  id?: string;
  tenant_id: string;
  contact_id: string;
  message_type: 'template' | 'text' | 'interactive';
  content: any;
  template_name?: string;
  template_variables?: Record<string, any>;
  scheduled_for?: string;
  priority: 'high' | 'normal' | 'low';
  max_retries: number;
  retry_count: number;
  status: 'pending' | 'sent' | 'failed' | 'expired';
  expires_at?: string;
}

interface WindowStatus {
  isOpen: boolean;
  expiresAt?: Date;
  lastInboundMessage?: Date;
  canSendFreeForm: boolean;
  mustUseTemplate: boolean;
}

interface SendMessageOptions {
  forceTemplate?: boolean;
  templateName?: string;
  templateVariables?: Record<string, any>;
  priority?: 'high' | 'normal' | 'low';
  scheduleFor?: Date;
  maxRetries?: number;
}

export class WhatsAppWindowManager {
  private supabase: any;
  private windowDurationMs: number = 24 * 60 * 60 * 1000; // 24 horas

  constructor(supabaseUrl: string, supabaseServiceKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  // Verificar estado de la ventana de 24 horas para un contacto
  async getWindowStatus(tenantId: string, contactId: string): Promise<WindowStatus> {
    try {
      // Buscar último mensaje entrante del contacto
      const { data: lastInboundMessage } = await this.supabase
        .from('whatsapp_messages')
        .select('created_at')
        .eq('tenant_id', tenantId)
        .eq('contact_id', contactId)
        .eq('direction', 'inbound')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!lastInboundMessage) {
        // Sin mensajes entrantes previos - ventana cerrada
        return {
          isOpen: false,
          canSendFreeForm: false,
          mustUseTemplate: true
        };
      }

      const lastMessageTime = new Date(lastInboundMessage.created_at);
      const now = new Date();
      const timeDiff = now.getTime() - lastMessageTime.getTime();
      const isWindowOpen = timeDiff < this.windowDurationMs;

      if (isWindowOpen) {
        const expiresAt = new Date(lastMessageTime.getTime() + this.windowDurationMs);
        return {
          isOpen: true,
          expiresAt,
          lastInboundMessage: lastMessageTime,
          canSendFreeForm: true,
          mustUseTemplate: false
        };
      } else {
        return {
          isOpen: false,
          lastInboundMessage: lastMessageTime,
          canSendFreeForm: false,
          mustUseTemplate: true
        };
      }
    } catch (error) {
      console.error('Error checking window status:', error);
      // En caso de error, asumir ventana cerrada por seguridad
      return {
        isOpen: false,
        canSendFreeForm: false,
        mustUseTemplate: true
      };
    }
  }

  // Enviar mensaje respetando la ventana de 24 horas
  async sendMessage(
    tenantId: string,
    contactId: string,
    message: string,
    options: SendMessageOptions = {}
  ): Promise<{
    success: boolean;
    sent: boolean;
    queued: boolean;
    messageId?: string;
    queueId?: string;
    error?: string;
    windowStatus: WindowStatus;
  }> {
    try {
      const windowStatus = await this.getWindowStatus(tenantId, contactId);

      // Si se fuerza template o la ventana está cerrada, usar template
      const shouldUseTemplate = options.forceTemplate || windowStatus.mustUseTemplate;

      if (shouldUseTemplate) {
        // Buscar template apropiado
        const templateName = options.templateName || await this.selectBestTemplate(tenantId, 'general');

        if (!templateName) {
          // No hay template disponible - encolar mensaje
          const queueId = await this.queueMessage(tenantId, contactId, message, options);
          return {
            success: true,
            sent: false,
            queued: true,
            queueId,
            windowStatus
          };
        }

        // Enviar con template
        const result = await this.sendTemplateMessage(
          tenantId,
          contactId,
          templateName,
          options.templateVariables || { message }
        );

        return {
          success: result.success,
          sent: result.success,
          queued: false,
          messageId: result.messageId,
          error: result.error,
          windowStatus
        };
      } else {
        // Ventana abierta - enviar mensaje de texto libre
        const result = await this.sendFreeFormMessage(tenantId, contactId, message);

        return {
          success: result.success,
          sent: result.success,
          queued: false,
          messageId: result.messageId,
          error: result.error,
          windowStatus
        };
      }
    } catch (error) {
      console.error('Error sending message:', error);
      return {
        success: false,
        sent: false,
        queued: false,
        error: error.message,
        windowStatus: { isOpen: false, canSendFreeForm: false, mustUseTemplate: true }
      };
    }
  }

  // Encolar mensaje para envío posterior
  private async queueMessage(
    tenantId: string,
    contactId: string,
    message: string,
    options: SendMessageOptions
  ): Promise<string> {
    const queueItem: MessageQueueItem = {
      tenant_id: tenantId,
      contact_id: contactId,
      message_type: 'text',
      content: { text: message },
      priority: options.priority || 'normal',
      max_retries: options.maxRetries || 3,
      retry_count: 0,
      status: 'pending',
      scheduled_for: options.scheduleFor?.toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 días
    };

    const { data: inserted } = await this.supabase
      .from('message_queue')
      .insert(queueItem)
      .select('id')
      .single();

    return inserted.id;
  }

  // Seleccionar mejor template para un contexto
  private async selectBestTemplate(tenantId: string, category: string): Promise<string | null> {
    const { data: templates } = await this.supabase
      .from('templates')
      .select('meta_template_name, name')
      .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
      .eq('approval_status', 'approved')
      .eq('category', category)
      .limit(1);

    if (!templates || templates.length === 0) {
      // Buscar template general por defecto
      const { data: defaultTemplate } = await this.supabase
        .from('templates')
        .select('meta_template_name, name')
        .is('tenant_id', null)
        .eq('approval_status', 'approved')
        .limit(1);

      return defaultTemplate?.[0]?.meta_template_name || defaultTemplate?.[0]?.name || null;
    }

    return templates[0].meta_template_name || templates[0].name;
  }

  // Enviar mensaje con template (HSM)
  private async sendTemplateMessage(
    tenantId: string,
    contactId: string,
    templateName: string,
    variables: Record<string, any>
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Obtener información del tenant y contacto
      const { data: tenant } = await this.supabase
        .from('tenants')
        .select('whatsapp_phone_number_id, whatsapp_access_token')
        .eq('id', tenantId)
        .single();

      const { data: contact } = await this.supabase
        .from('contacts')
        .select('phone_e164')
        .eq('id', contactId)
        .single();

      if (!tenant?.whatsapp_access_token || !contact?.phone_e164) {
        throw new Error('Missing WhatsApp configuration or contact phone');
      }

      // Preparar payload para WhatsApp API
      const payload = {
        messaging_product: 'whatsapp',
        to: contact.phone_e164.replace('+', ''),
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'es' },
          components: Object.keys(variables).length > 0 ? [
            {
              type: 'body',
              parameters: Object.values(variables).map(value => ({
                type: 'text',
                text: String(value)
              }))
            }
          ] : []
        }
      };

      // Enviar a WhatsApp API
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${tenant.whatsapp_phone_number_id}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tenant.whatsapp_access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(`WhatsApp API error: ${result.error?.message || 'Unknown error'}`);
      }

      // Registrar mensaje en base de datos
      const { data: messageRecord } = await this.supabase
        .from('whatsapp_messages')
        .insert({
          tenant_id: tenantId,
          contact_id: contactId,
          wa_message_id: result.messages[0].id,
          direction: 'outbound',
          message_type: 'template',
          content: payload.template,
          template_variables: variables,
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .select('id')
        .single();

      return {
        success: true,
        messageId: messageRecord.id
      };

    } catch (error) {
      console.error('Error sending template message:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Enviar mensaje de texto libre (dentro de ventana 24h)
  private async sendFreeFormMessage(
    tenantId: string,
    contactId: string,
    message: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Obtener información del tenant y contacto
      const { data: tenant } = await this.supabase
        .from('tenants')
        .select('whatsapp_phone_number_id, whatsapp_access_token')
        .eq('id', tenantId)
        .single();

      const { data: contact } = await this.supabase
        .from('contacts')
        .select('phone_e164')
        .eq('id', contactId)
        .single();

      if (!tenant?.whatsapp_access_token || !contact?.phone_e164) {
        throw new Error('Missing WhatsApp configuration or contact phone');
      }

      // Preparar payload para mensaje de texto
      const payload = {
        messaging_product: 'whatsapp',
        to: contact.phone_e164.replace('+', ''),
        type: 'text',
        text: { body: message }
      };

      // Enviar a WhatsApp API
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${tenant.whatsapp_phone_number_id}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tenant.whatsapp_access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(`WhatsApp API error: ${result.error?.message || 'Unknown error'}`);
      }

      // Registrar mensaje en base de datos
      const { data: messageRecord } = await this.supabase
        .from('whatsapp_messages')
        .insert({
          tenant_id: tenantId,
          contact_id: contactId,
          wa_message_id: result.messages[0].id,
          direction: 'outbound',
          message_type: 'text',
          content: { text: message },
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .select('id')
        .single();

      return {
        success: true,
        messageId: messageRecord.id
      };

    } catch (error) {
      console.error('Error sending free form message:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Procesar cola de mensajes pendientes
  async processMessageQueue(tenantId?: string): Promise<{
    processed: number;
    sent: number;
    failed: number;
    expired: number;
  }> {
    try {
      // Obtener mensajes pendientes
      let query = this.supabase
        .from('message_queue')
        .select('*')
        .eq('status', 'pending')
        .lt('retry_count', this.supabase.raw('max_retries'))
        .or('scheduled_for.is.null,scheduled_for.lte.' + new Date().toISOString());

      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data: queueItems } = await query
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(100);

      if (!queueItems || queueItems.length === 0) {
        return { processed: 0, sent: 0, failed: 0, expired: 0 };
      }

      const stats = { processed: 0, sent: 0, failed: 0, expired: 0 };

      for (const item of queueItems) {
        stats.processed++;

        // Verificar expiración
        if (item.expires_at && new Date(item.expires_at) < new Date()) {
          await this.supabase
            .from('message_queue')
            .update({ status: 'expired' })
            .eq('id', item.id);
          stats.expired++;
          continue;
        }

        // Intentar enviar mensaje
        const windowStatus = await this.getWindowStatus(item.tenant_id, item.contact_id);

        if (windowStatus.canSendFreeForm) {
          // Enviar como texto libre
          const result = await this.sendFreeFormMessage(
            item.tenant_id,
            item.contact_id,
            item.content.text
          );

          if (result.success) {
            await this.supabase
              .from('message_queue')
              .update({ status: 'sent' })
              .eq('id', item.id);
            stats.sent++;
          } else {
            await this.supabase
              .from('message_queue')
              .update({
                retry_count: item.retry_count + 1,
                status: item.retry_count + 1 >= item.max_retries ? 'failed' : 'pending'
              })
              .eq('id', item.id);

            if (item.retry_count + 1 >= item.max_retries) {
              stats.failed++;
            }
          }
        }
        // Si ventana cerrada, dejar en cola para próximo intento
      }

      return stats;

    } catch (error) {
      console.error('Error processing message queue:', error);
      return { processed: 0, sent: 0, failed: 0, expired: 0 };
    }
  }

  // Limpiar mensajes expirados de la cola
  async cleanupExpiredMessages(): Promise<number> {
    const { data } = await this.supabase
      .from('message_queue')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('id');

    return data?.length || 0;
  }

  // Obtener estadísticas de la ventana de 24h
  async getWindowStats(tenantId: string): Promise<{
    totalContacts: number;
    openWindows: number;
    closedWindows: number;
    queuedMessages: number;
  }> {
    // Obtener todos los contactos del tenant
    const { data: contacts } = await this.supabase
      .from('contacts')
      .select('id')
      .eq('tenant_id', tenantId);

    if (!contacts) {
      return { totalContacts: 0, openWindows: 0, closedWindows: 0, queuedMessages: 0 };
    }

    let openWindows = 0;
    let closedWindows = 0;

    // Verificar estado de ventana para cada contacto
    for (const contact of contacts) {
      const windowStatus = await this.getWindowStatus(tenantId, contact.id);
      if (windowStatus.isOpen) {
        openWindows++;
      } else {
        closedWindows++;
      }
    }

    // Contar mensajes en cola
    const { count: queuedMessages } = await this.supabase
      .from('message_queue')
      .select('id', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .eq('status', 'pending');

    return {
      totalContacts: contacts.length,
      openWindows,
      closedWindows,
      queuedMessages: queuedMessages || 0
    };
  }
}