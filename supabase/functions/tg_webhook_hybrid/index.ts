// Webhook Telegram Híbrido - Simple pero con DB integration
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
      // Crear nuevo contacto para mensajes de texto
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

    if (text) {
      // Mensajes de texto
      const lowerText = text.toLowerCase();

      if (lowerText === '/start' || lowerText === 'hola') {
        responseText = `¡Hola ${userName}! 👋 Soy tu asistente de recordatorios.\n\nPuedes escribir:\n• "Nuevo préstamo" - Para registrar algo que prestaste\n• "Estado" - Ver tus acuerdos activos\n• "Ayuda" - Ver todos los comandos`;

      } else if (lowerText.includes('préstamo') || lowerText === '/prestamo') {
        // Crear acuerdo básico
        if (contact) {
          const { data: agreement } = await supabase
            .from('agreements')
            .insert({
              tenant_id: tenantId,
              contact_id: contact.id,
              type: 'loan',
              title: `Préstamo a ${userName}`,
              description: 'Préstamo creado vía Telegram',
              status: 'pending',
              metadata: { created_via: 'telegram' }
            })
            .select()
            .single();

          if (agreement) {
            responseText = `✅ ¡Perfecto! He creado un nuevo préstamo.\n\n📋 *Detalles:*\n• ID: ${agreement.id.slice(0, 8)}\n• Estado: Pendiente\n\n💬 Para completar los detalles (monto, fecha, etc.), contáctanos directamente.`;
          } else {
            responseText = 'Error al crear el préstamo. Intenta de nuevo.';
          }
        } else {
          responseText = '❌ Error: No pude crear tu perfil. Intenta con /start primero.';
        }

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
            responseText = `📋 *Tus acuerdos:*\n\n`;
            agreements.forEach((agreement, i) => {
              responseText += `${i + 1}. *${agreement.title}*\n`;
              responseText += `   Tipo: ${agreement.type === 'loan' ? 'Préstamo' : 'Servicio'}\n`;
              responseText += `   Estado: ${agreement.status}\n`;
              if (agreement.due_date) {
                responseText += `   Vence: ${new Date(agreement.due_date).toLocaleDateString()}\n`;
              }
              responseText += '\n';
            });
          } else {
            responseText = '📝 No tienes acuerdos activos en este momento.';
          }
        } else {
          responseText = '❌ No encontré tu perfil. Envía /start primero.';
        }

      } else if (lowerText.includes('ayuda') || lowerText === '/ayuda' || lowerText === '/help') {
        responseText = `🤖 *Comandos disponibles:*\n\n• *Nuevo préstamo* - Registrar algo prestado\n• *Estado* - Ver acuerdos activos\n• *Ayuda* - Ver este mensaje\n\nTambién puedes usar los comandos:\n/prestamo, /estado, /ayuda`;

      } else {
        responseText = `Recibido: "${text}"\n\n💡 Prueba con:\n• "Nuevo préstamo"\n• "Estado"\n• "Ayuda"\n\nO usa /start para comenzar.`;
      }

    } else if (update.callback_query) {
      // Manejo básico de botones
      responseText = `Botón presionado: ${update.callback_query.data}\n\n(Funcionalidad en desarrollo)`;
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
      return new Response('Telegram webhook hybrid is running', {
        status: 200,
        headers: { 'Content-Type': 'text/plain', ...corsHeaders }
      });
    }

    if (req.method === 'POST') {
      const body = await req.text();
      const update: TelegramUpdate = JSON.parse(body);

      // Initialize Supabase
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

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