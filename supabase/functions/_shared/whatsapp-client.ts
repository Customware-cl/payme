// WhatsApp Client - Generic message sending
// Módulo genérico para enviar mensajes de WhatsApp usando Graph API

interface WhatsAppMessageOptions {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  template: {
    name: string;
    language: { code: string };
    components: any[];
  };
}

interface WhatsAppMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Enviar mensaje de WhatsApp usando plantilla HSM
 *
 * @param options - Configuración del mensaje
 * @returns Resultado con success, messageId o error
 */
export async function sendWhatsAppMessage(
  options: WhatsAppMessageOptions
): Promise<WhatsAppMessageResult> {
  try {
    const { phoneNumberId, accessToken, to, template } = options;

    console.log('[WhatsApp Client] Sending template:', {
      to,
      templateName: template.name,
      components: template.components.length
    });

    const payload = {
      messaging_product: 'whatsapp',
      to: to.replace('+', ''),
      type: 'template',
      template: {
        name: template.name,
        language: template.language,
        components: template.components
      }
    };

    console.log('[WhatsApp Client] Payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
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

    if (!response.ok) {
      console.error('[WhatsApp Client] Error response:', result);
      return {
        success: false,
        error: result.error?.message || 'Error sending message'
      };
    }

    console.log('[WhatsApp Client] Success:', result);

    return {
      success: true,
      messageId: result.messages?.[0]?.id
    };

  } catch (error) {
    console.error('[WhatsApp Client] Exception:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
