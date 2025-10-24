/**
 * Cliente OpenAI para integración con edge functions
 * Maneja GPT-4, Whisper y Vision API
 */

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
      url: string;
      detail?: 'low' | 'high' | 'auto';
    };
  }>;
}

export interface ChatCompletionRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_completion_tokens?: number; // GPT-5 usa max_completion_tokens en lugar de max_tokens
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  tools?: any[];
  tool_choice?: any;
  // GPT-5 specific parameters
  verbosity?: 'low' | 'medium' | 'high';
  reasoning_effort?: 'minimal' | 'low' | 'medium' | 'high';
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface TranscriptionRequest {
  file: Blob | File;
  model: string;
  language?: string;
  prompt?: string;
  response_format?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
  temperature?: number;
}

export interface TranscriptionResponse {
  text: string;
}

export class OpenAIClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = 'https://api.openai.com/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  /**
   * Completar chat con GPT-4 (texto o visión)
   */
  async chatCompletion(
    request: ChatCompletionRequest
  ): Promise<{ success: boolean; data?: ChatCompletionResponse; error?: string }> {
    try {
      console.log('[OpenAI] Chat completion request:', {
        model: request.model,
        messages: request.messages.length,
        has_tools: !!request.tools
      });

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('[OpenAI] Error response:', result);
        return {
          success: false,
          error: result.error?.message || 'Error calling OpenAI API'
        };
      }

      console.log('[OpenAI] Success:', {
        model: result.model,
        tokens: result.usage?.total_tokens,
        finish_reason: result.choices[0]?.finish_reason
      });

      return {
        success: true,
        data: result
      };

    } catch (error) {
      console.error('[OpenAI] Exception:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Transcribir audio con Whisper
   */
  async transcribeAudio(
    audioData: Blob | File,
    options: {
      language?: string;
      prompt?: string;
      temperature?: number;
    } = {}
  ): Promise<{ success: boolean; transcription?: string; error?: string }> {
    try {
      console.log('[OpenAI] Whisper transcription request:', {
        size: audioData.size,
        type: audioData.type,
        language: options.language
      });

      // Crear FormData para el archivo
      const formData = new FormData();
      formData.append('file', audioData, 'audio.ogg'); // WhatsApp usa OGG
      formData.append('model', 'whisper-1');

      if (options.language) {
        formData.append('language', options.language);
      }

      if (options.prompt) {
        formData.append('prompt', options.prompt);
      }

      if (options.temperature !== undefined) {
        formData.append('temperature', options.temperature.toString());
      }

      const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
          // No incluir Content-Type, fetch lo establece automáticamente con boundary
        },
        body: formData
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('[OpenAI] Whisper error:', result);
        return {
          success: false,
          error: result.error?.message || 'Error transcribing audio'
        };
      }

      console.log('[OpenAI] Whisper success:', {
        text_length: result.text?.length
      });

      return {
        success: true,
        transcription: result.text
      };

    } catch (error) {
      console.error('[OpenAI] Whisper exception:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Analizar imagen con GPT-5 Vision
   */
  async analyzeImage(
    imageUrl: string,
    prompt: string,
    options: {
      model?: string;
      max_completion_tokens?: number; // GPT-5 usa max_completion_tokens
      detail?: 'low' | 'high' | 'auto';
      verbosity?: 'low' | 'medium' | 'high';
    } = {}
  ): Promise<{ success: boolean; analysis?: string; error?: string }> {
    try {
      console.log('[OpenAI] Vision analysis request:', {
        model: options.model || 'gpt-5-nano',
        detail: options.detail || 'auto',
        verbosity: options.verbosity || 'low'
      });

      const messages: OpenAIMessage[] = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
                detail: options.detail || 'auto'
              }
            }
          ]
        }
      ];

      const result = await this.chatCompletion({
        model: options.model || 'gpt-5-nano',
        messages,
        max_completion_tokens: options.max_completion_tokens || 1000,
        verbosity: options.verbosity || 'low', // GPT-5: respuestas concisas
        reasoning_effort: 'minimal' // GPT-5: respuestas rápidas
      });

      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error
        };
      }

      return {
        success: true,
        analysis: result.data.choices[0]?.message?.content || ''
      };

    } catch (error) {
      console.error('[OpenAI] Vision exception:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Helper: Crear mensaje de sistema para contexto del bot
   */
  static createSystemMessage(
    tenantName: string,
    contactName: string,
    availableServices: string[]
  ): OpenAIMessage {
    return {
      role: 'system',
      content: `Eres un asistente virtual inteligente de ${tenantName}, un sistema de gestión de préstamos y servicios.

Tu función es ayudar a ${contactName} a gestionar sus préstamos, servicios y contactos de manera natural y eficiente.

SERVICIOS DISPONIBLES:
${availableServices.map(s => `- ${s}`).join('\n')}

REGLAS IMPORTANTES:
1. Siempre sé amable, profesional y conciso en español chileno
2. Cuando detectes una intención, extrae TODOS los datos relevantes mencionados
3. Para nombres de contactos, usa búsqueda inteligente (pueden escribir apodos o nombres parciales)
4. Para fechas relativas como "fin de mes", "próximo viernes", calcula la fecha exacta
5. Para montos, acepta formatos como "50 lucas", "$50.000", "50mil"
6. Si falta información crítica, pregúntala de forma natural
7. Antes de ejecutar acciones de CREACIÓN o MODIFICACIÓN, solicita confirmación explícita
8. Para CONSULTAS, responde directamente sin confirmación
9. Si no estás seguro de la intención (confianza < 70%), ofrece opciones claras

FORMATOS DE RESPUESTA:
- Para confirmaciones: Usa lenguaje natural + botones de acción cuando sea posible
- Para errores: Explica qué faltó y cómo corregirlo
- Para consultas: Responde de forma directa y clara

EJEMPLOS DE INTENCIONES:
- "le presté 50 lucas a erick" → Crear préstamo otorgado
- "erick me prestó 30 mil" → Crear préstamo recibido
- "cuánto me debe juan" → Consultar deuda
- "marca el préstamo de maría como pagado" → Marcar como devuelto
- "cambia la fecha del préstamo de pedro al 30" → Reprogramar

Fecha actual: ${new Date().toISOString().split('T')[0]}`
    };
  }

  /**
   * Helper: Crear herramientas (functions) para GPT-4
   */
  static createTools() {
    return [
      {
        type: 'function',
        function: {
          name: 'create_loan',
          description: 'Crear un nuevo préstamo (otorgado o recibido)',
          parameters: {
            type: 'object',
            properties: {
              loan_type: {
                type: 'string',
                enum: ['lent', 'borrowed'],
                description: 'Tipo de préstamo: "lent" (otorgado/di/presté) o "borrowed" (recibido/me prestaron)'
              },
              contact_name: {
                type: 'string',
                description: 'Nombre del contacto (puede ser nombre parcial o apodo)'
              },
              amount: {
                type: 'number',
                description: 'Monto del préstamo en pesos chilenos'
              },
              due_date: {
                type: 'string',
                description: 'Fecha de devolución en formato YYYY-MM-DD'
              },
              notes: {
                type: 'string',
                description: 'Notas o descripción adicional (opcional)'
              }
            },
            required: ['loan_type', 'contact_name', 'amount', 'due_date']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'query_loans',
          description: 'Consultar préstamos (estado, saldos, listados)',
          parameters: {
            type: 'object',
            properties: {
              query_type: {
                type: 'string',
                enum: ['all', 'pending', 'by_contact', 'balance'],
                description: 'Tipo de consulta'
              },
              contact_name: {
                type: 'string',
                description: 'Nombre del contacto (opcional, solo para by_contact)'
              }
            },
            required: ['query_type']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'mark_loan_returned',
          description: 'Marcar un préstamo como devuelto/pagado',
          parameters: {
            type: 'object',
            properties: {
              contact_name: {
                type: 'string',
                description: 'Nombre del contacto'
              },
              confirmation_required: {
                type: 'boolean',
                description: 'Si se requiere confirmación del usuario'
              }
            },
            required: ['contact_name']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'reschedule_loan',
          description: 'Reprogramar fecha de devolución de un préstamo',
          parameters: {
            type: 'object',
            properties: {
              contact_name: {
                type: 'string',
                description: 'Nombre del contacto'
              },
              new_due_date: {
                type: 'string',
                description: 'Nueva fecha de devolución en formato YYYY-MM-DD'
              }
            },
            required: ['contact_name', 'new_due_date']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'search_contacts',
          description: 'Buscar contactos del usuario',
          parameters: {
            type: 'object',
            properties: {
              search_term: {
                type: 'string',
                description: 'Término de búsqueda (nombre, apodo, teléfono)'
              }
            },
            required: ['search_term']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'show_uncertainty',
          description: 'Cuando no estás seguro de la intención, registra el caso y muestra opciones al usuario',
          parameters: {
            type: 'object',
            properties: {
              possible_intents: {
                type: 'array',
                items: {
                  type: 'string'
                },
                description: 'Lista de posibles intenciones detectadas'
              },
              confidence_scores: {
                type: 'object',
                description: 'Scores de confianza para cada intención'
              },
              clarification_question: {
                type: 'string',
                description: 'Pregunta para aclarar la intención'
              }
            },
            required: ['possible_intents', 'clarification_question']
          }
        }
      }
    ];
  }
}
