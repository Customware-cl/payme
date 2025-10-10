// Edge Function: Menu Data Handler
// Maneja carga y guardado de datos de perfil y bancarios

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

      const tokenData = parseToken(token);
      if (!tokenData) {
        return new Response(JSON.stringify({ success: false, error: 'Token inválido o expirado' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('Loading data:', { type, contact_id: tokenData.contact_id });

      // Primero obtener el contact para ver su contact_profile_id
      const { data: contact } = await supabase
        .from('contacts')
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

      if (!profile) {
        // Si no existe, retornar vacío
        return new Response(JSON.stringify({
          success: true,
          contact_id: tokenData.contact_id,
          profile: null,
          bank_account: null
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (type === 'profile') {
        return new Response(JSON.stringify({
          success: true,
          contact_id: tokenData.contact_id,
          profile: {
            first_name: profile.first_name,
            last_name: profile.last_name,
            email: profile.email
          }
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
      } else if (type === 'loans') {
        // Obtener préstamos donde el usuario es el prestador (lent) o prestatario (borrowed)
        const { data: lentAgreements } = await supabase
          .from('lending_agreements')
          .select(`
            id,
            amount,
            item_description,
            due_date,
            status,
            created_at,
            borrower:contacts!lending_agreements_borrower_contact_id_fkey(id, name)
          `)
          .eq('lender_contact_id', tokenData.contact_id)
          .in('status', ['active', 'pending_confirmation'])
          .order('created_at', { ascending: false });

        const { data: borrowedAgreements } = await supabase
          .from('lending_agreements')
          .select(`
            id,
            amount,
            item_description,
            due_date,
            status,
            created_at,
            lender:contacts!lending_agreements_lender_contact_id_fkey(id, name)
          `)
          .eq('borrower_contact_id', tokenData.contact_id)
          .in('status', ['active', 'pending_confirmation'])
          .order('created_at', { ascending: false });

        return new Response(JSON.stringify({
          success: true,
          contact_id: tokenData.contact_id,
          loans: {
            lent: lentAgreements || [],
            borrowed: borrowedAgreements || []
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: false, error: 'Tipo no válido' }), {
        status: 400,
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

      const tokenData = parseToken(token);
      if (!tokenData) {
        return new Response(JSON.stringify({ success: false, error: 'Token inválido o expirado' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('Saving data:', { type, contact_id: tokenData.contact_id, data });

      // Primero obtener el contact
      const { data: contact } = await supabase
        .from('contacts')
        .select('contact_profile_id, phone_e164')
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
        // Crear nuevo profile y asociarlo al contact
        const { data: newProfile, error: createError } = await supabase
          .from('contact_profiles')
          .insert({
            phone_e164: contact.phone_e164
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

        // Actualizar el contact para que apunte al nuevo profile
        await supabase
          .from('contacts')
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
