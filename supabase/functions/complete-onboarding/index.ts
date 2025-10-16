// Edge Function: Complete Onboarding
// Completa el perfil de un nuevo usuario y crea su tenant automáticamente

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Validar y parsear token del menú
async function parseMenuToken(token: string, supabase: any): Promise<{ tenant_id: string; contact_id: string } | null> {
  try {
    const parts = token.split('_');

    // Long-Lived Token: menu_llt_[tenant]_[contact]_[uuid]_[timestamp]
    if (parts[0] === 'menu' && parts[1] === 'llt' && parts.length === 6) {
      const tenant_id = parts[2];
      const contact_id = parts[3];

      // Validar contra base de datos
      const { data: session, error } = await supabase
        .from('active_sessions')
        .select('*')
        .eq('token', token)
        .eq('revoked', false)
        .single();

      if (error || !session) {
        console.log('[ONBOARDING] LLT not found or revoked');
        return null;
      }

      // Verificar expiración
      const expiresAt = new Date(session.expires_at);
      if (expiresAt < new Date()) {
        console.log('[ONBOARDING] LLT expired');
        return null;
      }

      return { tenant_id, contact_id };
    }

    // Short token: menu_[tenant_id]_[contact_id]_[timestamp]
    if (parts[0] === 'menu' && parts.length === 4) {
      const tenant_id = parts[1];
      const contact_id = parts[2];
      const timestamp = parseInt(parts[3]);

      // Verificar expiración (1 hora)
      const now = Date.now();
      const tokenAge = now - timestamp;
      const oneHour = 60 * 60 * 1000;

      if (tokenAge > oneHour) {
        console.log('[ONBOARDING] Short token expired');
        return null;
      }

      return { tenant_id, contact_id };
    }

    return null;
  } catch (error) {
    console.error('[ONBOARDING] Error parsing token:', error);
    return null;
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { token, first_name, last_name, email } = await req.json();

    // Validaciones básicas
    if (!token || !first_name || !last_name || !email) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Datos incompletos. Se requiere: token, first_name, last_name, email'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Formato de email inválido'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validar nombres (2-50 caracteres, solo letras y espacios)
    const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{2,50}$/;
    if (!nameRegex.test(first_name) || !nameRegex.test(last_name)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Nombres deben tener entre 2-50 caracteres y solo contener letras'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Parsear token
    const tokenData = await parseMenuToken(token, supabase);
    if (!tokenData) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Token inválido o expirado'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[ONBOARDING] Starting onboarding for contact:', tokenData.contact_id);

    // 1. Obtener tenant_contact para conseguir el contact_profile_id
    const { data: tenantContact, error: tcError } = await supabase
      .from('tenant_contacts')
      .select('contact_profile_id, name')
      .eq('id', tokenData.contact_id)
      .single();

    if (tcError || !tenantContact) {
      console.error('[ONBOARDING] Tenant contact not found:', tcError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Contacto no encontrado'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const contactProfileId = tenantContact.contact_profile_id;

    // 2. Verificar si el usuario ya tiene tenant (no debería, pero por seguridad)
    const { data: existingTenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('owner_contact_profile_id', contactProfileId)
      .maybeSingle();

    if (existingTenant) {
      console.log('[ONBOARDING] User already has tenant:', existingTenant.id);
      return new Response(JSON.stringify({
        success: true,
        message: 'Usuario ya tiene tenant creado',
        tenant_id: existingTenant.id,
        already_exists: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. Actualizar contact_profile con los datos del perfil
    const { error: updateError } = await supabase
      .from('contact_profiles')
      .update({
        first_name,
        last_name,
        email
      })
      .eq('id', contactProfileId);

    if (updateError) {
      console.error('[ONBOARDING] Error updating contact_profile:', updateError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Error al actualizar perfil'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[ONBOARDING] Contact profile updated:', contactProfileId);

    // 4. Ejecutar ensure_user_tenant() para crear el tenant
    const { data: tenantResult, error: tenantError } = await supabase
      .rpc('ensure_user_tenant', { p_contact_profile_id: contactProfileId });

    if (tenantError) {
      console.error('[ONBOARDING] Error creating tenant:', tenantError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Error al crear tenant'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const newTenantId = tenantResult;
    console.log('[ONBOARDING] Tenant created:', newTenantId);

    // 5. Registrar evento de onboarding completado
    await supabase
      .from('events')
      .insert({
        tenant_id: newTenantId,
        contact_id: tokenData.contact_id,
        event_type: 'onboarding_completed',
        payload: {
          first_name,
          last_name,
          email,
          contact_profile_id: contactProfileId,
          completed_at: new Date().toISOString()
        }
      });

    console.log('[ONBOARDING] Onboarding completed successfully');

    return new Response(JSON.stringify({
      success: true,
      message: 'Onboarding completado exitosamente',
      data: {
        tenant_id: newTenantId,
        contact_profile_id: contactProfileId,
        name: `${first_name} ${last_name}`
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[ONBOARDING] Exception:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
