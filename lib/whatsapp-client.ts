// Cliente para WhatsApp Cloud API
import {
  WhatsAppOutboundMessage,
  WhatsAppSendMessageResponse,
  WhatsAppClientConfig,
  WhatsAppApiError,
  RateLimitResult,
  RateLimitInfo
} from '../types/index.ts';

export class WhatsAppClient {
  private accessToken: string;
  private phoneNumberId: string;
  private businessAccountId?: string;
  private apiVersion: string;
  private baseUrl: string;
  private rateLimitCache: Map<string, RateLimitInfo> = new Map();

  constructor(config: WhatsAppClientConfig) {
    this.accessToken = config.accessToken;
    this.phoneNumberId = config.phoneNumberId;
    this.businessAccountId = config.businessAccountId;
    this.apiVersion = config.apiVersion || 'v18.0';
    this.baseUrl = config.baseUrl || 'https://graph.facebook.com';
  }

  /**
   * Envía un mensaje a través de WhatsApp API
   */
  async sendMessage(message: WhatsAppOutboundMessage): Promise<WhatsAppSendMessageResponse> {
    const url = `${this.baseUrl}/${this.apiVersion}/${this.phoneNumberId}/messages`;

    // Verificar rate limit antes de enviar
    const rateLimitCheck = this.checkRateLimit(this.phoneNumberId);
    if (!rateLimitCheck.allowed) {
      throw new Error(`Rate limit exceeded. Retry after ${rateLimitCheck.retry_after} seconds`);
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      // Actualizar información de rate limit
      this.updateRateLimitInfo(response.headers);

      if (!response.ok) {
        const errorData: WhatsAppApiError = await response.json();
        throw new WhatsAppApiClientError(
          errorData.error.message,
          errorData.error.code,
          errorData.error.type,
          errorData
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof WhatsAppApiClientError) {
        throw error;
      }
      throw new Error(`Failed to send WhatsApp message: ${error.message}`);
    }
  }

  /**
   * Envía un mensaje de texto simple
   */
  async sendTextMessage(to: string, text: string, previewUrl: boolean = false): Promise<WhatsAppSendMessageResponse> {
    const message: WhatsAppOutboundMessage = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: {
        preview_url: previewUrl,
        body: text,
      },
    };

    return this.sendMessage(message);
  }

  /**
   * Envía un mensaje usando template
   */
  async sendTemplateMessage(
    to: string,
    templateName: string,
    languageCode: string = 'es',
    components?: any[]
  ): Promise<WhatsAppSendMessageResponse> {
    const message: WhatsAppOutboundMessage = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: languageCode,
        },
        components,
      },
    };

    return this.sendMessage(message);
  }

  /**
   * Envía un mensaje interactivo con botones
   */
  async sendInteractiveMessage(
    to: string,
    bodyText: string,
    buttons: Array<{ id: string; title: string }>,
    headerText?: string,
    footerText?: string
  ): Promise<WhatsAppSendMessageResponse> {
    const message: WhatsAppOutboundMessage = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        header: headerText ? {
          type: 'text',
          text: headerText,
        } : undefined,
        body: {
          text: bodyText,
        },
        footer: footerText ? {
          text: footerText,
        } : undefined,
        action: {
          buttons: buttons.map(button => ({
            type: 'reply',
            reply: {
              id: button.id,
              title: button.title,
            },
          })),
        },
      },
    };

    return this.sendMessage(message);
  }

  /**
   * Verifica la firma del webhook
   */
  static verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    try {
      const expectedSignature = 'sha256=' +
        crypto.subtle.digest('SHA-256',
          new TextEncoder().encode(secret + payload)
        );

      return signature === expectedSignature;
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  /**
   * Valida el token de verificación del webhook
   */
  static verifyWebhookToken(
    mode: string,
    token: string,
    challenge: string,
    verifyToken: string
  ): string | null {
    if (mode === 'subscribe' && token === verifyToken) {
      return challenge;
    }
    return null;
  }

  /**
   * Parsea el número de teléfono al formato E.164
   */
  static parsePhoneNumber(phone: string, defaultCountryCode: string = '52'): string {
    // Limpiar el número
    let cleaned = phone.replace(/\D/g, '');

    // Si no empieza con +, agregar el código de país
    if (!cleaned.startsWith(defaultCountryCode)) {
      cleaned = defaultCountryCode + cleaned;
    }

    return '+' + cleaned;
  }

  /**
   * Valida si un número está en formato E.164
   */
  static isValidE164(phone: string): boolean {
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phone);
  }

  /**
   * Verifica el rate limit
   */
  private checkRateLimit(identifier: string): RateLimitResult {
    const cached = this.rateLimitCache.get(identifier);

    if (!cached) {
      return {
        allowed: true,
        info: {
          remaining: 1000,
          reset_time: Date.now() + 3600000, // 1 hora
          limit: 1000,
        },
      };
    }

    const now = Date.now();
    if (now > cached.reset_time) {
      // Reset del rate limit
      const newInfo: RateLimitInfo = {
        remaining: cached.limit,
        reset_time: now + 3600000,
        limit: cached.limit,
      };
      this.rateLimitCache.set(identifier, newInfo);
      return { allowed: true, info: newInfo };
    }

    if (cached.remaining <= 0) {
      return {
        allowed: false,
        retry_after: Math.ceil((cached.reset_time - now) / 1000),
        info: cached,
      };
    }

    return { allowed: true, info: cached };
  }

  /**
   * Actualiza la información de rate limit desde headers de respuesta
   */
  private updateRateLimitInfo(headers: Headers): void {
    const remaining = headers.get('X-RateLimit-Remaining');
    const reset = headers.get('X-RateLimit-Reset');
    const limit = headers.get('X-RateLimit-Limit');

    if (remaining && reset && limit) {
      const rateLimitInfo: RateLimitInfo = {
        remaining: parseInt(remaining),
        reset_time: parseInt(reset) * 1000, // Convert to milliseconds
        limit: parseInt(limit),
      };

      this.rateLimitCache.set(this.phoneNumberId, rateLimitInfo);
    }
  }

  /**
   * Obtiene la información de un media ID
   */
  async getMediaUrl(mediaId: string): Promise<string> {
    const url = `${this.baseUrl}/${this.apiVersion}/${mediaId}`;

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get media URL: ${response.statusText}`);
      }

      const data = await response.json();
      return data.url;
    } catch (error) {
      throw new Error(`Failed to get media URL: ${error.message}`);
    }
  }

  /**
   * Descarga un archivo multimedia
   */
  async downloadMedia(mediaUrl: string): Promise<Uint8Array> {
    try {
      const response = await fetch(mediaUrl, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to download media: ${response.statusText}`);
      }

      return new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      throw new Error(`Failed to download media: ${error.message}`);
    }
  }
}

/**
 * Error personalizado para errores de WhatsApp API
 */
export class WhatsAppApiClientError extends Error {
  public readonly code: number;
  public readonly type: string;
  public readonly details: WhatsAppApiError;

  constructor(message: string, code: number, type: string, details: WhatsAppApiError) {
    super(message);
    this.name = 'WhatsAppApiClientError';
    this.code = code;
    this.type = type;
    this.details = details;
  }

  /**
   * Verifica si el error es recuperable (retry)
   */
  isRetryable(): boolean {
    // Errores que se pueden reintentar
    const retryableCodes = [
      1, // Temporary issue
      2, // Rate limit exceeded (should wait)
      100, // Generic API error
    ];

    return retryableCodes.includes(this.code);
  }

  /**
   * Obtiene el tiempo de espera sugerido para retry
   */
  getRetryDelay(): number {
    if (this.code === 2) { // Rate limit
      return 60; // 1 minuto
    }
    return 30; // 30 segundos por defecto
  }
}

/**
 * Utilidades para templates
 */
export class TemplateUtils {
  /**
   * Renderiza variables en un template
   */
  static renderTemplate(template: string, variables: Record<string, string>): string {
    let rendered = template;

    Object.entries(variables).forEach(([key, value], index) => {
      // Reemplazar {{1}}, {{2}}, etc. (formato de WhatsApp)
      rendered = rendered.replace(new RegExp(`\\{\\{${index + 1}\\}\\}`, 'g'), value);
      // Reemplazar {{key}} (formato más legible)
      rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    });

    return rendered;
  }

  /**
   * Extrae variables de un template
   */
  static extractVariables(template: string): string[] {
    const variables: string[] = [];
    const matches = template.match(/\{\{(\w+)\}\}/g);

    if (matches) {
      matches.forEach(match => {
        const variable = match.replace(/[{}]/g, '');
        if (!variables.includes(variable)) {
          variables.push(variable);
        }
      });
    }

    return variables;
  }

  /**
   * Valida que todas las variables requeridas estén presentes
   */
  static validateVariables(
    template: string,
    variables: Record<string, string>
  ): { valid: boolean; missing: string[] } {
    const required = this.extractVariables(template);
    const provided = Object.keys(variables);
    const missing = required.filter(req => !provided.includes(req));

    return {
      valid: missing.length === 0,
      missing,
    };
  }
}