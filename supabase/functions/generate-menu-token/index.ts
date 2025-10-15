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
    const { tenant_id, contact_id, token_type = 'short' } = await req.json();

    if (!tenant_id || !contact_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'tenant_id y contact_id son requeridos'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validar token_type
    if (!['short', 'llt'].includes(token_type)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'token_type debe ser "short" o "llt"'
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
      .from('tenant_contacts')
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

    // Generar token según tipo
    const timestamp = Date.now();
    let token: string;
    let expiresIn: number;
    let expiresAt: Date;

    if (token_type === 'llt') {
      // Long-Lived Token: 30 días
      const uuid = crypto.randomUUID();
      expiresIn = 30 * 24 * 60 * 60; // 30 días en segundos
      expiresAt = new Date(timestamp + (expiresIn * 1000));
      token = `menu_llt_${tenant_id}_${contact_id}_${uuid}_${timestamp}`;

      // Guardar en active_sessions
      await supabase
        .from('active_sessions')
        .insert({
          tenant_id: tenant_id,
          contact_id: contact_id,
          token: token,
          token_type: 'llt',
          expires_at: expiresAt.toISOString()
        });

    } else {
      // Short token (backward compatible): 1 hora
      expiresIn = 3600; // 1 hora
      expiresAt = new Date(timestamp + (expiresIn * 1000));
      token = `menu_${tenant_id}_${contact_id}_${timestamp}`;

      // Opcional: también guardar short tokens en active_sessions para consistencia
      // (comentado por ahora para mantener comportamiento actual)
      /*
      await supabase
        .from('active_sessions')
        .insert({
          tenant_id: tenant_id,
          contact_id: contact_id,
          token: token,
          token_type: 'short',
          expires_at: expiresAt.toISOString()
        });
      */
    }

    // URL del menú (puede configurarse con env var)
    const menuBaseUrl = Deno.env.get('NETLIFY_MENU_URL') || 'https://somospayme.cl/menu';
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
          token_type: token_type,
          expires_in_seconds: expiresIn,
          expires_at: expiresAt.toISOString()
        }
      });

    console.log('Menu token generated:', { contact_id, token_type, token, url: menuUrl, expires_in: expiresIn });

    return new Response(JSON.stringify({
      success: true,
      data: {
        token: token,
        url: menuUrl,
        token_type: token_type,
        expires_in: expiresIn,
        expires_at: expiresAt.toISOString()
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
