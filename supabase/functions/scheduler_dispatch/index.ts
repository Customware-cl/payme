// Edge Function: Scheduler Dispatch
// Procesa recordatorios automáticos y genera instancias pendientes

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { WhatsAppWindowManager } from "../_shared/whatsapp-window-manager.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ProcessingStats {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  queued: number;
  debug_query_count?: number;
  debug_error?: string;
  debug_send_errors?: string[];
}

/**
 * Detecta si la hora actual (en timezone especificado) es la hora oficial de envío
 * @param timezone Timezone del tenant (ej: 'America/Santiago')
 * @param officialHour Hora oficial de envío (0-23, por defecto 9)
 * @returns true si estamos en la hora oficial
 */
function isOfficialSendHour(timezone: string = 'America/Santiago', officialHour: number = 9): boolean {
  const now = new Date();

  // Obtener hora actual en el timezone especificado
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false
  });

  const parts = formatter.formatToParts(now);
  const hourPart = parts.find(p => p.type === 'hour');
  const currentHourInTz = hourPart ? parseInt(hourPart.value) : 0;

  return currentHourInTz === officialHour;
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

    // Verificar autenticación del scheduler
    const authToken = req.headers.get('authorization')?.replace('Bearer ', '');
    const expectedToken = Deno.env.get('SCHEDULER_AUTH_TOKEN') || 'your-scheduler-auth-token';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Aceptar SCHEDULER_AUTH_TOKEN o SUPABASE_SERVICE_ROLE_KEY
    if (authToken !== expectedToken && authToken !== serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Inicializar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🚀 Scheduler dispatch started at:', new Date().toISOString());

    // Obtener parámetros de la request
    const body = await req.json().catch(() => ({}));
    const { tenant_id, dry_run = false, max_instances = 100, force_mode, force_send = false } = body;

    // Detectar modo de operación (puede ser forzado via parámetro)
    const isOfficialHour = isOfficialSendHour('America/Santiago', 9);
    const mode = force_send ? 'normal' : (force_mode || (isOfficialHour ? 'normal' : 'catchup'));
    console.log(`🕐 Scheduler running in ${mode.toUpperCase()} mode (official hour: ${isOfficialHour}, forced: ${!!force_mode}, force_send: ${force_send})`);

    // Estadísticas de procesamiento
    const stats: ProcessingStats = {
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      queued: 0
    };

    // Variables para estadísticas opcionales
    let refinedProcessingResult = { processed: 0, sent: 0, failed: 0, skipped: 0, queued: 0 };
    let generationResult = { generated: 0, agreements_processed: 0 };

    // 1. Actualizar estados de acuerdos basado en tiempo (siempre)
    const statusUpdateResult = await supabase.rpc('update_agreement_status_by_time');
    console.log('📊 Estados de acuerdos actualizados:', statusUpdateResult.data || 0);

    // 2. Procesar acuerdos con nuevos estados temporales (solo hora oficial o force_send)
    if (mode === 'normal') {
      refinedProcessingResult = await processRefinedAgreementStates(supabase, tenant_id, dry_run, force_send);
      console.log('🔄 Acuerdos refinados procesados:', refinedProcessingResult);
    } else {
      console.log('⏭️  Skipping refined state processing (not official hour)');
    }

    // 3. Generar instancias de recordatorios (solo hora oficial)
    if (mode === 'normal') {
      generationResult = await generateReminderInstances(supabase, tenant_id, max_instances);
      console.log('📅 Generated reminder instances:', generationResult);
    } else {
      console.log('⏭️  Skipping reminder generation (not official hour)');
    }

    // 4. Procesar instancias pendientes (siempre, pero con filtro según modo)
    const processingResult = await processScheduledReminders(supabase, tenant_id, dry_run, mode);

    // Combinar estadísticas
    stats.processed = processingResult.processed + refinedProcessingResult.processed;
    stats.sent = processingResult.sent + refinedProcessingResult.sent;
    stats.failed = processingResult.failed + refinedProcessingResult.failed;
    stats.skipped = processingResult.skipped + refinedProcessingResult.skipped;
    stats.queued = processingResult.queued + refinedProcessingResult.queued;
    stats.debug_query_count = refinedProcessingResult.debug_query_count;
    stats.debug_error = refinedProcessingResult.debug_error;
    stats.debug_send_errors = refinedProcessingResult.debug_send_errors;

    // 3. Procesar cola de mensajes de WhatsApp
    const windowManager = new WhatsAppWindowManager(supabaseUrl, supabaseServiceKey);
    const queueStats = await windowManager.processMessageQueue(tenant_id);
    console.log('📱 Message queue processing:', queueStats);

    // 4. Limpiar datos expirados
    const cleanupResult = await cleanupExpiredData(supabase);
    console.log('🧹 Cleanup result:', cleanupResult);

    // Registrar evento de ejecución
    await supabase
      .from('events')
      .insert({
        tenant_id: tenant_id || null,
        event_type: 'scheduler_executed',
        payload: {
          mode,
          is_official_hour: isOfficialHour,
          stats,
          generation: generationResult,
          queue_stats: queueStats,
          cleanup: cleanupResult,
          dry_run,
          execution_time: new Date().toISOString()
        }
      });

    console.log('✅ Scheduler dispatch completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        mode,
        is_official_hour: isOfficialHour,
        stats,
        generation: generationResult,
        queue_processing: queueStats,
        cleanup: cleanupResult,
        dry_run,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Scheduler dispatch error:', error);

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

// Generar nuevas instancias de recordatorios
async function generateReminderInstances(
  supabase: any,
  tenantId?: string,
  maxInstances: number = 100
): Promise<{ generated: number; agreements_processed: number }> {
  try {
    // Obtener acuerdos activos que necesitan recordatorios
    let agreementsQuery = supabase
      .from('agreements')
      .select(`
        id, tenant_id, contact_id, due_date, next_due_date,
        recurrence_rule, rrule, status,
        reminders!inner(id, reminder_type, days_offset, time_of_day, template_id, is_active)
      `)
      .eq('status', 'active')
      .eq('reminders.is_active', true);

    if (tenantId) {
      agreementsQuery = agreementsQuery.eq('tenant_id', tenantId);
    }

    const { data: agreements, error: agreementsError } = await agreementsQuery.limit(maxInstances);

    if (agreementsError) {
      throw new Error(`Error fetching agreements: ${agreementsError.message}`);
    }

    if (!agreements || agreements.length === 0) {
      return { generated: 0, agreements_processed: 0 };
    }

    let totalGenerated = 0;

    for (const agreement of agreements) {
      const targetDate = agreement.next_due_date || agreement.due_date;
      if (!targetDate) continue;

      for (const reminder of agreement.reminders) {
        // Calcular fecha de envío
        const dueDate = new Date(targetDate);
        const sendDate = new Date(dueDate);
        sendDate.setDate(sendDate.getDate() + reminder.days_offset);

        // Agregar hora específica
        const [hours, minutes] = reminder.time_of_day.split(':');
        sendDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        // Solo generar si es en el futuro
        if (sendDate <= new Date()) continue;

        // Verificar si ya existe esta instancia para este reminder y fecha
        // Usamos scheduled_for ya que due_date no existe en reminder_instances
        const scheduledForDate = sendDate.toISOString();
        const { data: existingInstance } = await supabase
          .from('reminder_instances')
          .select('id')
          .eq('reminder_id', reminder.id)
          .gte('scheduled_for', new Date(sendDate.getTime() - 60000).toISOString()) // 1 minuto antes
          .lte('scheduled_for', new Date(sendDate.getTime() + 60000).toISOString()) // 1 minuto después
          .eq('status', 'pending')
          .maybeSingle();

        if (existingInstance) continue;

        // Crear nueva instancia
        // Solo usamos columnas que existen en reminder_instances según schema
        // La info del agreement/contact se obtiene via: reminder_instances -> reminders -> agreements
        const { error: insertError } = await supabase
          .from('reminder_instances')
          .insert({
            reminder_id: reminder.id,
            scheduled_for: scheduledForDate,
            status: 'pending'
            // Nota: agreement_id, tenant_id, contact_id, etc. se obtienen via relaciones
            // rendered_variables se puede usar para guardar datos extra si es necesario
          });

        if (!insertError) {
          totalGenerated++;
        } else {
          console.error('Error creating reminder instance:', insertError);
        }
      }
    }

    return { generated: totalGenerated, agreements_processed: agreements.length };

  } catch (error) {
    console.error('Error in generateReminderInstances:', error);
    return { generated: 0, agreements_processed: 0 };
  }
}

// Procesar recordatorios programados
async function processScheduledReminders(
  supabase: any,
  tenantId?: string,
  dryRun: boolean = false,
  mode: 'normal' | 'catchup' = 'normal'
): Promise<ProcessingStats> {
  try {
    const stats: ProcessingStats = { processed: 0, sent: 0, failed: 0, skipped: 0, queued: 0 };

    // Calcular filtro de tiempo según modo
    let timeFilter: string;
    if (mode === 'catchup') {
      // Solo procesar mensajes atrasados (>1 hora)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      timeFilter = oneHourAgo.toISOString();
      console.log(`🔄 [CATCHUP MODE] Processing reminders delayed by >1 hour (before ${oneHourAgo.toISOString()})`);
    } else {
      // Modo normal: procesar todos los pendientes
      timeFilter = new Date().toISOString();
      console.log(`✅ [NORMAL MODE] Processing all pending reminders (before ${timeFilter})`);
    }

    // Obtener instancias que deben enviarse ahora
    // Navegamos las relaciones: reminder_instances -> reminders -> agreements -> tenant_contacts
    let instancesQuery = supabase
      .from('reminder_instances')
      .select(`
        id, reminder_id, scheduled_for, status, sent_at,
        reminders!inner(
          id, reminder_type, template_id, is_active,
          agreements!inner(
            id, tenant_id, contact_id, title, item_description, amount, currency, due_date, created_at, metadata,
            borrower:tenant_contacts!tenant_contact_id(
              id, name, opt_in_status,
              contact_profiles(phone_e164, first_name, last_name)
            ),
            lender:tenant_contacts!lender_tenant_contact_id(
              id, name,
              contact_profiles(first_name, last_name, email, bank_accounts)
            )
          ),
          templates(meta_template_name, body, variable_count)
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', timeFilter);

    // Filtrar por tenant_id a través de la relación
    if (tenantId) {
      instancesQuery = instancesQuery.eq('reminders.agreements.tenant_id', tenantId);
    }

    const { data: instances, error: instancesError } = await instancesQuery.limit(50);

    if (instancesError) {
      throw new Error(`Error fetching reminder instances: ${instancesError.message}`);
    }

    if (!instances || instances.length === 0) {
      return stats;
    }

    const windowManager = new WhatsAppWindowManager(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    for (const instance of instances) {
      stats.processed++;

      // Extraer datos de las relaciones anidadas para facilitar acceso
      const reminder = instance.reminders;
      const agreement = reminder?.agreements;
      const borrower = agreement?.borrower;
      let lender = agreement?.lender;
      const borrowerProfile = borrower?.contact_profiles;
      let lenderProfile = lender?.contact_profiles;
      const template = reminder?.templates;

      // Si lender es null, intentar obtenerlo desde metadata.original_context.lender_contact_id
      const lenderContactId = agreement?.metadata?.original_context?.lender_contact_id || agreement?.metadata?.lender_contact_id;
      if (!lender && lenderContactId) {
        const { data: lenderFromMetadata } = await supabase
          .from('tenant_contacts')
          .select('id, name, contact_profiles(first_name, last_name, email, bank_accounts)')
          .eq('id', lenderContactId)
          .single();

        if (lenderFromMetadata) {
          lender = lenderFromMetadata;
          lenderProfile = lenderFromMetadata.contact_profiles;
          console.log('[SCHEDULER] Lender resolved from metadata:', lender?.name);
        }
      }

      try {
        // Verificar que tenemos los datos necesarios
        if (!reminder || !agreement || !borrower) {
          console.error(`Missing required data for instance ${instance.id}`);
          stats.failed++;
          continue;
        }

        // Verificar opt-in del contacto
        if (borrower.opt_in_status !== 'opted_in') {
          stats.skipped++;
          await supabase
            .from('reminder_instances')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('id', instance.id);
          continue;
        }

        if (dryRun) {
          console.log(`[DRY RUN] Would send reminder to ${borrower.name} for ${agreement.title}`);
          stats.sent++;
          continue;
        }

        // Preparar datos aplanados para funciones auxiliares
        const flatInstance = {
          ...instance,
          tenant_id: agreement.tenant_id,
          contact_id: borrower.id,
          due_date: agreement.due_date,
          created_at: agreement.created_at,
          reminder_type: reminder.reminder_type,
          borrower: {
            name: borrower.name,
            phone_e164: borrowerProfile?.phone_e164,
            opt_in_status: borrower.opt_in_status,
            first_name: borrowerProfile?.first_name,
            last_name: borrowerProfile?.last_name
          },
          lender: {
            name: lender?.name,
            first_name: lenderProfile?.first_name,
            last_name: lenderProfile?.last_name,
            email: lenderProfile?.email,
            bank_accounts: lenderProfile?.bank_accounts
          },
          agreements: agreement,
          templates: template
        };

        // Preparar mensaje
        const messageText = await prepareReminderMessage(flatInstance);

        // Enviar mensaje usando Window Manager
        const sendResult = await windowManager.sendMessage(
          agreement.tenant_id,
          borrower.id,
          messageText,
          {
            templateName: template?.meta_template_name,
            templateVariables: extractTemplateVariables(flatInstance),
            priority: 'normal'
          }
        );

        if (sendResult.success) {
          if (sendResult.sent) {
            stats.sent++;
            await supabase
              .from('reminder_instances')
              .update({
                status: 'sent',
                sent_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', instance.id);
          } else if (sendResult.queued) {
            stats.queued++;
            await supabase
              .from('reminder_instances')
              .update({
                status: 'pending', // Mantener como pendiente hasta que se envíe desde la cola
                updated_at: new Date().toISOString()
              })
              .eq('id', instance.id);
          }
        } else {
          stats.failed++;
          await supabase
            .from('reminder_instances')
            .update({
              status: 'failed',
              error_message: sendResult.error,
              updated_at: new Date().toISOString()
            })
            .eq('id', instance.id);
        }

      } catch (instanceError) {
        console.error(`Error processing instance ${instance.id}:`, instanceError);
        stats.failed++;

        await supabase
          .from('reminder_instances')
          .update({
            status: 'failed',
            error_message: instanceError.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', instance.id);
      }
    }

    return stats;

  } catch (error) {
    console.error('Error in processScheduledReminders:', error);
    return { processed: 0, sent: 0, failed: 0, skipped: 0, queued: 0 };
  }
}

// Preparar mensaje de recordatorio
async function prepareReminderMessage(instance: any): Promise<string> {
  const borrower = instance.borrower;
  const agreement = instance.agreements;
  const dueDate = new Date(instance.due_date).toLocaleDateString('es-CL');
  const borrowerName = borrower?.first_name || borrower?.name || 'Usuario';

  const messageTemplates: Record<string, string> = {
    before_24h: `📅 Hola ${borrowerName}, te recordamos que mañana ${dueDate} vence el préstamo de "${agreement?.item_description || agreement?.title}". ¿Todo listo para la devolución?`,

    due_date: `🚨 Hola ${borrowerName}, hoy ${dueDate} vence el préstamo de "${agreement?.item_description || agreement?.title}". Por favor confirma cuando hayas hecho la devolución.`,

    overdue: `⚠️ ${borrowerName}, el préstamo de "${agreement?.item_description || agreement?.title}" venció el ${dueDate}. Por favor contacta para resolver esta situación.`,

    monthly_service: `💳 Hola ${borrowerName}, es momento del cobro de "${agreement?.item_description || agreement?.title}" por $${agreement?.amount || '0'}. ¿Confirmas el pago?`
  };

  return messageTemplates[instance.reminder_type] ||
    `Recordatorio: ${agreement?.title} - Fecha: ${dueDate}`;
}

// Extraer variables para templates según tipo
function extractTemplateVariables(instance: any): Record<string, any> {
  const borrower = instance.borrower;
  const lender = instance.lender;
  const agreement = instance.agreements;
  const templateName = instance.templates?.meta_template_name || '';

  // Formatear fecha
  const formatDate = (date: string) => new Date(date).toLocaleDateString('es-CL');

  // Formatear monto con separador de miles
  const formatAmount = (amount: number) => {
    return amount ? `$${amount.toLocaleString('es-CL')}` : '$0';
  };

  // Formatear RUT chileno
  const formatRUT = (rut: string) => {
    if (!rut) return 'No disponible';
    const clean = rut.replace(/[^0-9kK]/g, '');
    if (clean.length < 2) return rut;
    const dv = clean.slice(-1);
    const num = clean.slice(0, -1);
    return `${num.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`;
  };

  // Template due_date_item_v1: 4 variables + URL
  if (templateName === 'due_date_item_v1') {
    const agreementId = agreement?.id || '';
    const buttonUrlPath = `loan/${agreementId}/returned`;

    return {
      '1': borrower?.first_name || borrower?.name || 'Usuario',           // Nombre borrower
      '2': formatDate(instance.due_date),                                  // Fecha vencimiento
      '3': agreement?.item_description || agreement?.title || 'Objeto',   // Descripción item
      '4': lender?.name || 'el prestamista',                              // Nombre lender
      'button_url': buttonUrlPath                                          // URL del botón
    };
  }

  // Template due_date_money_v1: 11 variables (+ URL en botón)
  // Obtener datos bancarios del lender (si existe)
  const bankAccount = lender?.bank_accounts?.[0] || {};

  // Nombre completo del lender (con fallback)
  const lenderFullName = lender?.first_name && lender?.last_name
    ? `${lender.first_name} ${lender.last_name}`.trim()
    : (lender?.name || 'el prestamista');

  // Manejar caso donde lender es null (préstamos sin lender asignado)
  const hasBankInfo = bankAccount.bank_name || bankAccount.account_number;

  // Generar URL para el botón (marca como devuelto)
  const agreementId = agreement?.id || '';
  const buttonUrlPath = `loan/${agreementId}/returned`;

  return {
    '1': borrower?.first_name || borrower?.name || 'Usuario',           // Nombre borrower
    '2': lenderFullName,                                                  // Nombre lender
    '3': formatDate(instance.created_at || instance.due_date),           // Fecha préstamo
    '4': formatAmount(agreement?.amount),                                 // Monto
    '5': agreement?.item_description || agreement?.title || 'Préstamo', // Concepto
    '6': bankAccount.holder_name || lenderFullName,                       // Nombre transferencia
    '7': hasBankInfo ? formatRUT(bankAccount.rut || '') : 'Pendiente',   // RUT
    '8': bankAccount.bank_name || 'Pendiente',                           // Banco
    '9': bankAccount.account_type || 'Pendiente',                        // Tipo cuenta
    '10': bankAccount.account_number || 'Pendiente',                     // Número cuenta
    '11': lender?.email || 'Pendiente',                                  // Email
    'button_url': buttonUrlPath                                           // URL del botón (se añade a somospayme.cl/)
  };
}

// Limpiar datos expirados
async function cleanupExpiredData(supabase: any): Promise<{
  reminder_instances: number;
  conversation_states: number;
  message_queue: number;
}> {
  try {
    // Limpiar instancias antiguas (más de 30 días)
    const { data: oldInstances } = await supabase
      .from('reminder_instances')
      .delete()
      .lt('scheduled_time', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .in('status', ['sent', 'failed', 'cancelled'])
      .select('id');

    // Limpiar estados de conversación expirados
    const { data: expiredStates } = await supabase
      .from('conversation_states')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('id');

    // Limpiar cola de mensajes expirados
    const { data: expiredMessages } = await supabase
      .from('message_queue')
      .delete()
      .or('expires_at.lt.' + new Date().toISOString() + ',status.eq.expired')
      .select('id');

    return {
      reminder_instances: oldInstances?.length || 0,
      conversation_states: expiredStates?.length || 0,
      message_queue: expiredMessages?.length || 0
    };

  } catch (error) {
    console.error('Error in cleanup:', error);
    return { reminder_instances: 0, conversation_states: 0, message_queue: 0 };
  }
}

// Procesar acuerdos para envío de recordatorios (SIMPLIFICADO)
// Automático: solo préstamos del día de vencimiento
// Manual (force_send): todos los préstamos no completados
async function processRefinedAgreementStates(
  supabase: any,
  tenantId?: string,
  dryRun: boolean = false,
  forceSend: boolean = false
): Promise<ProcessingStats> {
  try {
    const stats: ProcessingStats = { processed: 0, sent: 0, failed: 0, skipped: 0, queued: 0, debug_send_errors: [] };

    // Fecha de hoy en formato YYYY-MM-DD
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Construir query base
    let agreementsQuery = supabase
      .from('agreements')
      .select(`
        id, title, status, due_date, type, tenant_id,
        tenant_contact_id, lender_tenant_contact_id,
        loan_type, amount, item_description, metadata, created_at,
        last_reminder_sent, reminder_sequence_step, opt_in_required,
        borrower:tenant_contacts!tenant_contact_id(
          id, name, opt_in_status,
          contact_profiles!inner(phone_e164, first_name)
        ),
        lender:tenant_contacts!lender_tenant_contact_id(
          id, name,
          contact_profiles(
            first_name, last_name, email, bank_accounts
          )
        ),
        tenants!agreements_tenant_id_fkey(id, name, whatsapp_phone_number_id, whatsapp_access_token)
      `)
      .eq('type', 'loan')
      .not('tenant_contact_id', 'is', null);

    if (forceSend) {
      // force_send: todos los préstamos no completados (sin importar fecha)
      agreementsQuery = agreementsQuery
        .not('status', 'in', '("completed","cancelled","rejected")')
        .is('last_reminder_sent', null);  // Solo los que nunca recibieron recordatorio
      console.log(`🔄 [FORCE_SEND] Buscando préstamos sin recordatorio enviado`);
    } else {
      // Automático: solo préstamos del día de vencimiento
      agreementsQuery = agreementsQuery
        .in('status', ['active', 'due_soon', 'overdue'])
        .eq('due_date', todayStr);
      console.log(`📅 [AUTOMÁTICO] Buscando préstamos con due_date = ${todayStr}`);
    }

    if (tenantId) {
      agreementsQuery = agreementsQuery.eq('tenant_id', tenantId);
    }

    const { data: agreements, error: agreementsError } = await agreementsQuery.limit(50);

    console.log(`📋 Query returned ${agreements?.length || 0} agreements, error: ${agreementsError ? JSON.stringify(agreementsError) : 'none'}`);

    stats.debug_query_count = agreements?.length || 0;

    if (agreementsError) {
      console.error('Error obteniendo acuerdos refinados:', agreementsError);
      stats.debug_error = agreementsError.message || JSON.stringify(agreementsError);
      return stats;
    }

    if (!agreements || agreements.length === 0) {
      console.log('📋 No agreements found matching criteria');
      return stats;
    }

    console.log(`📋 Processing ${agreements.length} agreements: ${agreements.map((a: any) => a.title).join(', ')}`);

    for (const agreement of agreements) {
      stats.processed++;

      try {
        // Determinar si debe enviar recordatorio
        // force_send: ya filtrado en query (solo sin last_reminder_sent)
        // automático: verificar con shouldSendRefinedReminder
        const shouldSendReminder = forceSend || shouldSendRefinedReminder(agreement);

        if (!shouldSendReminder) {
          stats.skipped++;
          continue;
        }

        if (dryRun) {
          console.log(`[DRY RUN] Enviaría recordatorio refinado a ${agreement.borrower?.name} para ${agreement.title}`);
          stats.sent++;
          continue;
        }

        // Enviar recordatorio
        const sendResult = await sendRefinedReminder(supabase, agreement);

        if (sendResult.success) {
          stats.sent++;

          // Actualizar última fecha de recordatorio
          await supabase
            .from('agreements')
            .update({
              last_reminder_sent: new Date().toISOString(),
              reminder_sequence_step: (agreement.reminder_sequence_step || 0) + 1,
              updated_at: new Date().toISOString()
            })
            .eq('id', agreement.id);
        } else {
          stats.failed++;
          const errorMsg = `${agreement.title}: ${sendResult.error}`;
          stats.debug_send_errors?.push(errorMsg);
          console.error(`Error enviando recordatorio refinado:`, sendResult.error);
        }

      } catch (agreementError: any) {
        const errorMsg = `${agreement.title}: ${agreementError.message || agreementError}`;
        stats.debug_send_errors?.push(errorMsg);
        console.error(`Error procesando acuerdo refinado ${agreement.id}:`, agreementError);
        stats.failed++;
      }
    }

    return stats;

  } catch (error) {
    console.error('Error en processRefinedAgreementStates:', error);
    return { processed: 0, sent: 0, failed: 0, skipped: 0, queued: 0 };
  }
}

// Determinar si debe enviar recordatorio (SIMPLIFICADO)
// Solo envía recordatorios el día de vencimiento (daysUntilDue === 0)
function shouldSendRefinedReminder(agreement: any): boolean {
  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(agreement.due_date);
  dueDate.setHours(0, 0, 0, 0);

  // Calcular días hasta vencimiento
  const daysUntilDue = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // Solo enviar el día de vencimiento (daysUntilDue === 0)
  if (daysUntilDue !== 0) {
    return false;
  }

  // No enviar si ya se envió hoy
  const lastSent = agreement.last_reminder_sent ? new Date(agreement.last_reminder_sent) : null;
  if (lastSent) {
    lastSent.setHours(0, 0, 0, 0);
    if (lastSent.getTime() === today.getTime()) {
      return false;
    }
  }

  return true;
}

// Enviar recordatorio usando plantillas HSM (SIMPLIFICADO)
// Solo usa due_date_money_v1 o due_date_item_v1
async function sendRefinedReminder(supabase: any, agreement: any): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Fecha de vencimiento (usada para notificaciones)
    const dueDate = new Date(agreement.due_date);

    // Determinar template según tipo de préstamo
    const isMoneyLoan = agreement.loan_type === 'money' ||
                        (agreement.loan_type === 'unknown' && agreement.amount !== null);
    const templateName = isMoneyLoan ? 'due_date_money_v1' : 'due_date_item_v1';
    const templateCategory = 'due_date';

    console.log(`📨 Enviando recordatorio con template: ${templateName} para ${agreement.title}`);

    // Obtener plantilla HSM
    const { data: template, error: templateError } = await supabase
      .from('templates')
      .select('*')
      .eq('category', templateCategory)
      .eq('meta_template_name', templateName)
      .is('tenant_id', null)
      .maybeSingle();

    if (templateError || !template) {
      return { success: false, error: `Plantilla no encontrada para categoría: ${templateCategory}${templateName ? ' (' + templateName + ')' : ''}` };
    }

    // Si lender no está en la relación directa, obtenerlo desde metadata
    let lenderData = agreement.lender;
    if (!lenderData) {
      const lenderContactId = agreement.metadata?.original_context?.lender_contact_id ||
                              agreement.metadata?.lender_contact_id;
      if (lenderContactId) {
        const { data: lenderFromMetadata } = await supabase
          .from('tenant_contacts')
          .select('id, name, contact_profiles(first_name, last_name, email, bank_accounts)')
          .eq('id', lenderContactId)
          .single();

        if (lenderFromMetadata) {
          lenderData = lenderFromMetadata;
          agreement.lender = lenderData; // Actualizar para que prepareRefinedTemplateVariables lo use
          console.log(`📎 Lender obtenido desde metadata: ${lenderData.name}`);
        }
      }
    }

    // Preparar variables de la plantilla (incluyendo URL del detalle)
    const variables = await prepareRefinedTemplateVariables(agreement, template.category, template.meta_template_name);

    // Separar variables del body y la URL del botón
    // Para templates con botones CTA URL, la última variable es la URL
    const hasUrlButton = template.button_config?.cta_url;
    const detailUrl = hasUrlButton ? variables[variables.length - 1] : null;
    const bodyVariables = hasUrlButton ? variables.slice(0, -1) : variables;

    // Crear componentes del mensaje HSM
    // Nota: Headers sin variables dinámicas no se incluyen
    const components: any[] = [
      {
        type: 'body',
        parameters: bodyVariables.map((v: string) => ({ type: 'text', text: String(v || '') }))
      }
    ];

    // Botón CTA URL (index 0)
    if (template.button_config?.cta_url && detailUrl) {
      components.push({
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [{
          type: 'text',
          text: String(detailUrl)
        }]
      });
    }

    console.log(`📝 Template: ${templateName}, bodyVars: ${bodyVariables.length}, vars: ${JSON.stringify(bodyVariables)}, URL: ${detailUrl}`);

    // Importar WhatsApp client
    const { sendWhatsAppMessage } = await import('../_shared/whatsapp-client.ts');

    // SIEMPRE usar credenciales del bot central (donde están las plantillas HSM)
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');

    if (!phoneNumberId || !accessToken) {
      console.error('❌ No WhatsApp credentials in env vars (WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN)');
      return { success: false, error: 'No WhatsApp credentials configured' };
    }

    // Enviar mensaje HSM
    const messageResult = await sendWhatsAppMessage({
      phoneNumberId,
      accessToken,
      to: agreement.borrower?.contact_profiles?.phone_e164,
      template: {
        name: template.meta_template_name,
        language: { code: 'es_CL' }, // Spanish (Chile)
        components
      }
    });

    if (messageResult.success) {
      console.log(`✅ Recordatorio refinado enviado: ${agreement.title} -> ${agreement.borrower?.name}`);

      // Crear notificación al dueño si es necesario
      if (agreement.status === 'overdue') {
        await supabase.rpc('create_owner_notification', {
          p_tenant_id: agreement.tenant_id,
          p_notification_type: 'agreement_overdue',
          p_title: 'Acuerdo Vencido',
          p_message: `El acuerdo "${agreement.title}" está vencido desde ${dueDate.toLocaleDateString('es-CL')}.`,
          p_agreement_id: agreement.id,
          p_contact_id: agreement.tenant_contact_id,
          p_priority: 'high'
        });
      }

      return { success: true };
    } else {
      return { success: false, error: messageResult.error };
    }

  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Generar token de acceso para el detalle del préstamo
function generateLoanDetailToken(tenantId: string, contactId: string): string {
  const timestamp = Date.now();
  return `menu_${tenantId}_${contactId}_${timestamp}`;
}

// Preparar variables para plantillas refinadas optimizadas
async function prepareRefinedTemplateVariables(agreement: any, category: string, templateName?: string): Promise<string[]> {
  const dueDate = new Date(agreement.due_date);
  const createdDate = new Date(agreement.created_at);
  const variables: string[] = [];

  // Formatear monto con separador de miles
  const formatAmount = (amount: number) => {
    return amount ? amount.toLocaleString('es-CL') : '0';
  };

  // Formatear fecha en formato dd/mm/yy
  const formatShortDate = (date: Date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  };

  // Formatear RUT chileno: 12345678-9
  const formatRUT = (rut: string) => {
    if (!rut) return 'Sin RUT';
    const clean = rut.replace(/[^0-9kK]/g, '');
    if (clean.length < 2) return rut;
    const dv = clean.slice(-1);
    const num = clean.slice(0, -1);
    return `${num.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`;
  };

  // Extraer datos bancarios del lender
  const getBankInfo = () => {
    const lender = agreement.lender;
    const profile = lender?.contact_profiles;
    const bankAccount = profile?.bank_accounts?.[0];

    return {
      name: profile?.first_name && profile?.last_name
        ? `${profile.first_name} ${profile.last_name}`.trim()
        : (lender?.name || 'el prestamista'),
      rut: bankAccount?.rut ? formatRUT(bankAccount.rut) : 'No disponible',
      bank: bankAccount?.bank_name || 'No disponible',
      accountType: bankAccount?.account_type || 'No disponible',
      accountNumber: bankAccount?.account_number || 'No disponible',
      email: profile?.email || 'No disponible'
    };
  };

  // Generar URL del detalle del préstamo (para botones CTA)
  const generateDetailUrl = () => {
    const baseUrl = Deno.env.get('APP_BASE_URL') || 'https://tudominio.com';
    const token = generateLoanDetailToken(agreement.tenant_id, agreement.tenant_contact_id);
    return `${baseUrl}/menu/loan-detail.html?token=${token}&loan_id=${agreement.id}`;
  };

  switch (category) {
    case 'opt_in':
      // Variables v2: {{1}} nombre, {{2}} empresa, {{3}} tipo_servicio
      variables.push(
        agreement.borrower?.name || 'Usuario',
        agreement.tenants?.name || 'la empresa',
        agreement.type === 'loan' ? 'préstamos y devoluciones' : 'servicios mensuales'
      );
      break;

    case 'before_24h':
      // Variables v2: {{1}} nombre, {{2}} fecha, {{3}} item, {{4}} prestamista
      variables.push(
        agreement.borrower?.name || 'Usuario',
        dueDate.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' }),
        agreement.title,
        agreement.lender?.name || agreement.tenants?.name || 'el prestamista'
      );
      break;

    case 'due_date':
      // Detectar tipo de plantilla (money vs object)
      const isMoneyTemplate = templateName === 'due_date_money_v1';
      const borrowerProfileName = agreement.borrower?.contact_profiles?.first_name || agreement.borrower?.name || 'Usuario';

      if (isMoneyTemplate) {
        // Plantilla de dinero: 11 variables body + 1 URL botón
        // {{1}} nombre_borrower, {{2}} nombre_lender, {{3}} fecha_préstamo, {{4}} monto,
        // {{5}} concepto, {{6}} nombre_transferencia, {{7}} rut, {{8}} banco,
        // {{9}} tipo_cuenta, {{10}} nro_cuenta, {{11}} email
        // Botón URL: {{1}} path dinámico
        const bankInfo = getBankInfo();
        const montoFormateado = agreement.amount ? `$${formatAmount(agreement.amount)}` : '$0';

        variables.push(
          borrowerProfileName,                                    // 1 - nombre borrower
          agreement.lender?.name || 'el prestamista',            // 2 - nombre lender
          formatShortDate(createdDate),                          // 3 - fecha préstamo
          montoFormateado,                                        // 4 - monto
          agreement.item_description || agreement.title || 'préstamo', // 5 - concepto
          bankInfo.name,                                          // 6 - nombre transferencia
          bankInfo.rut,                                           // 7 - RUT
          bankInfo.bank,                                          // 8 - banco
          bankInfo.accountType,                                   // 9 - tipo cuenta
          bankInfo.accountNumber,                                 // 10 - número cuenta
          bankInfo.email,                                         // 11 - email
          `loan/${agreement.id}/returned`                         // URL botón (path relativo)
        );
      } else {
        // Plantilla de objeto: 5 variables body + 1 URL botón
        // {{1}} nombre_borrower, {{2}} nombre_lender, {{3}} fecha_préstamo,
        // {{4}} objeto, {{5}} descripción
        // Botón URL: {{1}} path dinámico
        variables.push(
          borrowerProfileName,                                    // 1 - nombre borrower
          agreement.lender?.name || 'el prestamista',            // 2 - nombre lender
          formatShortDate(createdDate),                          // 3 - fecha préstamo
          agreement.item_description || agreement.title || 'objeto', // 4 - objeto
          agreement.title || 'préstamo',                          // 5 - descripción
          `loan/${agreement.id}/returned`                         // URL botón (path relativo)
        );
      }
      break;

    case 'overdue':
      // Variables v2: {{1}} nombre, {{2}} item, {{3}} fecha_vencimiento
      variables.push(
        agreement.borrower?.name || 'Usuario',
        agreement.title,
        dueDate.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })
      );
      break;

    case 'monthly_service_preview':
      // Variables v2: {{1}} nombre, {{2}} servicio, {{3}} fecha, {{4}} monto
      variables.push(
        agreement.borrower?.name || 'Usuario',
        agreement.title,
        dueDate.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' }),
        formatAmount(agreement.amount || 0)
      );
      break;

    case 'monthly_service':
      // Variables v2: {{1}} nombre, {{2}} servicio, {{3}} monto
      variables.push(
        agreement.borrower?.name || 'Usuario',
        agreement.title,
        formatAmount(agreement.amount || 0)
      );
      break;

    case 'monthly_service_overdue':
      // Variables v2: {{1}} nombre, {{2}} servicio, {{3}} monto, {{4}} fecha_original
      variables.push(
        agreement.borrower?.name || 'Usuario',
        agreement.title,
        formatAmount(agreement.amount || 0),
        dueDate.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })
      );
      break;

    default:
      // Fallback para compatibilidad
      variables.push(
        agreement.borrower?.name || 'Usuario',
        agreement.title,
        dueDate.toLocaleDateString('es-CL')
      );
  }

  return variables;
}