// Edge Function: Generate Menu Token
// Genera tokens temporales para acceso al menú web

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { tenant_id, contact_id } = await req.json();

    if (!tenant_id || !contact_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'tenant_id y contact_id son requeridos'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Validar que el tenant existe
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', tenant_id)
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

    // Validar que el contacto existe
    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('id', contact_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (!contact) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Contacto no encontrado'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generar token único: menu_[tenant_id]_[contact_id]_[timestamp]
    const timestamp = Date.now();
    const token = `menu_${tenant_id}_${contact_id}_${timestamp}`;

    // URL del menú (puede configurarse con env var)
    const menuBaseUrl = Deno.env.get('NETLIFY_MENU_URL') || 'https://hilarious-brigadeiros-9b9834.netlify.app/menu';
    const menuUrl = `${menuBaseUrl}?token=${token}`;

    // Registrar evento
    await supabase
      .from('events')
      .insert({
        tenant_id: tenant_id,
        contact_id: contact_id,
        event_type: 'menu_token_generated',
        payload: {
          token: token,
          url: menuUrl,
          expires_in_seconds: 3600
        }
      });

    console.log('Menu token generated:', { contact_id, token, url: menuUrl });

    return new Response(JSON.stringify({
      success: true,
      data: {
        token: token,
        url: menuUrl,
        expires_in: 3600 // 1 hora
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error generating menu token:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
