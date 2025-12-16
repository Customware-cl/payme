// WhatsApp Client - Generic message sending
// Módulo genérico para enviar mensajes de WhatsApp usando Graph API

interface WhatsAppTemplateOptions {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  template: {
    name: string;
    language: { code: string };
    components: any[];
  };
}

interface WhatsAppTextOptions {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  text: string;
}

interface WhatsAppImageOptions {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  imageUrl: string;
  caption?: string;
}

interface WhatsAppMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Tipo unión para soportar ambos formatos
type WhatsAppMessageOptions = WhatsAppTemplateOptions | WhatsAppTextOptions;

/**
 * Enviar mensaje de WhatsApp (plantilla HSM o texto)
 *
 * @param options - Configuración del mensaje
 * @returns Resultado con success, messageId o error
 */
export async function sendWhatsAppMessage(
  options: WhatsAppMessageOptions
): Promise<WhatsAppMessageResult> {
  try {
    const { phoneNumberId, accessToken, to } = options;

    let payload: any;

    // Determinar si es template o texto
    if ('template' in options) {
      console.log('[WhatsApp Client] Sending template:', {
        to,
        templateName: options.template.name,
        components: options.template.components.length
      });

      payload = {
        messaging_product: 'whatsapp',
        to: to.replace('+', ''),
        type: 'template',
        template: {
          name: options.template.name,
          language: options.template.language,
          components: options.template.components
        }
      };
    } else if ('text' in options) {
      console.log('[WhatsApp Client] Sending text message to:', to);

      payload = {
        messaging_product: 'whatsapp',
        to: to.replace('+', ''),
        type: 'text',
        text: {
          body: options.text,
          preview_url: true
        }
      };
    } else {
      throw new Error('Invalid options: must include template or text');
    }

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

/**
 * Enviar imagen de WhatsApp con caption opcional
 *
 * @param options - Configuración de la imagen
 * @returns Resultado con success, messageId o error
 */
export async function sendWhatsAppImage(
  options: WhatsAppImageOptions
): Promise<WhatsAppMessageResult> {
  try {
    const { phoneNumberId, accessToken, to, imageUrl, caption } = options;

    console.log('[WhatsApp Client] Sending image:', { to, imageUrl: imageUrl.substring(0, 50) + '...' });

    const payload = {
      messaging_product: 'whatsapp',
      to: to.replace('+', ''),
      type: 'image',
      image: {
        link: imageUrl,
        caption: caption || undefined
      }
    };

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
      console.error('[WhatsApp Client] Image error response:', result);
      return {
        success: false,
        error: result.error?.message || 'Error sending image'
      };
    }

    console.log('[WhatsApp Client] Image sent successfully:', result);

    return {
      success: true,
      messageId: result.messages?.[0]?.id
    };

  } catch (error) {
    console.error('[WhatsApp Client] Image exception:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
