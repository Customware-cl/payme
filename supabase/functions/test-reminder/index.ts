// Edge Function: Test Reminder
// Función de prueba para enviar recordatorios de préstamos manualmente
// NO USAR EN PRODUCCIÓN - Solo para testing

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Obtener loan_id del body
    const { loan_id } = await req.json();

    if (!loan_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'loan_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🧪 Testing reminder for loan:', loan_id);

    // Obtener datos completos del préstamo
    const { data: agreement, error: agreementError } = await supabase
      .from('agreements')
      .select(`
        id, title, status, due_date, amount, item_description, type, tenant_id,
        tenant_contact_id, lender_tenant_contact_id, created_at,
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
      .eq('id', loan_id)
      .single();

    if (agreementError || !agreement) {
      return new Response(
        JSON.stringify({ success: false, error: 'Loan not found', details: agreementError }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📦 Agreement data:', {
      id: agreement.id,
      title: agreement.title,
      amount: agreement.amount,
      borrower: agreement.borrower?.name,
      lender: agreement.lender?.name
    });

    // Determinar template
    const isMoneyLoan = agreement.amount !== null;
    const templateName = isMoneyLoan ? 'due_date_money_v1' : 'due_date_object_v1';

    console.log('🎯 Using template:', templateName);

    // Obtener template
    const { data: template, error: templateError } = await supabase
      .from('templates')
      .select('*')
      .eq('meta_template_name', templateName)
      .is('tenant_id', null)
      .single();

    if (templateError || !template) {
      return new Response(
        JSON.stringify({ success: false, error: 'Template not found', template: templateName }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📋 Template found:', template.name);

    // Preparar variables
    const variables = prepareVariables(agreement, templateName);

    console.log('📝 Variables prepared:', variables.length, 'variables');

    // Separar variables del body y la URL del botón
    // La última variable es SIEMPRE la URL del botón
    const detailUrl = variables[variables.length - 1];
    const bodyVariables = variables.slice(0, -1); // Todas excepto la última

    console.log('📝 Body variables:', bodyVariables.length, 'URL button:', detailUrl.substring(0, 50) + '...');

    // Construir componentes del mensaje
    const components: any[] = [
      {
        type: 'body',
        parameters: bodyVariables.map((v: string) => ({ type: 'text', text: v }))
      }
    ];

    // Header
    if (template.header) {
      components.unshift({
        type: 'header',
        parameters: []
      });
    }

    // Botones
    if (template.button_config) {
      let buttonIndex = 0;

      // Quick Reply
      if (template.button_config.quick_replies) {
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

      // CTA URL
      if (template.button_config.cta_url) {
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

    console.log('🔧 Components built:', components.length, 'components');

    // Importar WhatsApp client
    const { sendWhatsAppMessage } = await import('../_shared/whatsapp-client.ts');

    // Enviar mensaje
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
      console.log('✅ Message sent successfully!');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Reminder sent successfully',
          data: {
            loan_id: agreement.id,
            borrower: agreement.borrower?.name,
            template: templateName,
            phone: agreement.borrower?.contact_profiles?.phone_e164
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.error('❌ Failed to send message:', messageResult.error);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to send message',
          details: messageResult.error
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('❌ Test reminder error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Función auxiliar para preparar variables
function prepareVariables(agreement: any, templateName: string): string[] {
  const variables: string[] = [];
  const dueDate = new Date(agreement.due_date);
  const createdDate = new Date(agreement.created_at);

  const formatAmount = (amount: number) => amount ? amount.toLocaleString('es-CL') : '0';

  const formatShortDate = (date: Date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  };

  const formatRUT = (rut: string) => {
    if (!rut) return 'Sin RUT';
    const clean = rut.replace(/[^0-9kK]/g, '');
    if (clean.length < 2) return rut;
    const dv = clean.slice(-1);
    const num = clean.slice(0, -1);
    return `${num.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`;
  };

  const generateLoanDetailToken = (tenantId: string, contactId: string) => {
    const timestamp = Date.now();
    return `menu_${tenantId}_${contactId}_${timestamp}`;
  };

  const generateDetailUrl = () => {
    const baseUrl = Deno.env.get('APP_BASE_URL') || 'https://tudominio.com';
    const token = generateLoanDetailToken(agreement.tenant_id, agreement.tenant_contact_id);
    return `${baseUrl}/menu/loan-detail.html?token=${token}&loan_id=${agreement.id}`;
  };

  const isMoneyTemplate = templateName === 'due_date_money_v1';
  const borrowerProfileName = agreement.borrower?.contact_profiles?.first_name || agreement.borrower?.name || 'Usuario';

  if (isMoneyTemplate) {
    // Template de dinero: 12 variables
    const lender = agreement.lender;
    const profile = lender?.contact_profiles;
    const bankAccount = profile?.bank_accounts?.[0];

    const bankInfo = {
      name: profile?.first_name && profile?.last_name
        ? `${profile.first_name} ${profile.last_name}`.trim()
        : (lender?.name || 'el prestamista'),
      rut: bankAccount?.rut ? formatRUT(bankAccount.rut) : 'No disponible',
      bank: bankAccount?.bank_name || 'No disponible',
      accountType: bankAccount?.account_type || 'No disponible',
      accountNumber: bankAccount?.account_number || 'No disponible',
      email: profile?.email || 'No disponible'
    };

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
    // Template de objeto: 6 variables
    variables.push(
      borrowerProfileName,
      agreement.item_description || agreement.title || 'objeto',
      agreement.lender?.name || 'el prestamista',
      formatShortDate(createdDate),
      agreement.title || 'préstamo',
      generateDetailUrl()
    );
  }

  return variables;
}
