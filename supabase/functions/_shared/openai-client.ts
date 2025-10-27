/**
 * Cliente OpenAI para integración con edge functions
 * Maneja GPT-4, Whisper y Vision API
 */

import { getPermissionsDescription } from './ai-permissions.ts';

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
    const permissionsDescription = getPermissionsDescription();
    const currentDate = new Date().toISOString().split('T')[0];

    return {
      role: 'system',
      content: `Eres un asistente virtual inteligente de ${tenantName}, un sistema de gestión de préstamos.

Tu función es ayudar a ${contactName} a gestionar sus préstamos y contactos de manera natural, segura y eficiente.

SERVICIOS DISPONIBLES:
${availableServices.map(s => `- ${s}`).join('\n')}

${permissionsDescription}

REGLAS DE SEGURIDAD - CRÍTICO:
1. NUNCA ejecutes operaciones de escritura (crear, modificar, eliminar) sin confirmación explícita del usuario
2. Las funciones de LECTURA (query_loans, search_contacts) pueden ejecutarse directamente
3. Las funciones de ESCRITURA (create_loan, mark_loan_returned, reschedule_loan, create_contact, update_contact) SIEMPRE requieren confirmación
4. Si el usuario dice "confirmo", "sí", "ok" → verifica que haya una acción pendiente de confirmar en el contexto
5. NO inventes ni asumas información crítica (montos, fechas, nombres)
6. NO ejecutes múltiples operaciones de escritura en una sola interacción sin confirmación individual

REGLAS DE INTERPRETACIÓN:
1. Para nombres de contactos: usa búsqueda fuzzy (acepta apodos, nombres parciales, errores de tipeo)
2. Para fechas relativas: calcula la fecha exacta en formato YYYY-MM-DD
   - "fin de mes" → último día del mes actual
   - "próximo viernes" → siguiente viernes desde hoy
   - "en 2 semanas" → 14 días desde hoy
3. Para montos: normaliza a número entero
   - "50 lucas" → 50000
   - "$50.000" → 50000
   - "50mil" → 50000
   - "500k" → 500000
4. Para tipo de préstamo:
   - "presté", "di", "le di", "otorgué" → loan_type: "lent"
   - "me prestaron", "me dieron", "recibí", "pedí" → loan_type: "borrowed"

MANEJO DE INCERTIDUMBRE:
- Si confianza < 70% → usa show_uncertainty() para pedir aclaración
- Si falta información crítica → pregunta de forma natural (NO uses show_uncertainty)
- Si hay múltiples interpretaciones válidas → muestra opciones al usuario

EJEMPLOS CORRECTOS - USO DE FUNCIONES:
1. "le presté 50 lucas a erick para fin de mes"
   → create_loan(loan_type="lent", contact_name="erick", amount=50000, due_date="2025-01-31")

2. "erick me prestó 30 mil"
   → Falta fecha → pregunta: "¿Para cuándo debes devolver los $30,000 a Erick?"

3. Usuario: "cuánto me debe juan"
   → query_loans(query_type="by_contact", contact_name="juan")

4. Usuario: "muéstrame mis préstamos vencidos"
   → query_loans(query_type="pending")

5. Usuario: "cuál es mi balance total"
   → query_loans(query_type="balance")

6. Usuario: "lista todos mis préstamos"
   → query_loans(query_type="all")

7. Usuario: "marca el préstamo de maría como pagado"
   → mark_loan_returned(contact_name="maría")

8. Usuario: "cambia la fecha del préstamo de pedro al 30"
   → reschedule_loan(contact_name="pedro", new_due_date="2025-01-30")

9. Usuario: "agrega a juan lópez"
   → create_contact(name="juan lópez")

RESPUESTAS:
- Sé amable, profesional y conciso en español chileno
- Evita lenguaje técnico innecesario
- Confirma las acciones de forma clara
- Si hay error, explica qué pasó y cómo solucionarlo

Fecha actual: ${currentDate}
Día de la semana: ${new Date().toLocaleDateString('es-CL', { weekday: 'long' })}`
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
          description: 'Consultar información sobre préstamos del usuario. Usa esta función cuando el usuario pida ver, listar, revisar o conocer el estado de sus préstamos.',
          parameters: {
            type: 'object',
            properties: {
              query_type: {
                type: 'string',
                enum: ['all', 'pending', 'by_contact', 'balance'],
                description: `Tipo de consulta a realizar:
- "balance": Para preguntas sobre TOTALES/RESUMEN/SALDOS GENERALES (ej: "cuánto me deben en total", "cuál es mi balance", "cuánto debo en total", "resumen general", "estado financiero")
- "pending": Para preguntas sobre préstamos VENCIDOS o PRÓXIMOS A VENCER (ej: "qué préstamos están vencidos", "cuáles vencen pronto", "qué tengo pendiente", "recordatorios", "alertas de vencimiento")
- "all": Para pedir LISTA COMPLETA de préstamos activos sin filtro específico (ej: "muéstrame todos los préstamos", "lista completa", "qué préstamos tengo", "todos mis préstamos activos")
- "by_contact": Para preguntas sobre préstamos CON UNA PERSONA ESPECÍFICA (ej: "cuánto me debe Juan", "qué préstamos tengo con María", "cómo estoy con Pedro", "relación con [nombre]")`
              },
              contact_name: {
                type: 'string',
                description: 'Nombre del contacto (OBLIGATORIO solo para query_type="by_contact", dejar vacío en otros casos)'
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
      },
      {
        type: 'function',
        function: {
          name: 'create_contact',
          description: 'Crear un nuevo contacto en el sistema',
          parameters: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Nombre completo del contacto'
              },
              phone: {
                type: 'string',
                description: 'Número de teléfono (opcional, formato +56912345678)'
              },
              nickname: {
                type: 'string',
                description: 'Apodo o nombre corto (opcional)'
              },
              notes: {
                type: 'string',
                description: 'Notas adicionales sobre el contacto (opcional)'
              }
            },
            required: ['name']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'update_contact',
          description: 'Actualizar información de un contacto existente',
          parameters: {
            type: 'object',
            properties: {
              contact_name: {
                type: 'string',
                description: 'Nombre del contacto a actualizar'
              },
              new_name: {
                type: 'string',
                description: 'Nuevo nombre (opcional)'
              },
              new_phone: {
                type: 'string',
                description: 'Nuevo teléfono (opcional)'
              },
              new_nickname: {
                type: 'string',
                description: 'Nuevo apodo (opcional)'
              },
              new_notes: {
                type: 'string',
                description: 'Nuevas notas (opcional)'
              }
            },
            required: ['contact_name']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'query_loans_dynamic',
          description: 'Ejecuta consulta SQL dinámica para preguntas complejas o específicas sobre préstamos que NO pueden responderse con las queries pre-definidas (balance, pending, all, by_contact). Usa esta función cuando el usuario pida: filtros específicos (montos, fechas custom, múltiples condiciones), agregaciones complejas (promedios, contactos con más préstamos), comparaciones entre períodos, o cualquier consulta que requiera lógica personalizada.',
          parameters: {
            type: 'object',
            properties: {
              question: {
                type: 'string',
                description: 'La pregunta COMPLETA del usuario en lenguaje natural. Incluye todos los detalles necesarios para generar la query correcta.'
              },
              expected_result_type: {
                type: 'string',
                enum: ['single_value', 'list', 'aggregation', 'comparison'],
                description: 'Tipo de resultado esperado: "single_value" (ej: total a pagar), "list" (ej: lista de préstamos), "aggregation" (ej: suma por contacto), "comparison" (ej: este mes vs anterior)'
              }
            },
            required: ['question', 'expected_result_type']
          }
        }
      }
    ];
  }
}
