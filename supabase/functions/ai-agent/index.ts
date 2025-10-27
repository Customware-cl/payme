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
import { checkFunctionPermission, checkRateLimit, RiskLevel } from '../_shared/ai-permissions.ts';
import { getSchemaForAI } from '../_shared/schema-provider.ts';
import { validateSQLSyntax, sanitizeSQLForLogging } from '../_shared/sql-parser-validator.ts';
import { validateSQLWithLLM } from '../_shared/sql-llm-validator.ts';
import { generateSQL } from '../_shared/sql-generator.ts';

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

    // Parsear request
    const {
      tenant_id,
      contact_id,
      message,
      message_type = 'text', // text, audio_transcription, image_analysis
      metadata = {}
    } = await req.json();

    // Inicializar clientes
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const openai = new OpenAIClient(openaiApiKey, 'https://api.openai.com/v1', {
      supabase,
      tenantId: tenant_id,
      contactId: contact_id
    });
    const memory = new ConversationMemory(supabase);

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

    // Obtener historial de conversación (reducido para evitar timeouts)
    const historyResult = await memory.getHistoryForOpenAI(tenant_id, contact_id, 5);
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
          openai,
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
 * Incluye validaciones de permisos, rate limiting y auditoría
 */
async function executeFunction(
  supabase: any,
  openai: OpenAIClient,
  tenantId: string,
  contactId: string,
  functionName: string,
  args: any
): Promise<any> {
  const startTime = Date.now();

  console.log('[AI-Agent] Executing function:', functionName, args);

  // 1. Verificar permisos de la función
  const permissionCheck = checkFunctionPermission(functionName, args);

  if (!permissionCheck.allowed) {
    console.error('[AI-Agent] Permission denied:', permissionCheck.reason);

    // Registrar intento bloqueado en audit
    await logAuditAction(supabase, {
      tenant_id: tenantId,
      contact_id: contactId,
      function_name: functionName,
      arguments: args,
      result: {},
      status: 'error',
      error_message: permissionCheck.reason,
      risk_level: permissionCheck.riskLevel,
      required_confirmation: permissionCheck.requiresConfirmation,
      execution_time_ms: Date.now() - startTime
    });

    return {
      success: false,
      error: permissionCheck.reason,
      needs_confirmation: false
    };
  }

  // 2. Verificar rate limiting
  const rateLimitCheck = await checkRateLimit(supabase, tenantId, contactId, functionName);

  if (!rateLimitCheck.allowed) {
    console.warn('[AI-Agent] Rate limit exceeded:', rateLimitCheck.reason);

    // Registrar rate limit en audit
    await logAuditAction(supabase, {
      tenant_id: tenantId,
      contact_id: contactId,
      function_name: functionName,
      arguments: args,
      result: {},
      status: 'error',
      error_message: rateLimitCheck.reason,
      risk_level: permissionCheck.riskLevel,
      required_confirmation: permissionCheck.requiresConfirmation,
      execution_time_ms: Date.now() - startTime,
      metadata: {
        rate_limit_count: rateLimitCheck.count,
        rate_limit_max: rateLimitCheck.limit
      }
    });

    return {
      success: false,
      error: `⚠️ ${rateLimitCheck.reason}. Por favor intenta más tarde.`,
      needs_confirmation: false
    };
  }

  // 3. Ejecutar la función
  let result;
  let executionError;

  try {
    switch (functionName) {
      case 'create_loan':
        result = await createLoan(supabase, tenantId, contactId, args);
        break;

      case 'query_loans':
        result = await queryLoans(supabase, tenantId, contactId, args);
        break;

      case 'mark_loan_returned':
        result = await markLoanReturned(supabase, tenantId, contactId, args);
        break;

      case 'reschedule_loan':
        result = await rescheduleLoan(supabase, tenantId, contactId, args);
        break;

      case 'search_contacts':
        result = await searchContacts(supabase, tenantId, args);
        break;

      case 'create_contact':
        result = await createContact(supabase, tenantId, contactId, args);
        break;

      case 'update_contact':
        result = await updateContact(supabase, tenantId, contactId, args);
        break;

      case 'query_loans_dynamic':
        result = await executeGeneratedSQL(supabase, openai, tenantId, contactId, args);
        break;

      case 'show_uncertainty':
        result = await logUncertainty(supabase, tenantId, contactId, args);
        break;

      default:
        result = {
          success: false,
          error: `Función desconocida: ${functionName}`
        };
    }
  } catch (error) {
    console.error('[AI-Agent] Function execution error:', error);
    executionError = error instanceof Error ? error.message : 'Error desconocido';
    result = {
      success: false,
      error: executionError
    };
  }

  // 4. Registrar en audit log
  await logAuditAction(supabase, {
    tenant_id: tenantId,
    contact_id: contactId,
    function_name: functionName,
    arguments: args,
    result: result,
    status: result.success ? (result.needs_confirmation ? 'pending_confirmation' : 'success') : 'error',
    error_message: executionError || (result as any).error || (result as any).message,
    risk_level: permissionCheck.riskLevel,
    required_confirmation: permissionCheck.requiresConfirmation,
    was_confirmed: result.needs_confirmation ? null : true,
    execution_time_ms: Date.now() - startTime
  });

  return result;
}

/**
 * Registrar acción en la tabla de auditoría
 */
async function logAuditAction(supabase: any, data: {
  tenant_id: string;
  contact_id: string;
  function_name: string;
  arguments: any;
  result: any;
  status: string;
  error_message?: string;
  risk_level: RiskLevel;
  required_confirmation: boolean;
  was_confirmed?: boolean | null;
  execution_time_ms: number;
  tokens_used?: number;
  metadata?: any;
}) {
  try {
    // Resolver contact_id legacy a tenant_contact_id (mismo patrón que ConversationMemory)
    let resolvedContactId = data.contact_id;

    // Intentar buscar en tenant_contacts
    const { data: tenantContact, error: tcError } = await supabase
      .from('tenant_contacts')
      .select('id')
      .eq('id', data.contact_id)
      .single();

    if (tcError || !tenantContact) {
      // No encontrado en tenant_contacts, buscar en legacy contacts
      console.log('[AI-Agent] Audit - Contact not in tenant_contacts, checking legacy:', data.contact_id);

      const { data: legacyContact, error: lcError } = await supabase
        .from('contacts')
        .select('tenant_contact_id')
        .eq('id', data.contact_id)
        .single();

      if (!lcError && legacyContact?.tenant_contact_id) {
        resolvedContactId = legacyContact.tenant_contact_id;
        console.log('[AI-Agent] Audit - Resolved legacy contact to tenant_contact:', resolvedContactId);
      } else {
        console.warn('[AI-Agent] Audit - Could not resolve contact ID, audit may fail:', data.contact_id);
      }
    }

    const { error } = await supabase
      .from('ai_actions_audit')
      .insert({
        tenant_id: data.tenant_id,
        contact_id: resolvedContactId, // Usar ID resuelto
        function_name: data.function_name,
        arguments: data.arguments,
        result: data.result,
        status: data.status,
        error_message: data.error_message,
        risk_level: data.risk_level,
        required_confirmation: data.required_confirmation,
        was_confirmed: data.was_confirmed,
        execution_time_ms: data.execution_time_ms,
        tokens_used: data.tokens_used,
        metadata: data.metadata || {}
      });

    if (error) {
      console.error('[AI-Agent] Error logging audit action:', error);
    }
  } catch (error) {
    // No queremos que errores en auditoría bloqueen la ejecución
    console.error('[AI-Agent] Exception logging audit:', error);
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

  // Formatear fecha a DD/MM/YYYY (formato chileno)
  const [year, month, day] = args.due_date.split('-');
  const formattedDate = `${day}/${month}/${year}`;

  // IMPORTANTE: Siempre pedir confirmación para creaciones
  return {
    success: true,
    message: `¿Confirmas crear préstamo ${args.loan_type === 'lent' ? 'otorgado a' : 'recibido de'} ${targetContact.name} por $${args.amount.toLocaleString('es-CL')} con vencimiento ${formattedDate}?`,
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
  console.log('[queryLoans] Called with:', { query_type: args.query_type, contact_name: args.contact_name });

  try {
    // Resolver contactId a tenant_contact_id (soporte legacy)
    const { data: resolvedContact } = await supabase
      .from('tenant_contacts')
      .select('id')
      .eq('id', contactId)
      .single();

    let userTenantContactId = contactId;

    if (!resolvedContact) {
      // Buscar en legacy contacts
      const { data: legacyContact } = await supabase
        .from('contacts')
        .select('tenant_contact_id')
        .eq('id', contactId)
        .single();

      if (legacyContact?.tenant_contact_id) {
        userTenantContactId = legacyContact.tenant_contact_id;
      }
    }

    // Ejecutar query según tipo
    switch (args.query_type) {
      case 'balance':
        return await queryLoansBalance(supabase, tenantId, userTenantContactId);

      case 'pending':
        return await queryLoansPending(supabase, tenantId, userTenantContactId);

      case 'all':
        return await queryLoansAll(supabase, tenantId, userTenantContactId);

      case 'by_contact':
        if (!args.contact_name) {
          return {
            success: false,
            error: 'Debes especificar el nombre del contacto',
            needs_confirmation: false
          };
        }
        return await queryLoansByContact(supabase, tenantId, userTenantContactId, args.contact_name);

      default:
        return {
          success: false,
          error: `Tipo de consulta desconocido: ${args.query_type}`,
          needs_confirmation: false
        };
    }

  } catch (error) {
    console.error('[queryLoans] Error:', error);
    return {
      success: false,
      error: 'Error consultando préstamos',
      needs_confirmation: false
    };
  }
}

/**
 * Query tipo 'balance': Resumen de totales prestados vs recibidos
 */
async function queryLoansBalance(
  supabase: any,
  tenantId: string,
  userTenantContactId: string
) {
  // Préstamos otorgados (soy lender)
  const { data: lentLoans, error: lentError } = await supabase
    .from('agreements')
    .select('amount')
    .eq('tenant_id', tenantId)
    .eq('type', 'loan')
    .eq('status', 'active')
    .eq('lender_tenant_contact_id', userTenantContactId);

  // Préstamos recibidos (soy borrower)
  const { data: borrowedLoans, error: borrowedError } = await supabase
    .from('agreements')
    .select('amount')
    .eq('tenant_id', tenantId)
    .eq('type', 'loan')
    .eq('status', 'active')
    .eq('tenant_contact_id', userTenantContactId);

  if (lentError || borrowedError) {
    console.error('[queryLoansBalance] Error:', { lentError, borrowedError });
    return {
      success: false,
      error: 'Error consultando balance',
      needs_confirmation: false
    };
  }

  // Calcular totales
  const totalLent = (lentLoans || []).reduce((sum, loan) => sum + Number(loan.amount), 0);
  const totalBorrowed = (borrowedLoans || []).reduce((sum, loan) => sum + Number(loan.amount), 0);
  const netBalance = totalLent - totalBorrowed;

  // Formatear respuesta
  let message = '💰 *Resumen de préstamos activos*\n\n';
  message += `📤 Prestado (me deben): $${totalLent.toLocaleString('es-CL')}\n`;
  message += `📥 Recibido (debo): $${totalBorrowed.toLocaleString('es-CL')}\n\n`;

  if (netBalance > 0) {
    message += `✅ Balance neto: +$${netBalance.toLocaleString('es-CL')} a tu favor`;
  } else if (netBalance < 0) {
    message += `⚠️ Balance neto: -$${Math.abs(netBalance).toLocaleString('es-CL')} en tu contra`;
  } else {
    message += `⚖️ Balance neto: $0 (equilibrado)`;
  }

  return {
    success: true,
    message,
    needs_confirmation: false,
    data: {
      total_lent: totalLent,
      total_borrowed: totalBorrowed,
      net_balance: netBalance,
      lent_count: lentLoans?.length || 0,
      borrowed_count: borrowedLoans?.length || 0
    }
  };
}

/**
 * Query tipo 'pending': Préstamos vencidos o próximos a vencer
 */
async function queryLoansPending(
  supabase: any,
  tenantId: string,
  userTenantContactId: string
) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Préstamos activos con vencimiento próximo o pasado
  const { data: loans, error } = await supabase
    .from('agreements')
    .select(`
      id,
      amount,
      due_date,
      tenant_contact_id,
      lender_tenant_contact_id
    `)
    .eq('tenant_id', tenantId)
    .eq('type', 'loan')
    .eq('status', 'active')
    .lte('due_date', in7Days)
    .or(`lender_tenant_contact_id.eq.${userTenantContactId},tenant_contact_id.eq.${userTenantContactId}`)
    .order('due_date', { ascending: true });

  if (error) {
    console.error('[queryLoansPending] Error:', error);
    return {
      success: false,
      error: 'Error consultando préstamos pendientes',
      needs_confirmation: false
    };
  }

  if (!loans || loans.length === 0) {
    return {
      success: true,
      message: '✅ No tienes préstamos vencidos ni próximos a vencer en los próximos 7 días.',
      needs_confirmation: false,
      data: { loans: [] }
    };
  }

  // Categorizar préstamos
  const overdue = [];
  const upcoming = [];

  for (const loan of loans) {
    const isLender = loan.lender_tenant_contact_id === userTenantContactId;
    const dueDate = new Date(loan.due_date);
    const isOverdue = loan.due_date < today;

    const loanInfo = {
      id: loan.id,
      amount: Number(loan.amount),
      due_date: dueDate.toLocaleDateString('es-CL'),
      direction: isLender ? 'prestado' : 'recibido',
      days_until: Math.floor((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    };

    if (isOverdue) {
      overdue.push(loanInfo);
    } else {
      upcoming.push(loanInfo);
    }
  }

  // Formatear mensaje
  let message = '';

  if (overdue.length > 0) {
    message += '🔴 *PRÉSTAMOS VENCIDOS*\n\n';
    overdue.forEach((loan, idx) => {
      const daysPast = Math.abs(loan.days_until);
      message += `${idx + 1}. ${loan.direction === 'prestado' ? 'Te deben' : 'Debes'}: $${loan.amount.toLocaleString('es-CL')}\n`;
      message += `   Vencido hace ${daysPast} día${daysPast > 1 ? 's' : ''} (${loan.due_date})\n\n`;
    });
  }

  if (upcoming.length > 0) {
    message += '⚠️ *PRÓXIMOS A VENCER (7 días)*\n\n';
    upcoming.forEach((loan, idx) => {
      message += `${idx + 1}. ${loan.direction === 'prestado' ? 'Te deben' : 'Debes'}: $${loan.amount.toLocaleString('es-CL')}\n`;
      message += `   Vence en ${loan.days_until} día${loan.days_until > 1 ? 's' : ''} (${loan.due_date})\n\n`;
    });
  }

  return {
    success: true,
    message: message.trim(),
    needs_confirmation: false,
    data: {
      overdue,
      upcoming,
      total_overdue: overdue.length,
      total_upcoming: upcoming.length
    }
  };
}

/**
 * Query tipo 'all': Todos los préstamos activos
 */
async function queryLoansAll(
  supabase: any,
  tenantId: string,
  userTenantContactId: string
) {
  // Préstamos otorgados (soy lender)
  const { data: lentLoans, error: lentError } = await supabase
    .from('agreements')
    .select('id, amount, due_date')
    .eq('tenant_id', tenantId)
    .eq('type', 'loan')
    .eq('status', 'active')
    .eq('lender_tenant_contact_id', userTenantContactId)
    .order('due_date', { ascending: true });

  // Préstamos recibidos (soy borrower)
  const { data: borrowedLoans, error: borrowedError } = await supabase
    .from('agreements')
    .select('id, amount, due_date')
    .eq('tenant_id', tenantId)
    .eq('type', 'loan')
    .eq('status', 'active')
    .eq('tenant_contact_id', userTenantContactId)
    .order('due_date', { ascending: true });

  if (lentError || borrowedError) {
    console.error('[queryLoansAll] Error:', { lentError, borrowedError });
    return {
      success: false,
      error: 'Error consultando préstamos',
      needs_confirmation: false
    };
  }

  const lent = lentLoans || [];
  const borrowed = borrowedLoans || [];

  if (lent.length === 0 && borrowed.length === 0) {
    return {
      success: true,
      message: '📭 No tienes préstamos activos en este momento.',
      needs_confirmation: false,
      data: { lent: [], borrowed: [] }
    };
  }

  let message = '📋 *Todos tus préstamos activos*\n\n';

  if (lent.length > 0) {
    message += '💸 *PRESTADO (te deben)*\n\n';
    lent.forEach((loan, idx) => {
      const dueDate = loan.due_date ? new Date(loan.due_date).toLocaleDateString('es-CL') : 'Sin fecha';
      message += `${idx + 1}. $${Number(loan.amount).toLocaleString('es-CL')} - Vence: ${dueDate}\n`;
    });
    const totalLent = lent.reduce((sum, loan) => sum + Number(loan.amount), 0);
    message += `\nTotal prestado: $${totalLent.toLocaleString('es-CL')}\n\n`;
  }

  if (borrowed.length > 0) {
    message += '💰 *RECIBIDO (debes)*\n\n';
    borrowed.forEach((loan, idx) => {
      const dueDate = loan.due_date ? new Date(loan.due_date).toLocaleDateString('es-CL') : 'Sin fecha';
      message += `${idx + 1}. $${Number(loan.amount).toLocaleString('es-CL')} - Vence: ${dueDate}\n`;
    });
    const totalBorrowed = borrowed.reduce((sum, loan) => sum + Number(loan.amount), 0);
    message += `\nTotal recibido: $${totalBorrowed.toLocaleString('es-CL')}`;
  }

  return {
    success: true,
    message: message.trim(),
    needs_confirmation: false,
    data: {
      lent,
      borrowed,
      lent_count: lent.length,
      borrowed_count: borrowed.length
    }
  };
}

/**
 * Query tipo 'by_contact': Préstamos con un contacto específico
 */
async function queryLoansByContact(
  supabase: any,
  tenantId: string,
  userTenantContactId: string,
  contactName: string
) {
  // 1. Buscar contacto por nombre
  const contactResult = await findContactByName(supabase, tenantId, contactName, 0.6);

  if (!contactResult.success) {
    return {
      success: false,
      error: contactResult.error,
      needs_confirmation: false
    };
  }

  const matches = contactResult.matches || [];

  if (matches.length === 0) {
    return {
      success: true,
      message: `No encontré ningún contacto con el nombre "${contactName}".`,
      needs_confirmation: false,
      data: { loans: [] }
    };
  }

  // Si hay múltiples coincidencias, avisar
  if (matches.length > 1 && matches[0].similarity < 0.95) {
    return {
      success: false,
      message: formatMatchResults(matches),
      needs_confirmation: true,
      action: 'select_contact_for_query',
      data: { matches, original_query: 'by_contact' }
    };
  }

  const targetContact = matches[0];
  const targetContactId = targetContact.id;

  // 2. Obtener préstamos entre usuario y contacto (evitar JOINs complejos)
  // Préstamos donde yo presté al contacto
  const { data: lentToContact, error: lentError } = await supabase
    .from('agreements')
    .select('id, amount, due_date, status')
    .eq('tenant_id', tenantId)
    .eq('type', 'loan')
    .eq('status', 'active')
    .eq('lender_tenant_contact_id', userTenantContactId)
    .eq('tenant_contact_id', targetContactId)
    .order('due_date', { ascending: true });

  // Préstamos donde el contacto me prestó
  const { data: borrowedFromContact, error: borrowedError } = await supabase
    .from('agreements')
    .select('id, amount, due_date, status')
    .eq('tenant_id', tenantId)
    .eq('type', 'loan')
    .eq('status', 'active')
    .eq('lender_tenant_contact_id', targetContactId)
    .eq('tenant_contact_id', userTenantContactId)
    .order('due_date', { ascending: true });

  if (lentError || borrowedError) {
    console.error('[queryLoansByContact] Error:', { lentError, borrowedError });
    return {
      success: false,
      error: 'Error consultando préstamos con el contacto',
      needs_confirmation: false
    };
  }

  const lent = lentToContact || [];
  const borrowed = borrowedFromContact || [];

  if (lent.length === 0 && borrowed.length === 0) {
    return {
      success: true,
      message: `No tienes préstamos activos con ${targetContact.name}.`,
      needs_confirmation: false,
      data: { contact: targetContact, lent: [], borrowed: [] }
    };
  }

  // 3. Calcular totales
  const totalLent = lent.reduce((sum, loan) => sum + Number(loan.amount), 0);
  const totalBorrowed = borrowed.reduce((sum, loan) => sum + Number(loan.amount), 0);
  const netBalance = totalLent - totalBorrowed;

  // 4. Formatear mensaje
  let message = `💼 *Préstamos con ${targetContact.name}*\n\n`;

  if (lent.length > 0) {
    message += `📤 *LE PRESTASTE (te debe)*\n\n`;
    lent.forEach((loan, idx) => {
      const dueDate = loan.due_date ? new Date(loan.due_date).toLocaleDateString('es-CL') : 'Sin fecha';
      message += `${idx + 1}. $${Number(loan.amount).toLocaleString('es-CL')} - Vence: ${dueDate}\n`;
    });
    message += `\nSubtotal: $${totalLent.toLocaleString('es-CL')}\n\n`;
  }

  if (borrowed.length > 0) {
    message += `📥 *TE PRESTÓ (le debes)*\n\n`;
    borrowed.forEach((loan, idx) => {
      const dueDate = loan.due_date ? new Date(loan.due_date).toLocaleDateString('es-CL') : 'Sin fecha';
      message += `${idx + 1}. $${Number(loan.amount).toLocaleString('es-CL')} - Vence: ${dueDate}\n`;
    });
    message += `\nSubtotal: $${totalBorrowed.toLocaleString('es-CL')}\n\n`;
  }

  // Balance neto
  message += '━━━━━━━━━━━━━━━━\n';
  if (netBalance > 0) {
    message += `✅ ${targetContact.name} te debe: $${netBalance.toLocaleString('es-CL')}`;
  } else if (netBalance < 0) {
    message += `⚠️ Le debes a ${targetContact.name}: $${Math.abs(netBalance).toLocaleString('es-CL')}`;
  } else {
    message += `⚖️ Están a mano ($0)`;
  }

  return {
    success: true,
    message,
    needs_confirmation: false,
    data: {
      contact: targetContact,
      lent,
      borrowed,
      total_lent: totalLent,
      total_borrowed: totalBorrowed,
      net_balance: netBalance
    }
  };
}

/**

/**

/**

/**

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
  try {
    // Resolver contactId a tenant_contact_id
    const { data: resolvedContact } = await supabase
      .from('tenant_contacts')
      .select('id')
      .eq('id', contactId)
      .single();

    let userTenantContactId = contactId;

    if (!resolvedContact) {
      // Buscar en legacy contacts
      const { data: legacyContact } = await supabase
        .from('contacts')
        .select('tenant_contact_id')
        .eq('id', contactId)
        .single();

      if (legacyContact?.tenant_contact_id) {
        userTenantContactId = legacyContact.tenant_contact_id;
      }
    }

    // Buscar contacto
    const contactResult = await findContactByName(supabase, tenantId, args.contact_name, 0.6);

    if (!contactResult.success || !contactResult.matches || contactResult.matches.length === 0) {
      return {
        success: false,
        message: `No encontré ningún contacto con el nombre "${args.contact_name}".`,
        needs_confirmation: false
      };
    }

    const targetContact = contactResult.matches[0];
    const targetTenantContactId = targetContact.id;

    // Buscar préstamo activo con este contacto
    const { data: loans, error } = await supabase
      .from('agreements')
      .select(`
        id,
        amount,
        due_date,
        tenant_contact_id,
        lender_tenant_contact_id,
        borrower:tenant_contacts!tenant_contact_id(id, name),
        lender:tenant_contacts!lender_tenant_contact_id(id, name)
      `)
      .eq('tenant_id', tenantId)
      .eq('type', 'loan')
      .eq('status', 'active')
      .or(`and(tenant_contact_id.eq.${targetTenantContactId},lender_tenant_contact_id.eq.${userTenantContactId}),and(tenant_contact_id.eq.${userTenantContactId},lender_tenant_contact_id.eq.${targetTenantContactId})`)
      .limit(5);

    if (error) {
      console.error('[markLoanReturned] Error:', error);
      return {
        success: false,
        error: 'Error buscando préstamo',
        needs_confirmation: false
      };
    }

    if (!loans || loans.length === 0) {
      return {
        success: false,
        message: `No encontré préstamos activos con ${targetContact.name}.`,
        needs_confirmation: false
      };
    }

    // Si hay múltiples préstamos, avisar
    if (loans.length > 1) {
      const loansList = loans.map((loan: any, index: number) => {
        const isBorrower = loan.tenant_contact_id === userTenantContactId;
        const direction = isBorrower ? 'me prestó' : 'le presté';
        const dueDate = loan.due_date ? new Date(loan.due_date).toLocaleDateString('es-CL') : 'Sin fecha';

        return `${index + 1}. ${direction} $${Number(loan.amount).toLocaleString('es-CL')} - Vence: ${dueDate}`;
      }).join('\n');

      return {
        success: false,
        message: `Encontré ${loans.length} préstamos activos con ${targetContact.name}. Por favor especifica cuál:\n\n${loansList}`,
        needs_confirmation: true,
        action: 'select_loan_to_mark',
        data: { loans, contact_name: targetContact.name }
      };
    }

    // Un solo préstamo, pedir confirmación
    const loan = loans[0];
    const isBorrower = loan.tenant_contact_id === userTenantContactId;
    const direction = isBorrower ? 'me prestó' : 'le presté';

    return {
      success: true,
      message: `¿Confirmas marcar como devuelto el préstamo donde ${targetContact.name} ${direction} $${Number(loan.amount).toLocaleString('es-CL')}?`,
      needs_confirmation: true,
      action: 'confirm_mark_returned',
      data: {
        loan_id: loan.id,
        contact_name: targetContact.name,
        amount: loan.amount,
        direction
      }
    };

  } catch (error) {
    console.error('[markLoanReturned] Error:', error);
    return {
      success: false,
      error: 'Error procesando solicitud',
      needs_confirmation: false
    };
  }
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
  try {
    // Resolver contactId a tenant_contact_id
    const { data: resolvedContact } = await supabase
      .from('tenant_contacts')
      .select('id')
      .eq('id', contactId)
      .single();

    let userTenantContactId = contactId;

    if (!resolvedContact) {
      // Buscar en legacy contacts
      const { data: legacyContact } = await supabase
        .from('contacts')
        .select('tenant_contact_id')
        .eq('id', contactId)
        .single();

      if (legacyContact?.tenant_contact_id) {
        userTenantContactId = legacyContact.tenant_contact_id;
      }
    }

    // Buscar contacto
    const contactResult = await findContactByName(supabase, tenantId, args.contact_name, 0.6);

    if (!contactResult.success || !contactResult.matches || contactResult.matches.length === 0) {
      return {
        success: false,
        message: `No encontré ningún contacto con el nombre "${args.contact_name}".`,
        needs_confirmation: false
      };
    }

    const targetContact = contactResult.matches[0];
    const targetTenantContactId = targetContact.id;

    // Buscar préstamo activo con este contacto
    const { data: loans, error } = await supabase
      .from('agreements')
      .select(`
        id,
        amount,
        due_date,
        tenant_contact_id,
        lender_tenant_contact_id,
        borrower:tenant_contacts!tenant_contact_id(id, name),
        lender:tenant_contacts!lender_tenant_contact_id(id, name)
      `)
      .eq('tenant_id', tenantId)
      .eq('type', 'loan')
      .eq('status', 'active')
      .or(`and(tenant_contact_id.eq.${targetTenantContactId},lender_tenant_contact_id.eq.${userTenantContactId}),and(tenant_contact_id.eq.${userTenantContactId},lender_tenant_contact_id.eq.${targetTenantContactId})`)
      .limit(5);

    if (error) {
      console.error('[rescheduleLoan] Error:', error);
      return {
        success: false,
        error: 'Error buscando préstamo',
        needs_confirmation: false
      };
    }

    if (!loans || loans.length === 0) {
      return {
        success: false,
        message: `No encontré préstamos activos con ${targetContact.name}.`,
        needs_confirmation: false
      };
    }

    // Si hay múltiples préstamos, avisar
    if (loans.length > 1) {
      const loansList = loans.map((loan: any, index: number) => {
        const isBorrower = loan.tenant_contact_id === userTenantContactId;
        const direction = isBorrower ? 'me prestó' : 'le presté';
        const dueDate = loan.due_date ? new Date(loan.due_date).toLocaleDateString('es-CL') : 'Sin fecha';

        return `${index + 1}. ${direction} $${Number(loan.amount).toLocaleString('es-CL')} - Vence: ${dueDate}`;
      }).join('\n');

      return {
        success: false,
        message: `Encontré ${loans.length} préstamos activos con ${targetContact.name}. Por favor especifica cuál:\n\n${loansList}`,
        needs_confirmation: true,
        action: 'select_loan_to_reschedule',
        data: { loans, contact_name: targetContact.name, new_due_date: args.new_due_date }
      };
    }

    // Un solo préstamo, pedir confirmación
    const loan = loans[0];
    const isBorrower = loan.tenant_contact_id === userTenantContactId;
    const direction = isBorrower ? 'me prestó' : 'le presté';
    const currentDueDate = loan.due_date ? new Date(loan.due_date).toLocaleDateString('es-CL') : 'Sin fecha';
    const [year, month, day] = args.new_due_date.split('-');
    const newDueDateFormatted = `${day}/${month}/${year}`;

    return {
      success: true,
      message: `¿Confirmas reprogramar el préstamo donde ${targetContact.name} ${direction} $${Number(loan.amount).toLocaleString('es-CL')} de ${currentDueDate} a ${newDueDateFormatted}?`,
      needs_confirmation: true,
      action: 'confirm_reschedule',
      data: {
        loan_id: loan.id,
        contact_name: targetContact.name,
        amount: loan.amount,
        old_due_date: loan.due_date,
        new_due_date: args.new_due_date,
        direction
      }
    };

  } catch (error) {
    console.error('[rescheduleLoan] Error:', error);
    return {
      success: false,
      error: 'Error procesando solicitud',
      needs_confirmation: false
    };
  }
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
  console.log('[searchContacts] Buscando:', args.search_term);

  // Búsqueda con threshold bajo (0.5) para capturar variantes
  const result = await findContactByName(supabase, tenantId, args.search_term, 0.5);

  if (!result.success) {
    return {
      success: false,
      error: result.error
    };
  }

  const matches = result.matches || [];

  // Sin coincidencias → Sugerir crear contacto
  if (matches.length === 0) {
    return {
      success: true,
      message: `❌ No encontré ningún contacto con el nombre "${args.search_term}". ¿Quieres que lo agregue a tus contactos?`,
      needs_confirmation: false,
      data: {
        matches: [],
        suggestion: 'create_contact',
        suggested_name: args.search_term
      }
    };
  }

  // Coincidencia exacta o muy alta (>0.95) → Confirmación automática
  if (matches.length === 1 && matches[0].similarity >= 0.95) {
    return {
      success: true,
      message: `✅ Encontrado: ${matches[0].name} (similaridad: ${(matches[0].similarity * 100).toFixed(0)}%)`,
      needs_confirmation: false,
      data: {
        matches: [matches[0]],
        best_match: matches[0],
        confidence: 'high'
      }
    };
  }

  // Coincidencia parcial (0.8-0.95) → Pedir confirmación
  if (matches.length === 1 && matches[0].similarity >= 0.8) {
    return {
      success: true,
      message: `🤔 ¿Te refieres a "${matches[0].name}"? (similaridad: ${(matches[0].similarity * 100).toFixed(0)}%)`,
      needs_confirmation: false,
      data: {
        matches: [matches[0]],
        best_match: matches[0],
        confidence: 'medium',
        suggestion: 'confirm_or_create'
      }
    };
  }

  // Múltiples coincidencias → Mostrar candidatos
  const formattedList = matches.slice(0, 5).map((m, i) =>
    `${i + 1}. ${m.name} (similaridad: ${(m.similarity * 100).toFixed(0)}%)`
  ).join('\n');

  return {
    success: true,
    message: `🔍 Encontré varios contactos similares a "${args.search_term}":\n${formattedList}\n\n¿A cuál te refieres? También puedo crear uno nuevo si ninguno es el correcto.`,
    needs_confirmation: false,
    data: {
      matches: matches.slice(0, 5),
      confidence: 'low',
      suggestion: 'select_or_create'
    }
  };
}

/**
 * Crear contacto nuevo
 */
async function createContact(
  supabase: any,
  tenantId: string,
  contactId: string,
  args: {
    name: string;
    phone?: string;
    nickname?: string;
    notes?: string;
  }
) {
  // Verificar si ya existe un contacto similar
  const existingCheck = await findContactByName(supabase, tenantId, args.name, 0.8);

  if (existingCheck.success && existingCheck.matches && existingCheck.matches.length > 0) {
    // Ya existe un contacto muy similar
    const similar = existingCheck.matches[0];
    return {
      success: false,
      message: `Ya existe un contacto similar: ${similar.name} (${similar.phone_e164 || 'sin teléfono'}). ¿Quieres crearlo de todas formas?`,
      needs_confirmation: true,
      action: 'confirm_create_contact',
      data: {
        name: args.name,
        phone: args.phone,
        nickname: args.nickname,
        notes: args.notes,
        similar_contact: similar
      }
    };
  }

  // No hay contactos similares, pedir confirmación para crear
  return {
    success: true,
    message: `¿Confirmas crear el contacto "${args.name}"${args.phone ? ` con teléfono ${args.phone}` : ''}?`,
    needs_confirmation: true,
    action: 'confirm_create_contact',
    data: {
      name: args.name,
      phone: args.phone,
      nickname: args.nickname,
      notes: args.notes
    }
  };
}

/**
 * Actualizar contacto existente
 */
async function updateContact(
  supabase: any,
  tenantId: string,
  contactId: string,
  args: {
    contact_name: string;
    new_name?: string;
    new_phone?: string;
    new_nickname?: string;
    new_notes?: string;
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
      message: `No encontré ningún contacto con el nombre "${args.contact_name}".`,
      needs_confirmation: false
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

  // Construir mensaje de cambios
  const changes = [];
  if (args.new_name) changes.push(`nombre a "${args.new_name}"`);
  if (args.new_phone) changes.push(`teléfono a "${args.new_phone}"`);
  if (args.new_nickname) changes.push(`apodo a "${args.new_nickname}"`);
  if (args.new_notes) changes.push(`notas`);

  const changesText = changes.length > 0
    ? changes.join(', ')
    : 'sin cambios especificados';

  // Pedir confirmación
  return {
    success: true,
    message: `¿Confirmas actualizar ${changesText} para el contacto ${targetContact.name}?`,
    needs_confirmation: true,
    action: 'confirm_update_contact',
    data: {
      contact_id: targetContact.id,
      contact_name: targetContact.name,
      new_name: args.new_name,
      new_phone: args.new_phone,
      new_nickname: args.new_nickname,
      new_notes: args.new_notes
    }
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

/**
 * Ejecutar SQL generado dinámicamente con validación en cascada
 * (v2.2.0 - AI SQL Agent)
 */
async function executeGeneratedSQL(
  supabase: any,
  openai: OpenAIClient,
  tenantId: string,
  contactId: string,
  args: {
    question: string;
    expected_result_type: string;
  }
) {
  console.log('[SQL Agent] Starting dynamic query execution');
  console.log('[SQL Agent] Question:', args.question);
  console.log('[SQL Agent] Expected result type:', args.expected_result_type);

  try {
    // PASO 1: Obtener schema + contexto
    const schema = await getSchemaForAI(supabase, tenantId, contactId);
    console.log('[SQL Agent] Schema loaded:', {
      tables: Object.keys(schema.tables),
      contactsCount: schema.userContext.contactsList.length
    });

    // PASO 2: Retry loop (máx 3 intentos)
    const MAX_ATTEMPTS = 3;
    let lastError: string | null = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      console.log(`[SQL Agent] Attempt ${attempt + 1}/${MAX_ATTEMPTS}`);

      try {
        // FASE 1: Generar SQL con GPT-5-nano
        console.log('[SQL Agent] Generating SQL...');
        const generated = await generateSQL(openai, args.question, schema);
        console.log('[SQL Agent] Generated SQL:', sanitizeSQLForLogging(generated.sql));
        console.log('[SQL Agent] Complexity:', generated.estimatedComplexity);

        // FASE 2: Validación programática (rápida)
        console.log('[SQL Agent] Running syntax validation...');
        const syntaxValidation = validateSQLSyntax(generated.sql, {
          requiredTenantId: tenantId,
          maxJoins: 3,
          maxLength: 2000
        });

        if (!syntaxValidation.valid) {
          console.log('[SQL Agent] Syntax validation FAILED:', syntaxValidation.errors);
          lastError = syntaxValidation.errors.join('; ');
          continue; // Reintentar generación
        }

        if (syntaxValidation.warnings.length > 0) {
          console.log('[SQL Agent] Syntax warnings:', syntaxValidation.warnings);
        }

        console.log('[SQL Agent] Syntax validation PASSED');

        // FASE 3: Validación con LLM (GPT-5-nano como reviewer)
        console.log('[SQL Agent] Running LLM validation...');
        const llmValidation = await validateSQLWithLLM(
          openai,
          generated.sql,
          schema,
          args.question
        );

        console.log('[SQL Agent] LLM validation result:', {
          approved: llmValidation.approved,
          confidence: llmValidation.confidence,
          issues: llmValidation.issues
        });

        if (!llmValidation.approved) {
          // Si hay fix sugerido y confidence razonable, usarlo en próximo intento
          if (llmValidation.confidence >= 80 && llmValidation.suggestedFix) {
            console.log('[SQL Agent] Using suggested fix for next attempt');
            lastError = `Confidence ${llmValidation.confidence}%: ${llmValidation.issues.join('; ')}`;
            // En la próxima iteración, el generador volverá a intentar
            continue;
          }

          // Si confidence muy baja o sin fix, abortar
          lastError = `LLM rejected (confidence ${llmValidation.confidence}%): ${llmValidation.issues.join('; ')}`;
          console.log('[SQL Agent] LLM validation rejected, cannot fix automatically');
          break; // Salir del retry loop
        }

        if (llmValidation.confidence < 95) {
          lastError = `Confidence too low: ${llmValidation.confidence}% (required: 95%)`;
          console.log('[SQL Agent]', lastError);
          break;
        }

        console.log('[SQL Agent] LLM validation PASSED');

        // FASE 4: Ejecutar query con función segura de PostgreSQL
        console.log('[SQL Agent] Executing SQL via safe_execute_query()...');

        const { data, error } = await supabase.rpc('safe_execute_query', {
          sql_query: generated.sql,
          max_rows: 100
        });

        if (error) {
          console.error('[SQL Agent] Execution error:', error);
          lastError = `Database error: ${error.message}`;
          continue; // Reintentar con nueva generación
        }

        console.log('[SQL Agent] Execution SUCCESS:', {
          rowsReturned: data ? data.length : 0
        });

        // ÉXITO: Formatear y retornar resultados
        return formatSQLResults(data, generated, args.expected_result_type);

      } catch (attemptError) {
        console.error(`[SQL Agent] Attempt ${attempt + 1} error:`, attemptError);
        lastError = attemptError instanceof Error ? attemptError.message : 'Unknown error';
        // Continuar con siguiente intento
      }
    }

    // PASO 3: Si llegamos aquí, todos los intentos fallaron
    console.log('[SQL Agent] All attempts failed');

    return {
      success: false,
      needs_user_clarification: true,
      message: `No pude generar una consulta segura para tu pregunta. ${lastError ? `Último error: ${lastError}` : '¿Podrías reformular la pregunta de forma más específica?'}`,
      needs_confirmation: false
    };

  } catch (error) {
    console.error('[SQL Agent] Fatal error:', error);
    return {
      success: false,
      error: `Error en SQL Agent: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      needs_confirmation: false
    };
  }
}

/**
 * Formatear resultados SQL según tipo esperado
 */
function formatSQLResults(
  data: any[],
  generated: { sql: string; explanation: string; estimatedComplexity: string },
  resultType: string
): any {
  if (!data || data.length === 0) {
    return {
      success: true,
      message: 'No encontré resultados para tu consulta.',
      needs_confirmation: false,
      data: {
        rows: [],
        explanation: generated.explanation
      }
    };
  }

  // Formatear mensaje según tipo de resultado
  let message = '';

  switch (resultType) {
    case 'single_value':
      // Resultado único (ej: total, promedio)
      const firstRow = data[0];
      const firstValue = Object.values(firstRow)[0];
      message = `Resultado: ${typeof firstValue === 'number' ? `$${Number(firstValue).toLocaleString('es-CL')}` : firstValue}`;
      break;

    case 'aggregation':
      // Agregación por grupos
      message = `Encontré ${data.length} resultado${data.length > 1 ? 's' : ''}:\n\n`;
      data.slice(0, 10).forEach((row, idx) => {
        const entries = Object.entries(row);
        message += `${idx + 1}. ${entries.map(([k, v]) => `${k}: ${typeof v === 'number' ? `$${Number(v).toLocaleString('es-CL')}` : v}`).join(' | ')}\n`;
      });
      if (data.length > 10) {
        message += `\n... y ${data.length - 10} más`;
      }
      break;

    case 'list':
      // Lista de registros
      message = `Encontré ${data.length} préstamo${data.length > 1 ? 's' : ''}:\n\n`;
      data.slice(0, 10).forEach((row, idx) => {
        const amount = row.amount ? `$${Number(row.amount).toLocaleString('es-CL')}` : '';
        const dueDate = row.due_date ? new Date(row.due_date).toLocaleDateString('es-CL') : '';
        message += `${idx + 1}. ${amount}${dueDate ? ` - Vence: ${dueDate}` : ''}\n`;
      });
      if (data.length > 10) {
        message += `\n... y ${data.length - 10} más`;
      }
      break;

    case 'comparison':
      // Comparación entre valores
      message = `Comparación:\n\n`;
      data.forEach(row => {
        message += Object.entries(row).map(([k, v]) => `${k}: ${typeof v === 'number' ? `$${Number(v).toLocaleString('es-CL')}` : v}`).join(' | ') + '\n';
      });
      break;

    default:
      // Default: mostrar primeras filas
      message = `Encontré ${data.length} resultado${data.length > 1 ? 's' : ''}`;
  }

  return {
    success: true,
    message,
    needs_confirmation: false,
    data: {
      rows: data,
      rowCount: data.length,
      explanation: generated.explanation,
      complexity: generated.estimatedComplexity
    }
  };
}
