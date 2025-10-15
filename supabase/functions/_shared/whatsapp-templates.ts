// WhatsApp Template Messages Helper
// Utilidades para enviar plantillas de WhatsApp aprobadas

export class WhatsAppTemplates {
  private phoneNumberId: string;
  private accessToken: string;

  constructor(phoneNumberId: string, accessToken: string) {
    this.phoneNumberId = phoneNumberId;
    this.accessToken = accessToken;
  }

  /**
   * Enviar plantilla de acceso al menú web
   *
   * NOTA: Por defecto usa versión sin variable en header (más simple, evita que Meta la marque como MARKETING)
   * Para usar versión con nombre, pasar usePersonalizedHeader = true
   *
   * @param to - Número de teléfono en formato E.164 (ej: +56912345678)
   * @param contactName - Nombre del contacto (solo se usa si usePersonalizedHeader = true)
   * @param menuUrl - URL completa del menú con token
   * @param usePersonalizedHeader - Si true, incluye nombre en header (default: false)
   * @returns Response de la API de WhatsApp
   */
  async sendMenuWebAccessTemplate(
    to: string,
    contactName: string,
    menuUrl: string,
    usePersonalizedHeader: boolean = false
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      console.log('[TEMPLATE] Sending menu_web_access:', { to, contactName, menuUrl, usePersonalizedHeader });

      // Componentes base: siempre incluye el botón con URL
      const components: any[] = [
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [
            {
              type: 'text',
              text: menuUrl
            }
          ]
        }
      ];

      // Si se solicita, agregar header personalizado (OPCIÓN 2)
      // Por defecto NO se agrega (OPCIÓN 1 - recomendada para UTILITY)
      if (usePersonalizedHeader) {
        components.unshift({
          type: 'header',
          parameters: [
            {
              type: 'text',
              text: contactName || 'Usuario'
            }
          ]
        });
      }

      const payload = {
        messaging_product: 'whatsapp',
        to: to.replace('+', ''),
        type: 'template',
        template: {
          name: 'menu_web_access',
          language: { code: 'es' },
          components: components
        }
      };

      console.log('[TEMPLATE] Payload:', JSON.stringify(payload, null, 2));

      const response = await fetch(
        `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );

      const result = await response.json();

      if (!response.ok) {
        console.error('[TEMPLATE] Error response:', result);
        return {
          success: false,
          error: result.error?.message || 'Error sending template'
        };
      }

      console.log('[TEMPLATE] Success:', result);

      return {
        success: true,
        messageId: result.messages?.[0]?.id
      };

    } catch (error) {
      console.error('[TEMPLATE] Exception:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generar token de menú y enviar plantilla
   *
   * @param supabaseUrl - URL de Supabase
   * @param supabaseKey - Service role key de Supabase
   * @param tenantId - ID del tenant
   * @param contactId - ID del contacto
   * @param phoneE164 - Teléfono en formato E.164
   * @param contactName - Nombre del contacto
   * @returns Response con éxito/error
   */
  async generateAndSendMenuAccess(
    supabaseUrl: string,
    supabaseKey: string,
    tenantId: string,
    contactId: string,
    phoneE164: string,
    contactName: string
  ): Promise<{ success: boolean; menuUrl?: string; messageId?: string; error?: string }> {
    try {
      console.log('[MENU_ACCESS] Generating token for:', { tenantId, contactId });

      // 1. Generar token del menú
      const tokenResponse = await fetch(
        `${supabaseUrl}/functions/v1/generate-menu-token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({
            tenant_id: tenantId,
            contact_id: contactId,
            token_type: 'llt'
          })
        }
      );

      const tokenData = await tokenResponse.json();

      if (!tokenData.success) {
        console.error('[MENU_ACCESS] Error generating token:', tokenData);
        return {
          success: false,
          error: tokenData.error || 'Error generating menu token'
        };
      }

      const menuUrl = tokenData.data.url;
      console.log('[MENU_ACCESS] Token generated, URL:', menuUrl);

      // 2. Enviar plantilla de WhatsApp
      const templateResult = await this.sendMenuWebAccessTemplate(
        phoneE164,
        contactName,
        menuUrl
      );

      if (!templateResult.success) {
        return {
          success: false,
          menuUrl: menuUrl, // Retornar URL aunque falle el envío
          error: templateResult.error
        };
      }

      return {
        success: true,
        menuUrl: menuUrl,
        messageId: templateResult.messageId
      };

    } catch (error) {
      console.error('[MENU_ACCESS] Exception:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}
