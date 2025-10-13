// Edge Function: Loan Web Form Handler
// Procesa envíos del formulario web de préstamos

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { FlowHandlers } from "../_shared/flow-handlers.ts";
import { FlowDataProvider } from "../_shared/flow-data-provider.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

interface LoanFormRequest {
  token: string;
  contact_id?: string;
  contact_name: string;
  contact_phone?: string;
  new_contact: boolean;
  loan_type: 'money' | 'object';
  loan_detail: string;
  loan_concept?: string;
  date_option: 'tomorrow' | 'week' | 'month-end' | 'custom';
  custom_date?: string;
}

// Función para parsear número de teléfono
function parsePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');

  // Para números chilenos (56)
  if (cleaned.startsWith('56')) {
    return '+' + cleaned;
  }

  // Para números de 9 dígitos sin código país - asumir Chile
  if (cleaned.length === 9) {
    return '+56' + cleaned;
  }

  return '+' + cleaned;
}

// Función para calcular fecha según opción
function calculateDate(option: string, customDate?: string): string {
  if (option === 'custom' && customDate) {
    return customDate;
  }

  const today = new Date();
  let targetDate: Date;

  switch (option) {
    case 'tomorrow':
      targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + 1);
      break;
    case 'week':
      targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + 7);
      break;
    case 'month-end':
      targetDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      break;
    default:
      targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + 1);
  }

  // Formatear como YYYY-MM-DD sin conversión UTC
  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  const day = String(targetDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Validar token y extraer información
function parseToken(token: string): { tenantId: string; lenderContactId: string; timestamp: number } | null {
  try {
    // Format: loan_web_[tenant_id]_[lender_contact_id]_[timestamp]
    // OR: menu_[tenant_id]_[contact_id]_[timestamp]
    const parts = token.split('_');

    let tenantId: string;
    let lenderContactId: string;
    let timestamp: number;

    // Soporte para tokens de menú (menu_) y de formulario (loan_web_)
    if (parts[0] === 'menu' && parts.length >= 4) {
      // Token de menú: menu_[tenant_id]_[contact_id]_[timestamp]
      tenantId = parts[1];
      lenderContactId = parts[2];
      timestamp = parseInt(parts[3]);
    } else if (parts.length >= 5 && parts[0] === 'loan' && parts[1] === 'web') {
      // Token de formulario: loan_web_[tenant_id]_[lender_contact_id]_[timestamp]
      tenantId = parts[2];
      lenderContactId = parts[3];
      timestamp = parseInt(parts[4]);
    } else {
      console.error('Invalid token format:', token.substring(0, 30));
      return null;
    }

    // Validar que no haya expirado (1 hora)
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    if (now - timestamp > oneHour) {
      console.error('Token expired:', { timestamp, now, diff: now - timestamp });
      return null;
    }

    return { tenantId, lenderContactId, timestamp };
  } catch (error) {
    console.error('Error parsing token:', error);
    return null;
  }
}

serve(async (req: Request) => {
  try {
    const url = new URL(req.url);

    console.log('[LOAN_WEB_FORM] Request:', {
      method: req.method,
      pathname: url.pathname,
      search: url.search,
      fullUrl: req.url
    });

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // GET /contacts o GET /?token=xxx (con token query param indica que es contacts)
    const hasTokenParam = url.searchParams.has('token');
    const isContactsRequest = url.pathname.includes('/contacts') || (req.method === 'GET' && hasTokenParam);

    if (req.method === 'GET' && isContactsRequest) {
      console.log('[LOAN_WEB_FORM] GET request detected for contacts');

      const token = url.searchParams.get('token');
      console.log('[LOAN_WEB_FORM] Token received:', token ? token.substring(0, 30) + '...' : 'null');

      if (!token) {
        console.error('[LOAN_WEB_FORM] No token provided');
        return new Response(JSON.stringify({
          success: false,
          error: 'Token requerido'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('[LOAN_WEB_FORM] Parsing token...');
      const tokenData = parseToken(token);
      console.log('[LOAN_WEB_FORM] Token parsed:', tokenData ? 'success' : 'failed');

      if (!tokenData) {
        console.error('[LOAN_WEB_FORM] Token invalid or expired');
        return new Response(JSON.stringify({
          success: false,
          error: 'Token inválido o expirado'
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('[LOAN_WEB_FORM] Token data:', tokenData);

      try {
        console.log('[LOAN_WEB_FORM] Fetching contacts for tenant:', tokenData.tenantId);
        console.log('[LOAN_WEB_FORM] Excluding lender contact:', tokenData.lenderContactId);

        // Obtener contactos del tenant (excluir al lender)
        // Con join a contact_profiles para obtener phone_e164
        const { data: contacts, error: contactsError } = await supabase
          .from('tenant_contacts')
          .select('id, name, contact_profiles(phone_e164)')
          .eq('tenant_id', tokenData.tenantId)
          .neq('id', tokenData.lenderContactId)
          .order('name', { ascending: true })
          .limit(50);

        if (contactsError) {
          console.error('[LOAN_WEB_FORM] Database error:', contactsError);
          throw contactsError;
        }

        console.log('[LOAN_WEB_FORM] Found contacts:', contacts?.length || 0);

        const contactsList = (contacts || []).map(c => ({
          id: c.id,
          name: c.name,
          phone: c.contact_profiles?.phone_e164 || ''
        }));

        console.log('[LOAN_WEB_FORM] Returning contacts list');

        return new Response(JSON.stringify({
          success: true,
          contacts: contactsList
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('[LOAN_WEB_FORM] Error fetching contacts:', error);
        console.error('[LOAN_WEB_FORM] Error message:', error.message);
        console.error('[LOAN_WEB_FORM] Error stack:', error.stack);
        return new Response(JSON.stringify({
          success: false,
          error: `Error al obtener contactos: ${error.message}`
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // POST - Crear préstamo
    if (req.method === 'POST') {
      const body: LoanFormRequest = await req.json();

      console.log('[LOAN_WEB_FORM] Request received:', JSON.stringify(body, null, 2));

      // Validar token
      const tokenData = parseToken(body.token);

      if (!tokenData) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Token inválido o expirado'
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { tenantId, lenderContactId } = tokenData;

      // Validar datos requeridos
      if (!body.contact_name || !body.loan_type || !body.loan_detail || !body.date_option) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Faltan datos requeridos'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        // Preparar datos del préstamo
        let amount: number | null = null;
        let itemDescription: string;

        if (body.loan_type === 'money') {
          const cleaned = body.loan_detail.replace(/[.,\s]/g, '');
          const parsedAmount = parseInt(cleaned);

          if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Monto inválido'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          amount = parsedAmount;

          // Para préstamos de dinero, usar concepto si está presente, sino usar valor por defecto
          if (body.loan_concept && body.loan_concept.trim()) {
            itemDescription = body.loan_concept.trim();
          } else {
            itemDescription = 'Préstamo en efectivo';
          }
        } else {
          if (body.loan_detail.trim().length < 3) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Descripción muy corta (mínimo 3 caracteres)'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          itemDescription = body.loan_detail.trim();
        }

        // Calcular fecha de devolución
        const dueDate = calculateDate(body.date_option, body.custom_date);

        // Preparar contexto para FlowHandler
        const context: any = {
          loan_type: body.loan_type,
          due_date: dueDate,
          lender_contact_id: lenderContactId,
          item_description: itemDescription
        };

        if (amount !== null) {
          context.amount = amount;
        }

        // Procesar contacto
        if (body.new_contact) {
          // Nuevo contacto
          context.temp_contact_name = body.contact_name.trim();

          if (body.contact_phone && body.contact_phone.trim()) {
            context.new_contact_phone = parsePhoneNumber(body.contact_phone.trim());
          } else {
            context.new_contact_phone = null;
          }
        } else {
          // Contacto existente
          if (!body.contact_id) {
            return new Response(JSON.stringify({
              success: false,
              error: 'ID de contacto requerido'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          context.contact_id = body.contact_id;
          context.contact_info = body.contact_name.trim();
        }

        console.log('[LOAN_WEB_FORM] Context prepared:', context);

        // Usar FlowHandler existente para crear el préstamo
        const flowHandlers = new FlowHandlers(supabaseUrl, supabaseServiceKey);

        const result = await flowHandlers.handleNewLoanFlow(
          tenantId,
          lenderContactId,
          context
        );

        if (!result.success) {
          console.error('[LOAN_WEB_FORM] Flow handler error:', result.error);
          return new Response(JSON.stringify({
            success: false,
            error: result.error || 'Error al crear el préstamo'
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        console.log('[LOAN_WEB_FORM] Loan created successfully:', result.agreementId);

        // Registrar evento de formulario web completado
        await supabase
          .from('events')
          .insert({
            tenant_id: tenantId,
            contact_id: lenderContactId,
            agreement_id: result.agreementId,
            event_type: 'web_form_completed',
            payload: {
              form_type: 'loan_web',
              loan_type: body.loan_type,
              new_contact: body.new_contact
            }
          });

        return new Response(JSON.stringify({
          success: true,
          agreement_id: result.agreementId
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('[LOAN_WEB_FORM] Error creating loan:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error.message || 'Error interno del servidor'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({
      error: 'Método no permitido'
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Loan web form handler error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
