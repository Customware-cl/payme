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

    console.log('🚀 Scheduler dispatch started at:', new Date().toISOString());

    // Obtener parámetros de la request
    const body = await req.json().catch(() => ({}));
    const { tenant_id, dry_run = false, max_instances = 100 } = body;

    // Detectar modo de operación
    const isOfficialHour = isOfficialSendHour('America/Santiago', 9);
    const mode = isOfficialHour ? 'normal' : 'catchup';
    console.log(`🕐 Scheduler running in ${mode.toUpperCase()} mode (official hour: ${isOfficialHour})`);

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

    // 2. Procesar acuerdos con nuevos estados temporales (solo hora oficial)
    if (mode === 'normal') {
      refinedProcessingResult = await processRefinedAgreementStates(supabase, tenant_id, dry_run);
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

        // Verificar si ya existe esta instancia
        const { data: existingInstance } = await supabase
          .from('reminder_instances')
          .select('id')
          .eq('reminder_id', reminder.id)
          .eq('due_date', targetDate)
          .eq('status', 'pending')
          .maybeSingle();

        if (existingInstance) continue;

        // Crear nueva instancia
        const { error: insertError } = await supabase
          .from('reminder_instances')
          .insert({
            reminder_id: reminder.id,
            agreement_id: agreement.id,
            tenant_id: agreement.tenant_id,
            contact_id: agreement.contact_id,
            due_date: targetDate,
            scheduled_time: sendDate.toISOString(),
            status: 'pending',
            reminder_type: reminder.reminder_type,
            template_id: reminder.template_id
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
    let instancesQuery = supabase
      .from('reminder_instances')
      .select(`
        id, reminder_id, agreement_id, tenant_id, contact_id,
        due_date, scheduled_time, reminder_type, template_id,
        agreements!inner(title, item_description, amount, currency),
        contacts!inner(name, phone_e164, opt_in_status),
        templates(meta_template_name, body, variables_count)
      `)
      .eq('status', 'pending')
      .lte('scheduled_time', timeFilter);

    if (tenantId) {
      instancesQuery = instancesQuery.eq('tenant_id', tenantId);
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

      try {
        // Verificar opt-in del contacto
        if (instance.contacts.opt_in_status !== 'accepted') {
          stats.skipped++;
          await supabase
            .from('reminder_instances')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('id', instance.id);
          continue;
        }

        if (dryRun) {
          console.log(`[DRY RUN] Would send reminder to ${instance.contacts.name} for ${instance.agreements.title}`);
          stats.sent++;
          continue;
        }

        // Preparar mensaje
        const messageText = await prepareReminderMessage(instance);

        // Enviar mensaje usando Window Manager
        const sendResult = await windowManager.sendMessage(
          instance.tenant_id,
          instance.contact_id,
          messageText,
          {
            templateName: instance.templates?.meta_template_name,
            templateVariables: extractTemplateVariables(instance),
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
  const contact = instance.contacts;
  const agreement = instance.agreements;
  const dueDate = new Date(instance.due_date).toLocaleDateString('es-CL');

  const messageTemplates = {
    before_24h: `📅 Hola ${contact.name}, te recordamos que mañana ${dueDate} vence el préstamo de "${agreement.item_description}". ¿Todo listo para la devolución?`,

    due_date: `🚨 Hola ${contact.name}, hoy ${dueDate} vence el préstamo de "${agreement.item_description}". Por favor confirma cuando hayas hecho la devolución.`,

    overdue: `⚠️ ${contact.name}, el préstamo de "${agreement.item_description}" venció el ${dueDate}. Por favor contacta para resolver esta situación.`,

    monthly_service: `💳 Hola ${contact.name}, es momento del cobro de "${agreement.item_description}" por $${agreement.amount || '0'}. ¿Confirmas el pago?`
  };

  return messageTemplates[instance.reminder_type] ||
    `Recordatorio: ${agreement.title} - Fecha: ${dueDate}`;
}

// Extraer variables para templates
function extractTemplateVariables(instance: any): Record<string, any> {
  const contact = instance.contacts;
  const agreement = instance.agreements;
  const dueDate = new Date(instance.due_date).toLocaleDateString('es-CL');

  return {
    '1': contact.name,
    '2': dueDate,
    '3': agreement.item_description || agreement.title,
    '4': agreement.amount?.toString() || '0'
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

// Procesar acuerdos con estados refinados (DUE_SOON, DIA_D, VENCIDO)
async function processRefinedAgreementStates(
  supabase: any,
  tenantId?: string,
  dryRun: boolean = false
): Promise<ProcessingStats> {
  try {
    const stats: ProcessingStats = { processed: 0, sent: 0, failed: 0, skipped: 0, queued: 0 };

    // Obtener acuerdos que necesitan recordatorios basados en estado
    let agreementsQuery = supabase
      .from('agreements')
      .select(`
        id, title, status, due_date, agreement_type, tenant_id,
        tenant_contact_id, lender_tenant_contact_id,
        last_reminder_sent, reminder_sequence_step, opt_in_required,
        borrower:tenant_contacts!tenant_contact_id(
          id, name, opt_in_status,
          contact_profiles!inner(phone_e164)
        ),
        lender:tenant_contacts!lender_tenant_contact_id(
          id, name,
          contact_profiles!inner(
            first_name, last_name, email, bank_accounts
          )
        ),
        tenants!inner(id, name, whatsapp_phone_number_id, whatsapp_access_token)
      `)
      .in('status', ['due_soon', 'overdue'])
      .not('due_date', 'is', null)
      .not('tenant_contact_id', 'is', null);

    if (tenantId) {
      agreementsQuery = agreementsQuery.eq('tenant_id', tenantId);
    }

    const { data: agreements, error: agreementsError } = await agreementsQuery.limit(50);

    if (agreementsError) {
      console.error('Error obteniendo acuerdos refinados:', agreementsError);
      return stats;
    }

    if (!agreements || agreements.length === 0) {
      return stats;
    }

    for (const agreement of agreements) {
      stats.processed++;

      try {
        // Determinar si debe enviar recordatorio
        const shouldSendReminder = await shouldSendRefinedReminder(agreement);

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
          console.error(`Error enviando recordatorio refinado:`, sendResult.error);
        }

      } catch (agreementError) {
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

// Determinar si debe enviar recordatorio refinado
// Los recordatorios se envían a las 09:00 por defecto (configurable)
async function shouldSendRefinedReminder(agreement: any, targetHour: number = 9): Promise<boolean> {
  const now = new Date();
  const currentHour = now.getHours();
  const dueDate = new Date(agreement.due_date);
  dueDate.setHours(0, 0, 0, 0); // Normalizar a medianoche

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalizar a medianoche

  const lastSent = agreement.last_reminder_sent ? new Date(agreement.last_reminder_sent) : null;

  // Calcular días hasta vencimiento
  const daysUntilDue = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // Ventana de envío: entre 2 horas antes y 2 horas después de la hora objetivo
  const inSendWindow = currentHour >= (targetHour - 2) && currentHour <= (targetHour + 2);

  if (agreement.status === 'due_soon') {
    // Día antes del vencimiento (daysUntilDue === 1) → Recordatorio "before_24h"
    // Día de vencimiento (daysUntilDue === 0) → Recordatorio "due_date" con botones
    if (daysUntilDue !== 0 && daysUntilDue !== 1) {
      return false; // No es el día correcto
    }

    // Verificar que estamos en la ventana de envío (cerca de las 09:00)
    if (!inSendWindow) {
      return false; // No es la hora correcta
    }

    // No enviar si ya se envió hoy (en las últimas 12 horas)
    if (lastSent && (now.getTime() - lastSent.getTime()) < (12 * 60 * 60 * 1000)) {
      return false;
    }

    return true;
  }

  if (agreement.status === 'overdue') {
    // Para overdue: enviar cada 48 horas a las 09:00
    if (!inSendWindow) {
      return false; // No es la hora correcta
    }

    if (lastSent && (now.getTime() - lastSent.getTime()) < (48 * 60 * 60 * 1000)) {
      return false;
    }

    return true;
  }

  return false;
}

// Enviar recordatorio refinado usando plantillas HSM
async function sendRefinedReminder(supabase: any, agreement: any): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const dueDate = new Date(agreement.due_date);
    dueDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calcular días hasta vencimiento
    const daysUntilDue = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Determinar categoría de plantilla basándose en días
    let templateCategory = '';
    let templateName = '';

    if (agreement.status === 'due_soon') {
      if (daysUntilDue === 1) {
        // Día antes del vencimiento → Recordatorio previo
        templateCategory = agreement.agreement_type === 'loan' ? 'before_24h' : 'monthly_service_preview';
      } else if (daysUntilDue === 0) {
        // Día de vencimiento → Recordatorio con botones
        if (agreement.agreement_type === 'loan') {
          templateCategory = 'due_date';
          // Seleccionar template según tipo de préstamo
          const isMoneyLoan = agreement.amount !== null;
          templateName = isMoneyLoan ? 'due_date_money_v1' : 'due_date_object_v1';
        } else {
          templateCategory = 'monthly_service';
        }
      }
    } else if (agreement.status === 'overdue') {
      templateCategory = agreement.agreement_type === 'loan' ? 'overdue' : 'monthly_service_overdue';
    }

    if (!templateCategory) {
      return { success: false, error: 'No se pudo determinar categoría de plantilla' };
    }

    // Obtener plantilla HSM
    let templateQuery = supabase
      .from('templates')
      .select('*')
      .eq('category', templateCategory)
      .is('tenant_id', null);

    // Para due_date, buscar por nombre específico (money vs object)
    if (templateName) {
      templateQuery = templateQuery.eq('meta_template_name', templateName);
    }

    const { data: template, error: templateError } = await templateQuery.maybeSingle();

    if (templateError || !template) {
      return { success: false, error: `Plantilla no encontrada para categoría: ${templateCategory}${templateName ? ' (' + templateName + ')' : ''}` };
    }

    // Preparar variables de la plantilla (incluyendo URL del detalle)
    const variables = await prepareRefinedTemplateVariables(agreement, template.category, template.meta_template_name);

    // Separar variables del body y la URL del botón
    // Para templates con botones CTA URL, la última variable es la URL
    const hasUrlButton = template.button_config?.cta_url;
    const detailUrl = hasUrlButton ? variables[variables.length - 1] : null;
    const bodyVariables = hasUrlButton ? variables.slice(0, -1) : variables;

    // Crear componentes del mensaje HSM
    const components: any[] = [
      {
        type: 'body',
        parameters: bodyVariables.map((v: string) => ({ type: 'text', text: v }))
      }
    ];

    // Agregar header si existe
    if (template.header) {
      components.unshift({
        type: 'header',
        parameters: []
      });
    }

    // Agregar botones si la plantilla los tiene (formato JSONB)
    if (template.button_config) {
      let buttonIndex = 0;

      // Quick Reply buttons
      if (template.button_config.quick_replies && Array.isArray(template.button_config.quick_replies)) {
        template.button_config.quick_replies.forEach((button: any) => {
          components.push({
            type: 'button',
            sub_type: 'quick_reply',
            index: buttonIndex.toString(),
            parameters: [{
              type: 'payload',
              payload: `loan_${agreement.id}_mark_returned`
            }]
          });
          buttonIndex++;
        });
      }

      // CTA URL button (con variable dinámica en la URL - última variable)
      if (template.button_config.cta_url && detailUrl) {
        components.push({
          type: 'button',
          sub_type: 'url',
          index: buttonIndex.toString(),
          parameters: [{
            type: 'text',
            text: detailUrl
          }]
        });
      }
    }

    // Soporte legacy para buttons_config (si existe)
    if (template.buttons_config && template.buttons_config.length > 0) {
      template.buttons_config.forEach((button: any, index: number) => {
        components.push({
          type: 'button',
          sub_type: 'quick_reply',
          index: index.toString(),
          parameters: [{ type: 'payload', payload: `agreement_${agreement.id}_${button.text.toLowerCase().replace(/\s+/g, '_')}` }]
        });
      });
    }

    // Importar WhatsApp client
    const { sendWhatsAppMessage } = await import('../_shared/whatsapp-client.ts');

    // Enviar mensaje HSM
    const messageResult = await sendWhatsAppMessage({
      phoneNumberId: agreement.tenants.whatsapp_phone_number_id,
      accessToken: agreement.tenants.whatsapp_access_token,
      to: agreement.borrower?.contact_profiles?.phone_e164,
      template: {
        name: template.meta_template_name,
        language: { code: 'es_CL' }, // Spanish (Chile) según Meta Business
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
        agreement.agreement_type === 'loan' ? 'préstamos y devoluciones' : 'servicios mensuales'
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
        // Plantilla de dinero: 12 variables
        // {{1}} nombre_borrower, {{2}} monto, {{3}} nombre_lender, {{4}} fecha_creación,
        // {{5}} concepto, {{6}} nombre_completo_lender, {{7}} rut, {{8}} banco,
        // {{9}} tipo_cuenta, {{10}} nro_cuenta, {{11}} email, {{12}} url_detalle
        const bankInfo = getBankInfo();
        const montoFormateado = agreement.amount ? `$${formatAmount(agreement.amount)}` : '$0';

        variables.push(
          borrowerProfileName,
          montoFormateado,
          agreement.lender?.name || 'el prestamista',
          formatShortDate(createdDate),
          agreement.item_description || agreement.title || 'préstamo',
          bankInfo.name,
          bankInfo.rut,
          bankInfo.bank,
          bankInfo.accountType,
          bankInfo.accountNumber,
          bankInfo.email,
          generateDetailUrl()
        );
      } else {
        // Plantilla de objeto: 6 variables
        // {{1}} nombre_borrower, {{2}} objeto, {{3}} nombre_lender,
        // {{4}} fecha_creación, {{5}} concepto, {{6}} url_detalle
        variables.push(
          borrowerProfileName,
          agreement.item_description || agreement.title || 'objeto',
          agreement.lender?.name || 'el prestamista',
          formatShortDate(createdDate),
          agreement.title || 'préstamo',
          generateDetailUrl()
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