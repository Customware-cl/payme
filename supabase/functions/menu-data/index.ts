// Edge Function: Menu Data Handler
// Maneja carga y guardado de datos de perfil y bancarios

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// Validar y decodificar token (soporta short y LLT)
async function parseToken(token: string, supabase: any): Promise<{ tenant_id: string; contact_id: string; timestamp: number; token_type: string } | null> {
  try {
    const parts = token.split('_');

    // Detectar tipo de token
    if (parts[0] === 'menu' && parts[1] === 'llt') {
      // Long-Lived Token: menu_llt_[tenant]_[contact]_[uuid]_[timestamp]
      if (parts.length !== 6) {
        console.error('Invalid LLT format');
        return null;
      }

      const tenant_id = parts[2];
      const contact_id = parts[3];
      // parts[4] es el UUID
      const timestamp = parseInt(parts[5]);

      // Validar contra base de datos
      const { data: session, error } = await supabase
        .from('active_sessions')
        .select('*')
        .eq('token', token)
        .eq('revoked', false)
        .single();

      if (error || !session) {
        console.log('LLT not found in database or revoked');
        return null;
      }

      // Verificar expiración
      const expiresAt = new Date(session.expires_at);
      if (expiresAt < new Date()) {
        console.log('LLT expired:', { expires_at: session.expires_at });
        return null;
      }

      // Actualizar last_used_at
      await supabase
        .from('active_sessions')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', session.id);

      return { tenant_id, contact_id, timestamp, token_type: 'llt' };

    } else if (parts[0] === 'menu' && parts.length === 4) {
      // Short token (backward compatible): menu_[tenant_id]_[contact_id]_[timestamp]
      const tenant_id = parts[1];
      const contact_id = parts[2];
      const timestamp = parseInt(parts[3]);

      // Verificar expiración (1 hora)
      const now = Date.now();
      const tokenAge = now - timestamp;
      const oneHour = 60 * 60 * 1000;

      if (tokenAge > oneHour) {
        console.log('Short token expired:', { tokenAge, oneHour });
        return null;
      }

      return { tenant_id, contact_id, timestamp, token_type: 'short' };

    } else {
      console.error('Invalid token format');
      return null;
    }
  } catch (error) {
    console.error('Error parsing token:', error);
    return null;
  }
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

    // GET: Obtener datos (perfil o banco)
    if (req.method === 'GET') {
      const token = url.searchParams.get('token');
      const type = url.searchParams.get('type'); // 'profile' o 'bank'

      if (!token) {
        return new Response(JSON.stringify({ success: false, error: 'Token requerido' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const tokenData = await parseToken(token, supabase);
      if (!tokenData) {
        return new Response(JSON.stringify({ success: false, error: 'Token inválido o expirado' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('Loading data:', { type, contact_id: tokenData.contact_id });

      // Para obtener nombre de usuario y detectar si requiere onboarding
      if (type === 'user') {
        const { data: contact } = await supabase
          .from('tenant_contacts')
          .select('name, contact_profile_id')
          .eq('id', tokenData.contact_id)
          .single();

        // Detectar si el usuario requiere onboarding (no tiene tenant propio)
        let requiresOnboarding = false;
        let hasProfileData = false;
        let userName = contact?.name || 'Usuario';

        if (contact?.contact_profile_id) {
          // Verificar si tiene tenant propio
          const { data: userTenant } = await supabase
            .from('tenants')
            .select('id')
            .eq('owner_contact_profile_id', contact.contact_profile_id)
            .maybeSingle();

          requiresOnboarding = !userTenant;

          // Obtener datos del contact_profile
          const { data: profile } = await supabase
            .from('contact_profiles')
            .select('first_name, last_name, email')
            .eq('id', contact.contact_profile_id)
            .single();

          if (profile) {
            hasProfileData = !!(profile.first_name && profile.last_name && profile.email);

            // Usar solo el primer nombre del contact_profile si existe
            if (profile.first_name) {
              userName = profile.first_name;
            }
          }
        }

        console.log('[MENU_DATA] User check:', {
          contact_id: tokenData.contact_id,
          user_name: userName,
          requires_onboarding: requiresOnboarding,
          has_profile_data: hasProfileData
        });

        return new Response(JSON.stringify({
          success: true,
          contact_id: tokenData.contact_id,
          name: userName,
          requires_onboarding: requiresOnboarding,
          has_profile_data: hasProfileData
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Para préstamos, no necesitamos el profile
      if (type === 'loans') {
        // Obtener contact_profile_id del usuario para búsquedas cross-tenant
        const { data: userContact } = await supabase
          .from('tenant_contacts')
          .select('contact_profile_id')
          .eq('id', tokenData.contact_id)
          .single();

        const userProfileId = userContact?.contact_profile_id;

        // Obtener préstamos donde el usuario es el prestador (lent)
        // Estos están en MI tenant, así que buscar por lender_tenant_contact_id directo
        const { data: lentAgreements } = await supabase
          .from('agreements')
          .select(`
            id,
            amount,
            item_description,
            due_date,
            status,
            created_at,
            borrower:tenant_contacts!tenant_contact_id(id, name)
          `)
          .eq('lender_tenant_contact_id', tokenData.contact_id)
          .in('status', ['active', 'pending_confirmation'])
          .order('created_at', { ascending: false });

        // Obtener préstamos donde el usuario es el prestatario (borrowed)
        // Estos pueden estar en OTROS tenants, necesitamos buscar por contact_profile_id
        let borrowedAgreements = [];

        if (userProfileId) {
          // Paso 1: Obtener todos los tenant_contacts que representan a este usuario (en todos los tenants)
          const { data: allUserContacts } = await supabase
            .from('tenant_contacts')
            .select('id')
            .eq('contact_profile_id', userProfileId);

          const contactIds = (allUserContacts || []).map(c => c.id);

          // Paso 2: Buscar agreements donde el borrower es alguno de esos tenant_contacts
          if (contactIds.length > 0) {
            const { data: agreements } = await supabase
              .from('agreements')
              .select(`
                id,
                amount,
                item_description,
                due_date,
                status,
                created_at,
                lender:tenant_contacts!lender_tenant_contact_id(id, name)
              `)
              .in('tenant_contact_id', contactIds)
              .in('status', ['active', 'pending_confirmation'])
              .order('created_at', { ascending: false });

            borrowedAgreements = agreements || [];
          }
        }

        console.log('[MENU_DATA] Loans loaded:', {
          lent: lentAgreements?.length || 0,
          borrowed: borrowedAgreements.length
        });

        return new Response(JSON.stringify({
          success: true,
          contact_id: tokenData.contact_id,
          loans: {
            lent: lentAgreements || [],
            borrowed: borrowedAgreements
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Para profile y bank, necesitamos cargar el contact_profile
      // Primero obtener el tenant_contact para ver su contact_profile_id
      const { data: contact } = await supabase
        .from('tenant_contacts')
        .select('contact_profile_id')
        .eq('id', tokenData.contact_id)
        .single();

      let profile = null;
      if (contact?.contact_profile_id) {
        // Si el contact tiene un profile, cargarlo
        const { data: profileData } = await supabase
          .from('contact_profiles')
          .select('*')
          .eq('id', contact.contact_profile_id)
          .single();

        profile = profileData;
      }

      if (type === 'profile') {
        return new Response(JSON.stringify({
          success: true,
          contact_id: tokenData.contact_id,
          profile: profile ? {
            first_name: profile.first_name,
            last_name: profile.last_name,
            email: profile.email
          } : null
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else if (type === 'bank') {
        // Obtener primera cuenta bancaria (por ahora solo soportamos una)
        const bankAccount = profile.bank_accounts && profile.bank_accounts.length > 0
          ? profile.bank_accounts[0]
          : null;

        return new Response(JSON.stringify({
          success: true,
          contact_id: tokenData.contact_id,
          bank_account: bankAccount
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Si no existe profile para profile/bank, retornar vacío
      return new Response(JSON.stringify({
        success: true,
        contact_id: tokenData.contact_id,
        profile: null,
        bank_account: null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST: Guardar datos (perfil o banco)
    if (req.method === 'POST') {
      const body = await req.json();
      const { token, type, data } = body;

      if (!token || !type || !data) {
        return new Response(JSON.stringify({ success: false, error: 'Datos incompletos' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const tokenData = await parseToken(token, supabase);
      if (!tokenData) {
        return new Response(JSON.stringify({ success: false, error: 'Token inválido o expirado' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('Saving data:', { type, contact_id: tokenData.contact_id, data });

      // Primero obtener el tenant_contact con join a contact_profiles para phone_e164
      const { data: contact } = await supabase
        .from('tenant_contacts')
        .select('contact_profile_id, contact_profiles(phone_e164)')
        .eq('id', tokenData.contact_id)
        .single();

      if (!contact) {
        return new Response(JSON.stringify({ success: false, error: 'Contacto no encontrado' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Obtener o crear contact_profile
      let profile = null;
      if (contact.contact_profile_id) {
        // Si ya tiene profile, cargarlo
        const { data: existingProfile } = await supabase
          .from('contact_profiles')
          .select('*')
          .eq('id', contact.contact_profile_id)
          .single();

        profile = existingProfile;
      } else {
        // Crear nuevo profile y asociarlo al tenant_contact
        const phoneE164 = contact.contact_profiles?.phone_e164;

        if (!phoneE164) {
          return new Response(JSON.stringify({ success: false, error: 'Teléfono no encontrado' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { data: newProfile, error: createError } = await supabase
          .from('contact_profiles')
          .insert({
            phone_e164: phoneE164
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating profile:', createError);
          return new Response(JSON.stringify({ success: false, error: 'Error al crear perfil' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Actualizar el tenant_contact para que apunte al nuevo profile
        await supabase
          .from('tenant_contacts')
          .update({ contact_profile_id: newProfile.id })
          .eq('id', tokenData.contact_id);

        profile = newProfile;
      }

      if (type === 'profile') {
        // Actualizar datos de perfil
        const { error: updateError } = await supabase
          .from('contact_profiles')
          .update({
            first_name: data.first_name,
            last_name: data.last_name,
            email: data.email
          })
          .eq('id', profile.id);

        if (updateError) {
          console.error('Error updating profile:', updateError);
          return new Response(JSON.stringify({ success: false, error: 'Error al guardar perfil' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } else if (type === 'bank') {
        // Guardar/actualizar datos bancarios (solo primera cuenta por ahora)
        const bankAccount = {
          rut: data.rut,
          bank_name: data.bank_name,
          account_type: data.account_type,
          account_number: data.account_number,
          account_holder_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || null
        };

        const { error: updateError } = await supabase
          .from('contact_profiles')
          .update({
            bank_accounts: [bankAccount]
          })
          .eq('id', profile.id);

        if (updateError) {
          console.error('Error updating bank details:', updateError);
          return new Response(JSON.stringify({ success: false, error: 'Error al guardar datos bancarios' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: false, error: 'Tipo no válido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: false, error: 'Método no permitido' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in menu-data function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
