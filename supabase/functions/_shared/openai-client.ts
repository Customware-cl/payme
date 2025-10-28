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
  private supabase?: any; // SupabaseClient (opcional para logging)
  private tenantId?: string;
  private contactId?: string;

  constructor(
    apiKey: string,
    baseUrl: string = 'https://api.openai.com/v1',
    options?: {
      supabase?: any;
      tenantId?: string;
      contactId?: string;
    }
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.supabase = options?.supabase;
    this.tenantId = options?.tenantId;
    this.contactId = options?.contactId;
  }

  /**
   * Completar chat con GPT-4 (texto o visión)
   */
  async chatCompletion(
    request: ChatCompletionRequest
  ): Promise<{ success: boolean; data?: ChatCompletionResponse; error?: string }> {
    const startTime = Date.now();
    let responsePayload: any = null;
    let errorMessage: string | undefined;

    try {
      const enableDetailedLogs = Deno.env.get('OPENAI_DETAILED_LOGS') === 'true';

      // Logs resumidos (siempre activos)
      console.log('[OpenAI] Chat completion request:', {
        model: request.model,
        messages: request.messages.length,
        has_tools: !!request.tools,
        tool_count: request.tools?.length || 0
      });

      // Logs detallados (opcional - activar con env var)
      if (enableDetailedLogs) {
        console.log('[OpenAI] 📤 FULL REQUEST:', JSON.stringify({
          model: request.model,
          messages: request.messages.map((m, i) => ({
            index: i,
            role: m.role,
            content: typeof m.content === 'string'
              ? m.content.substring(0, 500) + (m.content.length > 500 ? '...' : '')
              : m.content,
            tool_calls: (m as any).tool_calls || undefined
          })),
          tools: request.tools?.map(t => ({
            type: t.type,
            function: {
              name: t.function.name,
              description: t.function.description
            }
          })),
          tool_choice: request.tool_choice,
          temperature: request.temperature,
          max_completion_tokens: request.max_completion_tokens
        }, null, 2));
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      });

      const result = await response.json();
      responsePayload = result;

      if (!response.ok) {
        console.error('[OpenAI] Error response:', result);
        errorMessage = result.error?.message || 'Error calling OpenAI API';

        // Log error en BD
        await this.logOpenAIRequest({
          requestType: 'chat_completion',
          model: request.model,
          requestPayload: request,
          responsePayload: result,
          status: 'error',
          errorMessage,
          responseTimeMs: Date.now() - startTime
        });

        return {
          success: false,
          error: errorMessage
        };
      }

      // Logs resumidos (siempre activos)
      console.log('[OpenAI] Success:', {
        model: result.model,
        tokens: result.usage?.total_tokens,
        finish_reason: result.choices[0]?.finish_reason,
        has_tool_calls: !!result.choices[0]?.message?.tool_calls,
        tool_calls_count: result.choices[0]?.message?.tool_calls?.length || 0
      });

      // Logs detallados (opcional)
      if (enableDetailedLogs) {
        console.log('[OpenAI] 📥 FULL RESPONSE:', JSON.stringify({
          id: result.id,
          model: result.model,
          usage: result.usage,
          choices: result.choices.map((c: any) => ({
            index: c.index,
            finish_reason: c.finish_reason,
            message: {
              role: c.message.role,
              content: c.message.content,
              tool_calls: c.message.tool_calls?.map((tc: any) => ({
                id: tc.id,
                type: tc.type,
                function: {
                  name: tc.function.name,
                  arguments: tc.function.arguments
                }
              }))
            }
          }))
        }, null, 2));
      }

      // Log success en BD
      await this.logOpenAIRequest({
        requestType: 'chat_completion',
        model: request.model,
        requestPayload: request,
        responsePayload: result,
        status: 'success',
        responseTimeMs: Date.now() - startTime
      });

      return {
        success: true,
        data: result
      };

    } catch (error) {
      console.error('[OpenAI] Exception:', error);
      errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Log exception en BD
      await this.logOpenAIRequest({
        requestType: 'chat_completion',
        model: request.model,
        requestPayload: request,
        responsePayload: responsePayload,
        status: 'error',
        errorMessage,
        responseTimeMs: Date.now() - startTime
      });

      return {
        success: false,
        error: errorMessage
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

🎯 ESTILO DE RESPUESTA - CRÍTICO - LEE ESTO PRIMERO:
1. Responde DIRECTAMENTE y CONCISO, como un amigo amigable en WhatsApp
2. USA EMOJIS cuando sea apropiado para hacer las respuestas más cálidas y expresivas
3. FORMATO DE NÚMEROS (Chile): Usa PUNTO para miles y COMA para decimales
   - Correcto: $99.000 | $1.234.567 | $50.000,50
   - Incorrecto: $99,000 | $1,234,567 | $50,000.50
4. NO expliques el proceso técnico, SQL, validaciones, o detalles de implementación
5. Si ejecutaste funciones exitosamente, solo comunica el RESULTADO FINAL
6. Ejemplos CORRECTOS:
   - "¿cuánto le debo a Caty?" → "Le debes $99.000 a Caty 💰"
   - "¿cuánto me debe Caty?" → "Caty te debe $364.888 💵"
   - Préstamo creado → "✅ Listo! Registré el préstamo de $50.000 a Juan"
   - No hay resultados → "No encontré préstamos con ese nombre 🤔"
7. Ejemplo INCORRECTO: "La consulta actual para calcular el total que debes arrojó un valor nulo..."
8. Si hay error, di "No pude procesar eso 😕 ¿Puedes reformular?" SIN detalles técnicos
9. Tono: Amigable, cálido, cercano - como hablarías con un amigo por WhatsApp
10. Tu audiencia son usuarios finales, NO desarrolladores

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
   ⚠️ VERIFICACIÓN OBLIGATORIA DE CONTACTOS:
   - Si el usuario menciona un nombre que NO está en CONTACTOS DISPONIBLES → SIEMPRE usa search_contacts() PRIMERO
   - Si el nombre es similar pero no exacto (ej: "Catita" vs "Caty") → search_contacts() para verificar
   - Si search_contacts() retorna múltiples candidatos → presenta opciones al usuario
   - Si search_contacts() no encuentra nada → ofrece crear el contacto con create_contact()
   - Solo procede con create_loan u otras operaciones DESPUÉS de verificar/resolver el contacto

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

EJEMPLOS DE VERIFICACIÓN DE CONTACTOS:
A. Usuario: "cuánto le debo a Catita" (pero en CONTACTOS DISPONIBLES solo está "Caty")
   → PRIMERO: search_contacts(search_term="Catita")
   → RESULTADO: "🤔 ¿Te refieres a Caty? (similaridad: 83%)"
   → LUEGO: Asume que sí y ejecuta query_loans_dynamic con "Caty"

B. Usuario: "presté 100 lucas a Juanito" (pero no existe "Juanito" en contactos)
   → PRIMERO: search_contacts(search_term="Juanito")
   → RESULTADO: Candidatos: "Juan Pérez (85%)", "Juan Carlos (78%)"
   → RESPUESTA: Muestra candidatos y pregunta a cuál se refiere

C. Usuario: "cuánto me debe Roberto" (no existe ningún Roberto)
   → PRIMERO: search_contacts(search_term="Roberto")
   → RESULTADO: "❌ No encontré ningún contacto con el nombre Roberto"
   → RESPUESTA: "No tengo registrado a Roberto en tus contactos. ¿Quieres que lo agregue?"

RESPUESTAS:
- Sé amable, profesional y conciso en español chileno
- Evita lenguaje técnico innecesario
- Confirma las acciones de forma clara
- Si hay error, di simplemente "No pude completar eso" sin explicar detalles técnicos

ESTRUCTURA DE BASE DE DATOS (para query_loans_dynamic):

Tablas principales:

1. **agreements** (Préstamos)
   - tenant_id: UUID (obligatorio en queries)
   - tenant_contact_id: UUID → Prestatario (borrower - quien RECIBE el préstamo)
   - lender_tenant_contact_id: UUID → Prestamista (lender - quien PRESTA el dinero)
   - amount: NUMERIC → Monto del préstamo
   - due_date: DATE → Fecha de vencimiento
   - status: TEXT → Estados del préstamo:
     * 'active': Activo, sin devolver, no vencido, confirmado
     * 'overdue': Vencido, sin devolver (actualizado automáticamente por función de BD)
     * 'due_soon': Vence en menos de 24 horas (actualizado automáticamente)
     * 'pending_confirmation': Esperando confirmación del borrower
     * 'rejected': Rechazado por borrower (mostrar SOLO si se pregunta específicamente)
     * 'completed': Devuelto/pagado completamente
     * 'returned': Alias de completed
     * 'cancelled': Cancelado por acuerdo mutuo
     * 'paused': Pausado temporalmente
   - borrower_confirmed: BOOLEAN → true (confirmado), false (rechazado), null (pendiente)
   - type: TEXT → 'loan' (préstamos) o 'service' (servicios)
   - created_at: TIMESTAMP
   - completed_at: TIMESTAMP

2. **tenant_contacts** (Contactos del tenant)
   - id: UUID
   - tenant_id: UUID
   - contact_profile_id: UUID → Referencia a contact_profiles
   - name: TEXT → Nombre/alias del contacto en este tenant
   - whatsapp_id: TEXT
   - opt_in_status: TEXT → 'pending', 'opted_in', 'opted_out'

3. **contact_profiles** (Perfiles globales de contactos)
   - id: UUID
   - phone_e164: TEXT → Teléfono en formato internacional
   - first_name: TEXT
   - last_name: TEXT
   - email: TEXT
   - bank_accounts: JSONB → Array de cuentas bancarias

Relaciones clave:
- agreements.tenant_contact_id → tenant_contacts.id (borrower)
- agreements.lender_tenant_contact_id → tenant_contacts.id (lender)
- tenant_contacts.contact_profile_id → contact_profiles.id

Direcciones de préstamo (IMPORTANTE):
- "Yo presté" / "Me deben" → agreements WHERE lender_tenant_contact_id = mi_contact_id
- "Yo recibí" / "Debo" → agreements WHERE tenant_contact_id = mi_contact_id

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
          description: 'Consultar información SIMPLE y GENERAL sobre préstamos. SOLO para resúmenes generales sin dirección específica. ⚠️ NO USAR para preguntas con contactos ("me debe X" vs "le debo a X") - usa query_loans_dynamic para esos casos.',
          parameters: {
            type: 'object',
            properties: {
              query_type: {
                type: 'string',
                enum: ['all', 'pending', 'balance'],
                description: `Tipo de consulta GENERAL (sin contactos específicos):
- "balance": Balance DETALLADO categorizado por vencimiento y confirmación:
  * ME DEBEN (prestado): vencidos, por vencer (24h), sin confirmar, al día + total
  * DEBO (recibido): vencidos, por vencer (24h), al día + total
  * Balance neto (diferencia entre ambos)
  Usar para: "mi balance", "balance general", "cuánto me deben en total", "resumen de préstamos"
- "pending": Lista de vencidos/próximos a vencer SIN filtrar por contacto (ej: "qué está vencido", "alertas generales")
- "all": Lista completa de todos los préstamos activos (ej: "todos mis préstamos")

⚠️ IMPORTANTE: Para preguntas con contactos específicos ("cuánto me debe Caty", "qué le debo a Juan") usa query_loans_dynamic en su lugar.`
              },
              contact_name: {
                type: 'string',
                description: '⛔ DEPRECATED: Ya no usar. Para preguntas con contactos usa query_loans_dynamic.'
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
          description: '🔍 VERIFICACIÓN DE CONTACTOS (USA SIEMPRE ANTES DE create_loan/query_loans_dynamic con nombres). Busca contactos usando fuzzy matching para manejar apodos, variantes y errores de tipeo. Retorna candidatos con nivel de similaridad. OBLIGATORIO usar cuando el usuario menciona un nombre que no está exacto en CONTACTOS DISPONIBLES.',
          parameters: {
            type: 'object',
            properties: {
              search_term: {
                type: 'string',
                description: 'Nombre o apodo del contacto a buscar (ej: "Catita", "Caty", "Catalina")'
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
          description: '✅ USAR PARA: Preguntas con CONTACTOS ESPECÍFICOS (ej: "cuánto me debe Caty", "qué le debo a Juan"), queries con DIRECCIÓN específica ("me debe" vs "le debo"), filtros complejos (montos, fechas, vencimientos), agregaciones (promedios, totales por contacto), o cualquier pregunta que requiera lógica personalizada. Esta función genera SQL dinámico y puede manejar CUALQUIER pregunta sobre préstamos con máxima precisión.',
          parameters: {
            type: 'object',
            properties: {
              question: {
                type: 'string',
                description: 'La pregunta COMPLETA del usuario en lenguaje natural con TODOS los detalles (nombres, montos, fechas, condiciones, etc.). Incluye la pregunta exacta tal cual la hizo el usuario.'
              },
              expected_result_type: {
                type: 'string',
                enum: ['single_value', 'list', 'aggregation', 'comparison'],
                description: 'Tipo de resultado: "single_value" (un total/monto, ej: "cuánto le debo"), "list" (lista de préstamos), "aggregation" (agrupaciones, promedios), "comparison" (comparar períodos/contactos)'
              }
            },
            required: ['question', 'expected_result_type']
          }
        }
      }
    ];
  }

  /**
   * Registrar request de OpenAI en base de datos (opcional)
   * Solo se ejecuta si se pasó supabase client en el constructor
   */
  private async logOpenAIRequest(params: {
    requestType: 'chat_completion' | 'transcription' | 'vision';
    model: string;
    requestPayload: any;
    responsePayload?: any;
    status: 'success' | 'error';
    errorMessage?: string;
    responseTimeMs: number;
  }): Promise<void> {
    // Si no hay supabase client o tenant_id, no logear
    if (!this.supabase || !this.tenantId) {
      return;
    }

    try {
      // Extraer información de tokens y tool calls del response
      const usage = params.responsePayload?.usage;
      const choice = params.responsePayload?.choices?.[0];
      const toolCalls = choice?.message?.tool_calls;

      const logEntry = {
        tenant_id: this.tenantId,
        contact_id: this.contactId || null,
        model: params.model,
        request_type: params.requestType,
        request_payload: params.requestPayload,
        response_payload: params.responsePayload || null,
        status: params.status,
        error_message: params.errorMessage || null,
        prompt_tokens: usage?.prompt_tokens || null,
        completion_tokens: usage?.completion_tokens || null,
        total_tokens: usage?.total_tokens || null,
        cached_tokens: usage?.prompt_tokens_details?.cached_tokens || null,
        tool_calls_count: toolCalls?.length || 0,
        tool_calls: toolCalls || null,
        finish_reason: choice?.finish_reason || null,
        response_time_ms: params.responseTimeMs
      };

      const { error } = await this.supabase
        .from('openai_requests_log')
        .insert(logEntry);

      if (error) {
        console.error('[OpenAI] Error logging request:', error);
      }
    } catch (error) {
      // No queremos que errores en logging bloqueen la ejecución
      console.error('[OpenAI] Exception logging request:', error);
    }
  }
}
