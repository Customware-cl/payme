// Edge Function: Message Processor
// Procesa la cola de mensajes de WhatsApp respetando la ventana de 24 horas

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { WhatsAppWindowManager } from "../_shared/whatsapp-window-manager.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ProcessingResult {
  success: boolean;
  processed: number;
  sent: number;
  failed: number;
  expired: number;
  error?: string;
}

serve(async (req: Request) => {
  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    // Solo permitir POST
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar autenticación
    const authToken = req.headers.get('authorization')?.replace('Bearer ', '');
    const expectedToken = Deno.env.get('SCHEDULER_AUTH_TOKEN') || 'your-scheduler-auth-token';

    if (authToken !== expectedToken) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Inicializar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('📱 Message processor started at:', new Date().toISOString());

    // Obtener parámetros de la request
    const body = await req.json().catch(() => ({}));
    const { tenant_id, max_messages = 50, dry_run = false } = body;

    // Inicializar Window Manager
    const windowManager = new WhatsAppWindowManager(supabaseUrl, supabaseServiceKey);

    // 1. Procesar cola de mensajes
    const queueResult = await windowManager.processMessageQueue(tenant_id);
    console.log('📤 Queue processing result:', queueResult);

    // 2. Limpiar mensajes expirados
    const cleanupResult = await windowManager.cleanupExpiredMessages();
    console.log('🧹 Cleanup result:', { expired_messages: cleanupResult });

    // 3. Procesar mensajes pendientes específicos (si se requiere procesamiento adicional)
    const pendingResult = await processPendingMessages(supabase, tenant_id, max_messages, dry_run);
    console.log('⏳ Pending messages result:', pendingResult);

    // 4. Obtener estadísticas de ventana para monitoring
    const windowStats = tenant_id ?
      await windowManager.getWindowStats(tenant_id) :
      { totalContacts: 0, openWindows: 0, closedWindows: 0, queuedMessages: 0 };

    // Registrar evento de ejecución
    await supabase
      .from('events')
      .insert({
        tenant_id: tenant_id || null,
        event_type: 'message_processor_executed',
        payload: {
          queue_processing: queueResult,
          pending_processing: pendingResult,
          cleanup: { expired_messages: cleanupResult },
          window_stats: windowStats,
          dry_run,
          execution_time: new Date().toISOString()
        }
      });

    console.log('✅ Message processor completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        queue_processing: queueResult,
        pending_processing: pendingResult,
        cleanup: { expired_messages: cleanupResult },
        window_stats: windowStats,
        dry_run,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Message processor error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

// Procesar mensajes pendientes con lógica específica
async function processPendingMessages(
  supabase: any,
  tenantId?: string,
  maxMessages: number = 50,
  dryRun: boolean = false
): Promise<ProcessingResult> {
  try {
    const result: ProcessingResult = {
      success: true,
      processed: 0,
      sent: 0,
      failed: 0,
      expired: 0
    };

    // Obtener mensajes pendientes ordenados por prioridad
    let messagesQuery = supabase
      .from('message_queue')
      .select(`
        id, tenant_id, contact_id, message_type, content,
        template_name, template_variables, priority, status,
        scheduled_for, expires_at, retry_count, max_retries,
        created_at
      `)
      .eq('status', 'pending')
      .lt('retry_count', supabase.raw('max_retries'))
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(maxMessages);

    if (tenantId) {
      messagesQuery = messagesQuery.eq('tenant_id', tenantId);
    }

    // Filtrar por scheduled_for (solo mensajes que ya deben enviarse)
    messagesQuery = messagesQuery.or(
      'scheduled_for.is.null,scheduled_for.lte.' + new Date().toISOString()
    );

    const { data: messages, error: messagesError } = await messagesQuery;

    if (messagesError) {
      throw new Error(`Error fetching pending messages: ${messagesError.message}`);
    }

    if (!messages || messages.length === 0) {
      return result;
    }

    console.log(`📋 Processing ${messages.length} pending messages`);

    const windowManager = new WhatsAppWindowManager(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    for (const message of messages) {
      result.processed++;

      try {
        // Verificar expiración
        if (message.expires_at && new Date(message.expires_at) < new Date()) {
          result.expired++;
          await supabase
            .from('message_queue')
            .update({
              status: 'expired',
              updated_at: new Date().toISOString()
            })
            .eq('id', message.id);
          continue;
        }

        if (dryRun) {
          console.log(`[DRY RUN] Would process message ${message.id} for contact ${message.contact_id}`);
          result.sent++;
          continue;
        }

        // Procesar según tipo de mensaje
        let sendResult;

        if (message.message_type === 'template' && message.template_name) {
          // Enviar con template específico
          sendResult = await windowManager.sendMessage(
            message.tenant_id,
            message.contact_id,
            '', // No se usa para templates
            {
              forceTemplate: true,
              templateName: message.template_name,
              templateVariables: message.template_variables || {},
              priority: message.priority
            }
          );
        } else {
          // Enviar como texto libre
          const messageText = message.content?.text ||
                              message.content?.body ||
                              JSON.stringify(message.content);

          sendResult = await windowManager.sendMessage(
            message.tenant_id,
            message.contact_id,
            messageText,
            { priority: message.priority }
          );
        }

        if (sendResult.success) {
          if (sendResult.sent) {
            result.sent++;
            await supabase
              .from('message_queue')
              .update({
                status: 'sent',
                updated_at: new Date().toISOString()
              })
              .eq('id', message.id);
          } else if (sendResult.queued) {
            // Mensaje re-encolado (ventana cerrada)
            await supabase
              .from('message_queue')
              .update({
                retry_count: message.retry_count + 1,
                updated_at: new Date().toISOString()
              })
              .eq('id', message.id);
          }
        } else {
          result.failed++;
          const newRetryCount = message.retry_count + 1;
          const newStatus = newRetryCount >= message.max_retries ? 'failed' : 'pending';

          await supabase
            .from('message_queue')
            .update({
              status: newStatus,
              retry_count: newRetryCount,
              error_message: sendResult.error,
              updated_at: new Date().toISOString()
            })
            .eq('id', message.id);
        }

      } catch (messageError) {
        console.error(`Error processing message ${message.id}:`, messageError);
        result.failed++;

        const newRetryCount = message.retry_count + 1;
        const newStatus = newRetryCount >= message.max_retries ? 'failed' : 'pending';

        await supabase
          .from('message_queue')
          .update({
            status: newStatus,
            retry_count: newRetryCount,
            error_message: messageError.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', message.id);
      }
    }

    return result;

  } catch (error) {
    console.error('Error in processPendingMessages:', error);
    return {
      success: false,
      processed: 0,
      sent: 0,
      failed: 0,
      expired: 0,
      error: error.message
    };
  }
}

// Función auxiliar para obtener estadísticas detalladas
async function getDetailedStats(supabase: any, tenantId?: string): Promise<{
  queue_summary: any;
  window_summary: any;
  recent_activity: any[];
}> {
  try {
    // Estadísticas de cola por tenant
    let queueStatsQuery = supabase.rpc('get_message_queue_stats');

    if (tenantId) {
      queueStatsQuery = queueStatsQuery.eq('p_tenant_id', tenantId);
    }

    const { data: queueStats } = await queueStatsQuery;

    // Actividad reciente (últimos 10 eventos)
    let recentActivityQuery = supabase
      .from('events')
      .select('event_type, payload, created_at')
      .in('event_type', ['message_sent', 'message_failed', 'message_queued'])
      .order('created_at', { ascending: false })
      .limit(10);

    if (tenantId) {
      recentActivityQuery = recentActivityQuery.eq('tenant_id', tenantId);
    }

    const { data: recentActivity } = await recentActivityQuery;

    return {
      queue_summary: queueStats || {},
      window_summary: {}, // Se puede expandir con más estadísticas
      recent_activity: recentActivity || []
    };

  } catch (error) {
    console.error('Error getting detailed stats:', error);
    return {
      queue_summary: {},
      window_summary: {},
      recent_activity: []
    };
  }
}