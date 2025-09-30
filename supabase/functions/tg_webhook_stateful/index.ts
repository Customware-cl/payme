// Webhook Telegram con Estado Conversacional
// Sistema minimalista e independiente del ConversationManager de WhatsApp

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-telegram-bot-api-secret-token',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      username?: string;
      last_name?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    text?: string;
  };
  callback_query?: {
    id: string;
    from: {
      id: number;
      first_name: string;
      username?: string;
    };
    data: string;
  };
}

interface TelegramConversationState {
  id?: string;
  tenant_id: string;
  chat_id: string;
  user_id: string;
  contact_id: string;
  current_flow: string | null;
  current_step: string | null;
  context: Record<string, any>;
  expires_at: string;
}

// Tipos de flujo soportados
type FlowType = 'new_loan' | 'reschedule' | 'new_service';
type FlowStep = 'init' | 'awaiting_contact' | 'awaiting_item' | 'awaiting_due_date' | 'confirming' | 'complete';

class TelegramFlowManager {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  // Detectar intención del usuario
  detectIntent(text: string): FlowType | null {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('préstamo') || lowerText.includes('prestar') || lowerText.includes('loan')) {
      return 'new_loan';
    }

    if (lowerText.includes('reprogramar') || lowerText.includes('cambiar fecha') || lowerText.includes('reschedule')) {
      return 'reschedule';
    }

    if (lowerText.includes('servicio') || lowerText.includes('mensual') || lowerText.includes('recurrente')) {
      return 'new_service';
    }

    return null;
  }

  // Obtener estado de conversación activo
  async getActiveConversation(tenantId: string, chatId: string): Promise<TelegramConversationState | null> {
    try {
      const { data, error } = await this.supabase
        .from('telegram_conversation_states')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('chat_id', chatId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error getting conversation state:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Exception getting conversation state:', error);
      return null;
    }
  }

  // Crear nuevo estado de conversación
  async createConversation(
    tenantId: string,
    chatId: string,
    userId: string,
    contactId: string,
    flowType: FlowType
  ): Promise<TelegramConversationState | null> {
    try {
      const newState = {
        tenant_id: tenantId,
        chat_id: chatId,
        user_id: userId,
        contact_id: contactId,
        current_flow: flowType,
        current_step: 'init',
        context: {},
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hora
      };

      const { data, error } = await this.supabase
        .from('telegram_conversation_states')
        .insert(newState)
        .select()
        .single();

      if (error) {
        console.error('Error creating conversation state:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Exception creating conversation state:', error);
      return null;
    }
  }

  // Actualizar estado de conversación
  async updateConversation(
    conversationId: string,
    step: FlowStep,
    context: Record<string, any>
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('telegram_conversation_states')
        .update({
          current_step: step,
          context: context,
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() // Extender 1 hora más
        })
        .eq('id', conversationId);

      if (error) {
        console.error('Error updating conversation state:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Exception updating conversation state:', error);
      return false;
    }
  }

  // Cancelar conversación
  async cancelConversation(tenantId: string, chatId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('telegram_conversation_states')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('chat_id', chatId);

      if (error) {
        console.error('Error canceling conversation:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Exception canceling conversation:', error);
      return false;
    }
  }

  // Procesar entrada del usuario
  async processInput(
    tenantId: string,
    chatId: string,
    userId: string,
    contactId: string,
    text: string
  ): Promise<{ message: string; completed: boolean; context?: any }> {

    // Obtener conversación activa
    let conversation = await this.getActiveConversation(tenantId, chatId);

    if (!conversation) {
      // No hay conversación activa, detectar intención
      const intent = this.detectIntent(text);

      if (!intent) {
        return {
          message: 'No estoy seguro de lo que necesitas. Prueba con:\\n• "Nuevo préstamo"\\n• "Reprogramar"\\n• "Servicio mensual"\\n\\nO escribe "ayuda" para más opciones.',
          completed: false
        };
      }

      // Crear nueva conversación
      conversation = await this.createConversation(tenantId, chatId, userId, contactId, intent);
      if (!conversation) {
        return {
          message: 'Error interno. Por favor intenta de nuevo.',
          completed: false
        };
      }
    }

    // Procesar según el flujo actual
    return this.processFlow(conversation, text);
  }

  // Procesar flujo específico
  private async processFlow(
    conversation: TelegramConversationState,
    input: string
  ): Promise<{ message: string; completed: boolean; context?: any }> {

    switch (conversation.current_flow) {
      case 'new_loan':
        return this.processNewLoanFlow(conversation, input);
      case 'reschedule':
        return this.processRescheduleFlow(conversation, input);
      case 'new_service':
        return this.processNewServiceFlow(conversation, input);
      default:
        return {
          message: 'Flujo no reconocido. Escribe "cancelar" para empezar de nuevo.',
          completed: false
        };
    }
  }

  // Procesar flujo de nuevo préstamo
  private async processNewLoanFlow(
    conversation: TelegramConversationState,
    input: string
  ): Promise<{ message: string; completed: boolean; context?: any }> {

    const context = { ...conversation.context };

    switch (conversation.current_step) {
      case 'init':
        await this.updateConversation(conversation.id!, 'awaiting_contact', context);
        return {
          message: '¡Perfecto! Vamos a crear un nuevo préstamo. 📝\\n\\n¿A quién se lo vas a prestar? Puedes escribir su nombre o número de teléfono.',
          completed: false
        };

      case 'awaiting_contact':
        if (input.trim().length < 2) {
          return {
            message: 'Por favor ingresa un nombre válido. ¿A quién se lo vas a prestar?',
            completed: false
          };
        }

        context.contact_info = input.trim();
        await this.updateConversation(conversation.id!, 'awaiting_item', context);
        return {
          message: `Perfecto, el préstamo será para: *${input.trim()}*\\n\\n¿Qué le vas a prestar? Describe el objeto o dinero.`,
          completed: false
        };

      case 'awaiting_item':
        if (input.trim().length < 3) {
          return {
            message: 'Por favor describe mejor lo que vas a prestar. ¿Qué es exactamente?',
            completed: false
          };
        }

        context.item_description = input.trim();
        await this.updateConversation(conversation.id!, 'awaiting_due_date', context);
        return {
          message: `Excelente: *${input.trim()}*\\n\\n¿Cuándo debe devolvértelo? Puedes escribir una fecha (ej: "mañana", "15 de enero", "en una semana")`,
          completed: false
        };

      case 'awaiting_due_date':
        const dueDate = this.parseDate(input);
        if (!dueDate) {
          return {
            message: 'No entiendo esa fecha. Intenta con algo como: "mañana", "15 de enero", "en una semana", etc.',
            completed: false
          };
        }

        context.due_date = dueDate;
        await this.updateConversation(conversation.id!, 'confirming', context);

        const summary = `📋 *Resumen del préstamo:*\\n\\n` +
          `👤 Para: ${context.contact_info}\\n` +
          `📦 Qué: ${context.item_description}\\n` +
          `📅 Vence: ${new Date(dueDate).toLocaleDateString('es-CL')}\\n\\n` +
          `¿Todo está correcto? Escribe "confirmar" para guardarlo.`;

        return {
          message: summary,
          completed: false
        };

      case 'confirming':
        if (!['si', 'sí', 'yes', 'confirmar', 'ok', 'correcto'].includes(input.toLowerCase())) {
          return {
            message: 'Por favor confirma escribiendo "si" o "confirmar" para guardar el préstamo.',
            completed: false
          };
        }

        // Marcar como completado
        await this.updateConversation(conversation.id!, 'complete', context);

        return {
          message: '✅ ¡Perfecto! Tu préstamo ha sido registrado.\\n\\nTe enviaré recordatorios automáticos cerca de la fecha de vencimiento.',
          completed: true,
          context: context
        };

      default:
        return {
          message: 'Estado no reconocido. Escribe "cancelar" para empezar de nuevo.',
          completed: false
        };
    }
  }

  // Procesar flujo de reprogramación (simplificado)
  private async processRescheduleFlow(
    conversation: TelegramConversationState,
    input: string
  ): Promise<{ message: string; completed: boolean; context?: any }> {
    // Implementación básica
    return {
      message: 'Función de reprogramación en desarrollo. Escribe "cancelar" para salir.',
      completed: true
    };
  }

  // Procesar flujo de nuevo servicio (simplificado)
  private async processNewServiceFlow(
    conversation: TelegramConversationState,
    input: string
  ): Promise<{ message: string; completed: boolean; context?: any }> {
    // Implementación básica
    return {
      message: 'Función de servicios en desarrollo. Escribe "cancelar" para salir.',
      completed: true
    };
  }

  // Parsear fecha de texto a ISO string
  private parseDate(input: string): string | null {
    const lowerInput = input.toLowerCase().trim();
    const now = new Date();

    try {
      if (lowerInput === 'mañana' || lowerInput === 'tomorrow') {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString();
      }

      if (lowerInput.includes('una semana') || lowerInput.includes('1 semana')) {
        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + 7);
        return nextWeek.toISOString();
      }

      if (lowerInput.includes('un mes') || lowerInput.includes('1 mes')) {
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        return nextMonth.toISOString();
      }

      // Intentar parsear fecha directa
      const parsedDate = new Date(input);
      if (!isNaN(parsedDate.getTime()) && parsedDate > now) {
        return parsedDate.toISOString();
      }

      return null;
    } catch {
      return null;
    }
  }
}

async function processUpdate(update: TelegramUpdate, supabase: any) {
  try {
    console.log('Processing update:', update.update_id);

    // Extraer info del mensaje
    const chatId = update.message?.chat?.id || update.callback_query?.from?.id;
    const userId = update.message?.from?.id || update.callback_query?.from?.id;
    const userName = update.message?.from?.first_name || update.callback_query?.from?.first_name;
    const username = update.message?.from?.username || update.callback_query?.from?.username;
    const text = update.message?.text;

    if (!chatId || !userId) {
      console.error('Missing chat or user ID');
      return { success: false, error: 'Invalid update' };
    }

    // 1. Obtener tenant
    const tenantId = 'd4c43ab8-426f-4bb9-8736-dfe301459590';
    const { data: tenant } = await supabase
      .from('tenants')
      .select('telegram_bot_token')
      .eq('id', tenantId)
      .single();

    if (!tenant?.telegram_bot_token) {
      console.error('No Telegram token found');
      return { success: false, error: 'Bot not configured' };
    }

    // 2. Buscar o crear contacto
    let { data: contact } = await supabase
      .from('contacts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('telegram_id', userId.toString())
      .maybeSingle();

    if (!contact && text) {
      // Crear nuevo contacto
      console.log('Creating new contact for user:', userId);
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          tenant_id: tenantId,
          telegram_id: userId.toString(),
          telegram_username: username || null,
          telegram_first_name: userName,
          telegram_last_name: update.message?.from?.last_name || null,
          name: userName,
          preferred_channel: 'telegram',
          telegram_opt_in_status: 'pending',
          preferred_language: 'es',
          metadata: { chat_id: chatId }
        })
        .select()
        .single();

      if (contactError) {
        console.error('Error creating contact:', contactError);
        return { success: false, error: 'Failed to create contact: ' + contactError.message };
      }

      contact = newContact;
      console.log('Successfully created new contact:', contact?.id);
    }

    // 3. Procesar mensaje
    let responseText = '';
    const flowManager = new TelegramFlowManager(supabase);

    if (text) {
      const lowerText = text.toLowerCase();

      // Comandos especiales
      if (lowerText === '/start' || lowerText === 'hola') {
        responseText = `¡Hola ${userName}! 👋 Soy tu asistente de recordatorios.\\n\\nPuedes escribir:\\n• "Nuevo préstamo" - Para registrar algo que prestaste\\n• "Estado" - Ver tus acuerdos activos\\n• "Ayuda" - Ver todos los comandos`;

      } else if (lowerText === 'cancelar' || lowerText === 'cancel') {
        await flowManager.cancelConversation(tenantId, chatId.toString());
        responseText = '❌ Conversación cancelada. Puedes iniciar una nueva cuando gustes.';

      } else if (lowerText.includes('estado') || lowerText === '/estado') {
        // Consultar acuerdos activos
        if (contact) {
          const { data: agreements } = await supabase
            .from('agreements')
            .select('*')
            .eq('contact_id', contact.id)
            .neq('status', 'cancelled')
            .order('created_at', { ascending: false });

          if (agreements && agreements.length > 0) {
            responseText = `📋 *Tus acuerdos:*\\n\\n`;
            agreements.forEach((agreement, i) => {
              responseText += `${i + 1}. *${agreement.title}*\\n`;
              responseText += `   Tipo: ${agreement.type === 'loan' ? 'Préstamo' : 'Servicio'}\\n`;
              responseText += `   Estado: ${agreement.status}\\n`;
              if (agreement.due_date) {
                responseText += `   Vence: ${new Date(agreement.due_date).toLocaleDateString()}\\n`;
              }
              responseText += '\\n';
            });
          } else {
            responseText = '📝 No tienes acuerdos activos en este momento.';
          }
        }

      } else if (lowerText.includes('ayuda') || lowerText === '/ayuda' || lowerText === '/help') {
        responseText = `🤖 *Comandos disponibles:*\\n\\n• *Nuevo préstamo* - Registrar algo prestado\\n• *Estado* - Ver acuerdos activos\\n• *Cancelar* - Cancelar conversación actual\\n• *Ayuda* - Ver este mensaje\\n\\nTambién puedes usar comandos como /prestamo, /estado`;

      } else if (contact) {
        // Procesar con el sistema de flujos
        const result = await flowManager.processInput(
          tenantId,
          chatId.toString(),
          userId.toString(),
          contact.id,
          text
        );

        responseText = result.message;

        // Si el flujo se completó, procesar el resultado
        if (result.completed && result.context) {
          // Aquí podríamos crear el agreement en la base de datos
          // Por ahora solo confirmamos
          console.log('Flow completed with context:', result.context);
        }
      }
    }

    // 4. Enviar respuesta
    if (responseText) {
      const telegramResponse = await fetch(`https://api.telegram.org/bot${tenant.telegram_bot_token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: responseText,
          parse_mode: 'Markdown'
        })
      });

      const result = await telegramResponse.json();

      if (result.ok) {
        console.log('Response sent successfully');

        // Registrar mensaje en tabla messages
        if (contact) {
          await supabase
            .from('messages')
            .insert({
              tenant_id: tenantId,
              contact_id: contact.id,
              channel: 'telegram',
              external_id: result.result.message_id?.toString(),
              conversation_id: chatId.toString(),
              direction: 'outbound',
              message_type: 'text',
              content: { text: responseText },
              external_timestamp: new Date().toISOString()
            });
        }

        return { success: true };
      } else {
        console.error('Telegram API error:', result);
        return { success: false, error: result.description };
      }
    }

    return { success: true };

  } catch (error) {
    console.error('Error processing update:', error);
    return { success: false, error: error.message };
  }
}

serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    if (req.method === 'GET') {
      return new Response('Telegram stateful webhook is running', {
        status: 200,
        headers: { 'Content-Type': 'text/plain', ...corsHeaders }
      });
    }

    if (req.method === 'POST') {
      const body = await req.text();
      const update: TelegramUpdate = JSON.parse(body);

      // Verificar secret token si está configurado (opcional para desarrollo)
      const secretToken = req.headers.get('x-telegram-bot-api-secret-token');
      const expectedSecret = Deno.env.get('TELEGRAM_SECRET_TOKEN');

      // Solo validar si tenemos secret configurado Y viene en el header
      if (expectedSecret && secretToken && secretToken !== expectedSecret) {
        console.warn('Invalid Telegram secret token');
        return new Response('Unauthorized', { status: 401 });
      }

      console.log('Processing Telegram webhook request');

      // Initialize Supabase - usar service role directamente en Edge Function
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

      // En Edge Functions, usar service key directamente sin auth
      const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      // Process update
      const result = await processUpdate(update, supabase);

      return new Response(JSON.stringify({
        success: result.success,
        update_id: update.update_id,
        processed: true,
        error: result.error
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response('Method not allowed', {
      status: 405,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});