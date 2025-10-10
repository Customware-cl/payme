// Edge Function: Generate Loan Web Link
// Genera un link temporal para el formulario web de préstamos
// NO modifica wa_webhook - función standalone

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface GenerateLinkRequest {
  tenant_id: string;
  contact_id: string;
}

serve(async (req: Request) => {
  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Método no permitido'
      }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body: GenerateLinkRequest = await req.json();

    console.log('[GENERATE_LINK] Request:', { tenant_id: body.tenant_id, contact_id: body.contact_id });

    // Validar datos requeridos
    if (!body.tenant_id || !body.contact_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'tenant_id y contact_id son requeridos'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar que el tenant existe
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('id', body.tenant_id)
      .single();

    if (!tenant) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Tenant no encontrado'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verificar que el contacto existe y pertenece al tenant
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, name, tenant_id')
      .eq('id', body.contact_id)
      .eq('tenant_id', body.tenant_id)
      .single();

    if (!contact) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Contacto no encontrado o no pertenece al tenant'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generar token temporal
    // Formato: loan_web_[tenant_id]_[lender_contact_id]_[timestamp]
    const timestamp = Date.now();
    const webToken = `loan_web_${body.tenant_id}_${body.contact_id}_${timestamp}`;

    console.log('[GENERATE_LINK] Token generated:', webToken);

    // Construir URL del formulario (Netlify)
    const netlifyUrl = Deno.env.get('NETLIFY_LOAN_FORM_URL') || 'https://hilarious-brigadeiros-9b9834.netlify.app/loan-form';
    const formUrl = `${netlifyUrl}?token=${webToken}`;

    console.log('[GENERATE_LINK] Form URL:', formUrl);

    // Registrar evento de generación de link
    await supabase
      .from('events')
      .insert({
        tenant_id: body.tenant_id,
        contact_id: body.contact_id,
        event_type: 'web_form_link_generated',
        payload: {
          token: webToken,
          url: formUrl,
          generated_at: new Date().toISOString(),
          expires_at: new Date(timestamp + 60 * 60 * 1000).toISOString() // 1 hora
        }
      });

    // Respuesta exitosa
    return new Response(JSON.stringify({
      success: true,
      data: {
        url: formUrl,
        token: webToken,
        expires_in_seconds: 3600,
        expires_at: new Date(timestamp + 60 * 60 * 1000).toISOString(),
        contact_name: contact.name,
        tenant_name: tenant.name
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[GENERATE_LINK] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Error interno del servidor'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
