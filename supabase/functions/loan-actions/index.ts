// Edge Function: Loan Actions
// Maneja acciones sobre préstamos desde la app web

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { WhatsAppWindowManager } from "../_shared/whatsapp-window-manager.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// Validar y decodificar token
function parseToken(token: string): { tenant_id: string; contact_id: string; timestamp: number } | null {
  try {
    // Token format: menu_[tenant_id]_[contact_id]_[timestamp]
    const parts = token.split('_');

    if (parts[0] !== 'menu' || parts.length !== 4) {
      return null;
    }

    const tenant_id = parts[1];
    const contact_id = parts[2];
    const timestamp = parseInt(parts[3]);

    // Verificar expiración (1 hora)
    const now = Date.now();
    const tokenAge = now - timestamp;
    const oneHour = 60 * 60 * 1000;

    if (tokenAge > oneHour) {
      console.log('Token expired:', { tokenAge, oneHour });
      return null;
    }

    return { tenant_id, contact_id, timestamp };
  } catch (error) {
    console.error('Error parsing token:', error);
    return null;
  }
}

// Formatear dinero en pesos chilenos
function formatMoney(amount: number): string {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
}

// Formatear fecha
function formatDate(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${date.getDate()} de ${months[date.getMonth()]}`;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // GET: Obtener detalles del préstamo
    if (req.method === 'GET') {
      const token = url.searchParams.get('token');
      const loanId = url.searchParams.get('loan_id');
      const action = url.searchParams.get('action');

      if (!token || !loanId) {
        return new Response(JSON.stringify({ success: false, error: 'Token y loan_id requeridos' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const tokenData = parseToken(token);
      if (!tokenData) {
        return new Response(JSON.stringify({ success: false, error: 'Token inválido o expirado' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (action === 'get_detail') {
        // Obtener préstamo con información completa
        const { data: loan, error } = await supabase
          .from('agreements')
          .select(`
            *,
            lender:tenant_contacts!lender_tenant_contact_id(id, name, contact_profiles(phone_e164)),
            borrower:tenant_contacts!tenant_contact_id(id, name, contact_profiles(phone_e164))
          `)
          .eq('id', loanId)
          .single();

        if (error || !loan) {
          return new Response(JSON.stringify({ success: false, error: 'Préstamo no encontrado' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Determinar rol del usuario
        let userRole: 'lender' | 'borrower' | null = null;
        if (loan.lender_tenant_contact_id === tokenData.contact_id) {
          userRole = 'lender';
        } else if (loan.tenant_contact_id === tokenData.contact_id) {
          userRole = 'borrower';
        }

        if (!userRole) {
          return new Response(JSON.stringify({ success: false, error: 'No tienes permiso para ver este préstamo' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({
          success: true,
          loan,
          userRole
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: false, error: 'Acción no válida' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST: Ejecutar acciones
    if (req.method === 'POST') {
      const body = await req.json();
      const { token, loan_id, action, new_date } = body;

      console.log('POST request body:', { token: !!token, loan_id, action, new_date });

      if (!token || !loan_id || !action) {
        const missing = [];
        if (!token) missing.push('token');
        if (!loan_id) missing.push('loan_id');
        if (!action) missing.push('action');

        return new Response(JSON.stringify({
          success: false,
          error: `Datos incompletos: faltan ${missing.join(', ')}`
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const tokenData = parseToken(token);
      if (!tokenData) {
        return new Response(JSON.stringify({ success: false, error: 'Token inválido o expirado' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Obtener préstamo
      const { data: loan, error: loanError } = await supabase
        .from('agreements')
        .select(`
          *,
          lender:tenant_contacts!lender_tenant_contact_id(id, name, contact_profiles(phone_e164)),
          borrower:tenant_contacts!tenant_contact_id(id, name, contact_profiles(phone_e164))
        `)
        .eq('id', loan_id)
        .single();

      if (loanError || !loan) {
        return new Response(JSON.stringify({ success: false, error: 'Préstamo no encontrado' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Determinar rol del usuario
      let userRole: 'lender' | 'borrower' | null = null;
      if (loan.lender_tenant_contact_id === tokenData.contact_id) {
        userRole = 'lender';
      } else if (loan.tenant_contact_id === tokenData.contact_id) {
        userRole = 'borrower';
      }

      if (!userRole) {
        return new Response(JSON.stringify({ success: false, error: 'No tienes permiso para realizar esta acción' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Ejecutar acción según el tipo
      let message = '';
      let updateData: any = {};

      switch (action) {
        case 'confirm':
          // Solo el borrower puede confirmar
          if (userRole !== 'borrower' || loan.status !== 'pending_confirmation') {
            return new Response(JSON.stringify({ success: false, error: 'No puedes confirmar este préstamo' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          updateData = { status: 'active' };
          message = 'Préstamo confirmado exitosamente';

          // Notificar al prestamista
          const windowManager1 = new WhatsAppWindowManager(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          );
          const loanText1 = loan.amount ? formatMoney(loan.amount) : loan.item_description;
          const confirmMessage = `✅ ${loan.borrower.name} confirmó el préstamo de ${loanText1}. El préstamo ya está activo.`;
          await windowManager1.sendMessage(tokenData.tenant_id, loan.lender_tenant_contact_id, confirmMessage);
          break;

        case 'reject':
          // Solo el borrower puede rechazar
          if (userRole !== 'borrower' || loan.status !== 'pending_confirmation') {
            return new Response(JSON.stringify({ success: false, error: 'No puedes rechazar este préstamo' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          updateData = { status: 'rejected' };
          message = 'Préstamo rechazado';

          // Notificar al prestamista
          const windowManager2 = new WhatsAppWindowManager(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          );
          const loanText2 = loan.amount ? formatMoney(loan.amount) : loan.item_description;
          const rejectMessage = `❌ ${loan.borrower.name} rechazó el préstamo de ${loanText2}.`;
          await windowManager2.sendMessage(tokenData.tenant_id, loan.lender_tenant_contact_id, rejectMessage);
          break;

        case 'mark_returned':
          // Ambos pueden marcar como devuelto
          if (loan.status !== 'active') {
            return new Response(JSON.stringify({ success: false, error: 'Solo puedes marcar como devuelto un préstamo activo' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          updateData = {
            status: 'completed',
            returned_date: new Date().toISOString().split('T')[0]
          };
          message = 'Préstamo marcado como devuelto';

          // Notificar a la otra parte
          const windowManager3 = new WhatsAppWindowManager(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          );
          const loanText3 = loan.amount ? formatMoney(loan.amount) : loan.item_description;
          const otherContactId = userRole === 'lender' ? loan.tenant_contact_id : loan.lender_tenant_contact_id;
          const whoName = userRole === 'lender' ? loan.lender.name : loan.borrower.name;
          const returnedMessage = `✅ ${whoName} marcó como devuelto el préstamo de ${loanText3}.`;
          await windowManager3.sendMessage(tokenData.tenant_id, otherContactId, returnedMessage);
          break;

        case 'cancel':
          // Ambos pueden cancelar (con confirmación)
          if (loan.status === 'completed' || loan.status === 'cancelled') {
            return new Response(JSON.stringify({ success: false, error: 'Este préstamo ya está finalizado' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          updateData = { status: 'cancelled' };
          message = 'Préstamo cancelado';

          // Notificar a la otra parte
          const windowManager4 = new WhatsAppWindowManager(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          );
          const loanText4 = loan.amount ? formatMoney(loan.amount) : loan.item_description;
          const otherContactId2 = userRole === 'lender' ? loan.tenant_contact_id : loan.lender_tenant_contact_id;
          const whoName2 = userRole === 'lender' ? loan.lender.name : loan.borrower.name;
          const cancelMessage = `🚫 ${whoName2} canceló el préstamo de ${loanText4}.`;
          await windowManager4.sendMessage(tokenData.tenant_id, otherContactId2, cancelMessage);
          break;

        case 'remind':
          // Solo el lender puede enviar recordatorios
          if (userRole !== 'lender' || loan.status !== 'active') {
            return new Response(JSON.stringify({ success: false, error: 'No puedes enviar recordatorios' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const windowManager5 = new WhatsAppWindowManager(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          );
          const loanText5 = loan.amount ? formatMoney(loan.amount) : loan.item_description;
          const dueDate = formatDate(loan.due_date);
          const reminderMessage = `🔔 Recordatorio: Tienes pendiente devolver el préstamo de ${loanText5}. Fecha de devolución: ${dueDate}.`;
          await windowManager5.sendMessage(tokenData.tenant_id, loan.tenant_contact_id, reminderMessage);

          message = 'Recordatorio enviado exitosamente';
          break;

        case 'resend':
          // Solo el lender puede reenviar solicitud
          if (userRole !== 'lender' || loan.status !== 'pending_confirmation') {
            return new Response(JSON.stringify({ success: false, error: 'No puedes reenviar la solicitud' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const windowManager6 = new WhatsAppWindowManager(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          );
          const loanText6 = loan.amount ? formatMoney(loan.amount) : loan.item_description;
          const dueDate2 = formatDate(loan.due_date);
          const resendMessage = `📝 Te registré un préstamo de ${loanText6} con fecha de devolución el ${dueDate2}. Por favor confirma si es correcto.`;
          await windowManager6.sendMessage(tokenData.tenant_id, loan.tenant_contact_id, resendMessage);

          message = 'Solicitud reenviada exitosamente';
          break;

        case 'request_extension':
          // Solo el borrower puede solicitar más plazo
          if (userRole !== 'borrower' || loan.status !== 'active') {
            return new Response(JSON.stringify({ success: false, error: 'No puedes solicitar más plazo' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const windowManager7 = new WhatsAppWindowManager(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          );
          const loanText7 = loan.amount ? formatMoney(loan.amount) : loan.item_description;
          const extensionMessage = `📅 ${loan.borrower.name} solicita más plazo para devolver el préstamo de ${loanText7}.`;
          await windowManager7.sendMessage(tokenData.tenant_id, loan.lender_tenant_contact_id, extensionMessage);

          message = 'Solicitud de extensión enviada';
          break;

        case 'edit_date':
          // Solo el lender puede editar fecha
          if (userRole !== 'lender' || loan.status !== 'active') {
            return new Response(JSON.stringify({ success: false, error: 'No puedes editar la fecha' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          if (!new_date) {
            return new Response(JSON.stringify({ success: false, error: 'Fecha requerida' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          updateData = { due_date: new_date };
          message = 'Fecha actualizada exitosamente';

          // Notificar al borrower
          const windowManager8 = new WhatsAppWindowManager(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          );
          const loanText8 = loan.amount ? formatMoney(loan.amount) : loan.item_description;
          const newDueDate = formatDate(new_date);
          const dateChangeMessage = `📅 La fecha de devolución del préstamo de ${loanText8} cambió a ${newDueDate}.`;
          await windowManager8.sendMessage(tokenData.tenant_id, loan.tenant_contact_id, dateChangeMessage);
          break;

        default:
          return new Response(JSON.stringify({ success: false, error: 'Acción no válida' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
      }

      // Actualizar préstamo si hay cambios
      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from('agreements')
          .update(updateData)
          .eq('id', loan_id);

        if (updateError) {
          console.error('Error updating loan:', updateError);
          return new Response(JSON.stringify({ success: false, error: 'Error al actualizar el préstamo' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: false, error: 'Método no permitido' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in loan-actions function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
