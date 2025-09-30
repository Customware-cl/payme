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

    // Estadísticas de procesamiento
    const stats: ProcessingStats = {
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      queued: 0
    };

    // 1. Actualizar estados de acuerdos basado en tiempo (nuevo sistema refinado)
    const statusUpdateResult = await supabase.rpc('update_agreement_status_by_time');
    console.log('📊 Estados de acuerdos actualizados:', statusUpdateResult.data || 0);

    // 2. Procesar acuerdos con nuevos estados temporales
    const refinedProcessingResult = await processRefinedAgreementStates(supabase, tenant_id, dry_run);
    console.log('🔄 Acuerdos refinados procesados:', refinedProcessingResult);

    // 3. Generar instancias de recordatorios (sistema legacy)
    const generationResult = await generateReminderInstances(supabase, tenant_id, max_instances);
    console.log('📅 Generated reminder instances:', generationResult);

    // 4. Procesar instancias pendientes (sistema legacy)
    const processingResult = await processScheduledReminders(supabase, tenant_id, dry_run);

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
  dryRun: boolean = false
): Promise<ProcessingStats> {
  try {
    const stats: ProcessingStats = { processed: 0, sent: 0, failed: 0, skipped: 0, queued: 0 };

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
      .lte('scheduled_time', new Date().toISOString());

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
        id, title, status, due_date, agreement_type, tenant_id, contact_id,
        last_reminder_sent, reminder_sequence_step, opt_in_required,
        contacts!inner(id, name, phone_e164, opt_in_status),
        tenants!inner(id, name, whatsapp_phone_number_id, whatsapp_access_token)
      `)
      .in('status', ['due_soon', 'overdue'])
      .eq('contacts.opt_in_status', 'opted_in')
      .not('due_date', 'is', null);

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
          console.log(`[DRY RUN] Enviaría recordatorio refinado a ${agreement.contacts.name} para ${agreement.title}`);
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
async function shouldSendRefinedReminder(agreement: any): Promise<boolean> {
  const now = new Date();
  const dueDate = new Date(agreement.due_date);
  const lastSent = agreement.last_reminder_sent ? new Date(agreement.last_reminder_sent) : null;

  // Calcular horas hasta vencimiento
  const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (agreement.status === 'due_soon') {
    // Para due_soon: enviar si está entre 12-36 horas del vencimiento
    if (hoursUntilDue < 12 || hoursUntilDue > 36) return false;

    // No enviar si ya se envió en las últimas 22 horas
    if (lastSent && (now.getTime() - lastSent.getTime()) < (22 * 60 * 60 * 1000)) {
      return false;
    }

    return true;
  }

  if (agreement.status === 'overdue') {
    // Para overdue: enviar cada 48 horas
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
    const now = new Date();
    const dueDate = new Date(agreement.due_date);
    const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Determinar categoría de plantilla
    let templateCategory = '';

    if (agreement.status === 'due_soon') {
      if (hoursUntilDue > 6) {
        // 24h antes
        templateCategory = agreement.agreement_type === 'loan' ? 'before_24h' : 'monthly_service_preview';
      } else {
        // Día D
        templateCategory = agreement.agreement_type === 'loan' ? 'due_date' : 'monthly_service';
      }
    } else if (agreement.status === 'overdue') {
      templateCategory = agreement.agreement_type === 'loan' ? 'overdue' : 'monthly_service_overdue';
    }

    if (!templateCategory) {
      return { success: false, error: 'No se pudo determinar categoría de plantilla' };
    }

    // Obtener plantilla HSM
    const { data: template, error: templateError } = await supabase
      .from('templates')
      .select('*')
      .eq('category', templateCategory)
      .eq('tenant_id', null)
      .single();

    if (templateError || !template) {
      return { success: false, error: `Plantilla no encontrada para categoría: ${templateCategory}` };
    }

    // Preparar variables de la plantilla
    const variables = prepareRefinedTemplateVariables(agreement, template.category);

    // Crear componentes del mensaje HSM
    const components = [
      {
        type: 'body',
        parameters: variables.map((v: string) => ({ type: 'text', text: v }))
      }
    ];

    // Agregar botones si la plantilla los tiene
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
      to: agreement.contacts.phone_e164,
      template: {
        name: template.meta_template_name,
        language: { code: 'es' },
        components
      }
    });

    if (messageResult.success) {
      console.log(`✅ Recordatorio refinado enviado: ${agreement.title} -> ${agreement.contacts.name}`);

      // Crear notificación al dueño si es necesario
      if (agreement.status === 'overdue') {
        await supabase.rpc('create_owner_notification', {
          p_tenant_id: agreement.tenant_id,
          p_notification_type: 'agreement_overdue',
          p_title: 'Acuerdo Vencido',
          p_message: `El acuerdo "${agreement.title}" está vencido desde ${dueDate.toLocaleDateString('es-CL')}.`,
          p_agreement_id: agreement.id,
          p_contact_id: agreement.contact_id,
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

// Preparar variables para plantillas refinadas optimizadas
function prepareRefinedTemplateVariables(agreement: any, category: string): string[] {
  const dueDate = new Date(agreement.due_date);
  const variables: string[] = [];

  // Formatear monto con separador de miles
  const formatAmount = (amount: number) => {
    return amount ? amount.toLocaleString('es-CL') : '0';
  };

  switch (category) {
    case 'opt_in':
      // Variables v2: {{1}} nombre, {{2}} empresa, {{3}} tipo_servicio
      variables.push(
        agreement.contacts.name || 'Usuario',
        agreement.tenants?.name || 'la empresa',
        agreement.agreement_type === 'loan' ? 'préstamos y devoluciones' : 'servicios mensuales'
      );
      break;

    case 'before_24h':
      // Variables v2: {{1}} nombre, {{2}} fecha, {{3}} item, {{4}} prestamista
      variables.push(
        agreement.contacts.name || 'Usuario',
        dueDate.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' }),
        agreement.title,
        agreement.tenants?.name || 'el prestamista'
      );
      break;

    case 'due_date':
      // Variables v2: {{1}} nombre, {{2}} item, {{3}} prestamista
      variables.push(
        agreement.contacts.name || 'Usuario',
        agreement.title,
        agreement.tenants?.name || 'el prestamista'
      );
      break;

    case 'overdue':
      // Variables v2: {{1}} nombre, {{2}} item, {{3}} fecha_vencimiento
      variables.push(
        agreement.contacts.name || 'Usuario',
        agreement.title,
        dueDate.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })
      );
      break;

    case 'monthly_service_preview':
      // Variables v2: {{1}} nombre, {{2}} servicio, {{3}} fecha, {{4}} monto
      variables.push(
        agreement.contacts.name || 'Usuario',
        agreement.title,
        dueDate.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' }),
        formatAmount(agreement.amount || 0)
      );
      break;

    case 'monthly_service':
      // Variables v2: {{1}} nombre, {{2}} servicio, {{3}} monto
      variables.push(
        agreement.contacts.name || 'Usuario',
        agreement.title,
        formatAmount(agreement.amount || 0)
      );
      break;

    case 'monthly_service_overdue':
      // Variables v2: {{1}} nombre, {{2}} servicio, {{3}} monto, {{4}} fecha_original
      variables.push(
        agreement.contacts.name || 'Usuario',
        agreement.title,
        formatAmount(agreement.amount || 0),
        dueDate.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })
      );
      break;

    default:
      // Fallback para compatibilidad
      variables.push(
        agreement.contacts.name || 'Usuario',
        agreement.title,
        dueDate.toLocaleDateString('es-CL')
      );
  }

  return variables;
}