/**
 * AI Agent Edge Function
 * Orquestador principal de IA para WhatsApp Bot
 *
 * Procesa mensajes de texto, audio e imágenes usando OpenAI
 * Mantiene contexto conversacional completo
 * Ejecuta acciones según intenciones detectadas
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { corsHeaders } from '../_shared/cors.ts';
import { OpenAIClient, OpenAIMessage } from '../_shared/openai-client.ts';
import { ConversationMemory, getUserContext } from '../_shared/conversation-memory.ts';
import { findContactByName, getAllContacts, formatMatchResults } from '../_shared/contact-fuzzy-search.ts';

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY no configurada');
    }

    // Inicializar clientes
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const openai = new OpenAIClient(openaiApiKey);
    const memory = new ConversationMemory(supabase);

    // Parsear request
    const {
      tenant_id,
      contact_id,
      message,
      message_type = 'text', // text, audio_transcription, image_analysis
      metadata = {}
    } = await req.json();

    console.log('[AI-Agent] Request:', {
      tenant_id,
      contact_id,
      message_type,
      message_length: message?.length || 0
    });

    // Validación
    if (!tenant_id || !contact_id || !message) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: tenant_id, contact_id, message'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obtener contexto del usuario
    const contextResult = await getUserContext(supabase, tenant_id, contact_id);
    if (!contextResult.success || !contextResult.context) {
      throw new Error('Error obteniendo contexto del usuario');
    }

    const userContext = contextResult.context;

    // Obtener lista de contactos para búsqueda inteligente
    const contactsResult = await getAllContacts(supabase, tenant_id);
    const contactsList = contactsResult.success && contactsResult.contacts
      ? contactsResult.contacts
      : [];

    // Guardar mensaje del usuario en historial
    await memory.saveMessage(
      tenant_id,
      contact_id,
      'user',
      message,
      {
        type: message_type,
        ...metadata
      }
    );

    // Obtener historial de conversación
    const historyResult = await memory.getHistoryForOpenAI(tenant_id, contact_id, 20);
    if (!historyResult.success || !historyResult.messages) {
      throw new Error('Error obteniendo historial de conversación');
    }

    const conversationHistory = historyResult.messages;

    // Crear mensaje de sistema con contexto
    const systemMessage = OpenAIClient.createSystemMessage(
      'PayME', // Nombre del tenant (puedes obtenerlo de BD si lo prefieres)
      userContext.contactName,
      [
        'Crear préstamo otorgado (presté dinero)',
        'Crear préstamo recibido (me prestaron)',
        'Consultar estado de préstamos',
        'Marcar préstamo como devuelto/pagado',
        'Reprogramar fecha de devolución',
        'Ver saldo total (quién me debe, a quién debo)',
        'Gestionar contactos'
      ]
    );

    // Agregar información de contactos disponibles al contexto
    const contactsContext = contactsList.length > 0
      ? `\n\nCONTACTOS DISPONIBLES (para búsqueda inteligente):\n${contactsList.map(c => `- ${c.name} (${c.phone_e164})`).join('\n')}`
      : '';

    systemMessage.content += contactsContext;

    // Agregar resumen del usuario
    systemMessage.content += `\n\nRESUMEN DEL USUARIO:
- Préstamos totales: ${userContext.totalLoans}
- Préstamos activos: ${userContext.activeLoans}
- Total prestado: $${userContext.totalLent.toLocaleString('es-CL')}
- Total recibido: $${userContext.totalBorrowed.toLocaleString('es-CL')}`;

    // Construir mensajes para OpenAI
    const messages: OpenAIMessage[] = [
      systemMessage,
      ...conversationHistory,
      {
        role: 'user',
        content: message
      }
    ];

    // Obtener herramientas (functions)
    const tools = OpenAIClient.createTools();

    // Llamar a OpenAI con function calling
    const completionResult = await openai.chatCompletion({
      model: 'gpt-5-nano', // gpt-5-nano es 12x más barato que gpt-4o-mini
      messages,
      tools,
      tool_choice: 'auto',
      // temperature: 0.7, // GPT-5 nano solo acepta temperature=1 (default)
      max_completion_tokens: 1000, // GPT-5 usa max_completion_tokens
      verbosity: 'medium', // GPT-5: respuestas balanceadas (no muy largas ni muy cortas)
      reasoning_effort: 'low' // GPT-5: razonamiento ligero para respuestas rápidas
    });

    if (!completionResult.success || !completionResult.data) {
      throw new Error(completionResult.error || 'Error en OpenAI completion');
    }

    const response = completionResult.data;
    const choice = response.choices[0];
    const assistantMessage = choice.message;

    // Verificar si hay tool calls
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      console.log('[AI-Agent] Tool calls detected:', assistantMessage.tool_calls.length);

      // Procesar cada tool call
      const toolResults = [];

      for (const toolCall of assistantMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        console.log('[AI-Agent] Executing function:', functionName, functionArgs);

        // Ejecutar la función correspondiente
        const result = await executeFunction(
          supabase,
          tenant_id,
          contact_id,
          functionName,
          functionArgs
        );

        toolResults.push({
          tool_call_id: toolCall.id,
          function_name: functionName,
          result
        });
      }

      // Guardar respuesta del asistente con tool calls
      await memory.saveMessage(
        tenant_id,
        contact_id,
        'assistant',
        assistantMessage.content || '',
        {
          tool_calls: assistantMessage.tool_calls,
          tool_results: toolResults
        }
      );

      // Construir mensaje de respuesta
      // Si el asistente no generó texto, usar el mensaje del primer tool result
      let responseMessage = assistantMessage.content || '';

      if (!responseMessage && toolResults.length > 0) {
        const firstMessageResult = toolResults.find(r => r.result.message);
        if (firstMessageResult) {
          responseMessage = firstMessageResult.result.message;
        }
      }

      // Retornar resultado con acciones ejecutadas
      return new Response(
        JSON.stringify({
          success: true,
          response: responseMessage || 'Procesando...',
          actions: toolResults,
          needs_confirmation: toolResults.some(r => r.result.needs_confirmation),
          tokens_used: response.usage.total_tokens
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sin tool calls, solo respuesta de texto
    const responseText = assistantMessage.content || '';

    // Guardar respuesta del asistente
    await memory.saveMessage(
      tenant_id,
      contact_id,
      'assistant',
      responseText
    );

    return new Response(
      JSON.stringify({
        success: true,
        response: responseText,
        actions: [],
        tokens_used: response.usage.total_tokens
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[AI-Agent] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Ejecutar función según el nombre
 */
async function executeFunction(
  supabase: any,
  tenantId: string,
  contactId: string,
  functionName: string,
  args: any
): Promise<any> {
  console.log('[AI-Agent] Executing function:', functionName, args);

  switch (functionName) {
    case 'create_loan':
      return await createLoan(supabase, tenantId, contactId, args);

    case 'query_loans':
      return await queryLoans(supabase, tenantId, contactId, args);

    case 'mark_loan_returned':
      return await markLoanReturned(supabase, tenantId, contactId, args);

    case 'reschedule_loan':
      return await rescheduleLoan(supabase, tenantId, contactId, args);

    case 'search_contacts':
      return await searchContacts(supabase, tenantId, args);

    case 'show_uncertainty':
      return await logUncertainty(supabase, tenantId, contactId, args);

    default:
      return {
        success: false,
        error: `Función desconocida: ${functionName}`
      };
  }
}

/**
 * Crear préstamo
 */
async function createLoan(
  supabase: any,
  tenantId: string,
  contactId: string,
  args: {
    loan_type: 'lent' | 'borrowed';
    contact_name: string;
    amount: number;
    due_date: string;
    notes?: string;
  }
) {
  // Buscar contacto
  const contactResult = await findContactByName(supabase, tenantId, args.contact_name, 0.6);

  if (!contactResult.success) {
    return {
      success: false,
      error: contactResult.error,
      needs_confirmation: false
    };
  }

  const matches = contactResult.matches || [];

  // Sin coincidencias
  if (matches.length === 0) {
    return {
      success: false,
      message: `No encontré ningún contacto con el nombre "${args.contact_name}". ¿Quieres que lo cree?`,
      needs_confirmation: true,
      action: 'create_contact',
      data: { name: args.contact_name }
    };
  }

  // Múltiples coincidencias
  if (matches.length > 1 && matches[0].similarity < 0.95) {
    return {
      success: false,
      message: formatMatchResults(matches),
      needs_confirmation: true,
      action: 'select_contact',
      data: { matches, original_args: args }
    };
  }

  // Coincidencia única o muy alta
  const targetContact = matches[0];

  // IMPORTANTE: Siempre pedir confirmación para creaciones
  return {
    success: true,
    message: `¿Confirmas crear préstamo ${args.loan_type === 'lent' ? 'otorgado a' : 'recibido de'} ${targetContact.name} por $${args.amount.toLocaleString('es-CL')} con vencimiento ${args.due_date}?`,
    needs_confirmation: true,
    action: 'confirm_create_loan',
    data: {
      loan_type: args.loan_type,
      contact_id: targetContact.id,
      contact_name: targetContact.name,
      amount: args.amount,
      due_date: args.due_date,
      notes: args.notes
    }
  };
}

/**
 * Consultar préstamos
 */
async function queryLoans(
  supabase: any,
  tenantId: string,
  contactId: string,
  args: {
    query_type: 'all' | 'pending' | 'by_contact' | 'balance';
    contact_name?: string;
  }
) {
  // TODO: Implementar consultas a la BD
  // Por ahora retornar placeholder
  return {
    success: true,
    message: `Consultando ${args.query_type}...`,
    needs_confirmation: false,
    data: {}
  };
}

/**
 * Marcar préstamo como devuelto
 */
async function markLoanReturned(
  supabase: any,
  tenantId: string,
  contactId: string,
  args: {
    contact_name: string;
  }
) {
  // Buscar contacto y préstamo activo
  // Pedir confirmación
  return {
    success: true,
    message: `¿Confirmas marcar como devuelto el préstamo de ${args.contact_name}?`,
    needs_confirmation: true,
    action: 'confirm_mark_returned',
    data: args
  };
}

/**
 * Reprogramar préstamo
 */
async function rescheduleLoan(
  supabase: any,
  tenantId: string,
  contactId: string,
  args: {
    contact_name: string;
    new_due_date: string;
  }
) {
  return {
    success: true,
    message: `¿Confirmas reprogramar el préstamo de ${args.contact_name} para ${args.new_due_date}?`,
    needs_confirmation: true,
    action: 'confirm_reschedule',
    data: args
  };
}

/**
 * Buscar contactos
 */
async function searchContacts(
  supabase: any,
  tenantId: string,
  args: {
    search_term: string;
  }
) {
  const result = await findContactByName(supabase, tenantId, args.search_term, 0.5);

  if (!result.success) {
    return {
      success: false,
      error: result.error
    };
  }

  return {
    success: true,
    message: formatMatchResults(result.matches || []),
    needs_confirmation: false,
    data: { matches: result.matches }
  };
}

/**
 * Registrar caso de incertidumbre
 */
async function logUncertainty(
  supabase: any,
  tenantId: string,
  contactId: string,
  args: {
    possible_intents: string[];
    confidence_scores?: any;
    clarification_question: string;
  }
) {
  // Registrar en BD para analytics
  await supabase.from('ai_uncertainty_log').insert({
    tenant_id: tenantId,
    contact_id: contactId,
    user_message: '', // Se puede obtener del historial
    detected_intents: args.possible_intents,
    confidence_scores: args.confidence_scores || {},
    chosen_action: null
  });

  return {
    success: true,
    message: args.clarification_question,
    needs_confirmation: true,
    action: 'clarify_intent',
    data: { possible_intents: args.possible_intents }
  };
}
