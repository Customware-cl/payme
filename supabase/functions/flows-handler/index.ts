// Edge Function: WhatsApp Flows Handler
// Procesa respuestas de WhatsApp Flows (Profile y Bank Accounts)

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Interfaces para respuestas de flows
interface ProfileFlowResponse {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
}

interface BankAccountFlowResponse {
  action: 'create' | 'update' | 'delete';
  account_id?: string;
  alias: string;
  bank_name: string;
  account_type: string;
  account_number: string;
  is_default: boolean;
}

interface FlowRequest {
  version: string;
  flow_token: string;
  screen: string;
  data: ProfileFlowResponse | BankAccountFlowResponse;
  flow_id?: string;
}

// Validación de email
function validateEmail(email: string): { valid: boolean; error?: string } {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: "Ingresa un correo válido (ej: nombre@gmail.com)" };
  }
  return { valid: true };
}

// Validación de nombre/apellido
function validateName(name: string, fieldName: string): { valid: boolean; error?: string } {
  const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{2,50}$/;
  if (!nameRegex.test(name)) {
    return { valid: false, error: `Ingresa un ${fieldName} válido (solo letras, 2-50 caracteres)` };
  }
  return { valid: true };
}

// Validación de número de cuenta
function validateAccountNumber(accountNumber: string): { valid: boolean; error?: string } {
  const accountRegex = /^\d{8,20}$/;
  if (!accountRegex.test(accountNumber)) {
    return { valid: false, error: "Número de cuenta inválido (solo números, 8-20 dígitos)" };
  }
  return { valid: true };
}

// Validación de alias
function validateAlias(alias: string): { valid: boolean; error?: string } {
  if (alias.length < 3 || alias.length > 30) {
    return { valid: false, error: "El alias debe tener entre 3 y 30 caracteres" };
  }
  return { valid: true };
}

// Handler para Flow de Perfil Personal
async function handleProfileFlow(
  data: ProfileFlowResponse,
  flowToken: string,
  supabase: any
): Promise<Response> {
  console.log('Processing profile flow:', data);

  // Validar datos
  const firstNameValidation = validateName(data.first_name, 'nombre');
  if (!firstNameValidation.valid) {
    return new Response(JSON.stringify({
      version: "7.2",
      screen: "PROFILE_FORM",
      data: { error: firstNameValidation.error }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  const lastNameValidation = validateName(data.last_name, 'apellido');
  if (!lastNameValidation.valid) {
    return new Response(JSON.stringify({
      version: "7.2",
      screen: "PROFILE_FORM",
      data: { error: lastNameValidation.error }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  const emailValidation = validateEmail(data.email);
  if (!emailValidation.valid) {
    return new Response(JSON.stringify({
      version: "7.2",
      screen: "PROFILE_FORM",
      data: { error: emailValidation.error }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  try {
    // Extraer contact_profile_id del flow_token
    // Format: profile_[tenant_id]_[contact_id]_[contact_profile_id]_[timestamp]
    const tokenParts = flowToken.split('_');
    if (tokenParts.length < 5 || tokenParts[0] !== 'profile') {
      throw new Error('Invalid flow token format');
    }

    const tenantId = tokenParts[1];
    const contactId = tokenParts[2];
    const contactProfileId = tokenParts[3];

    console.log('Updating profile:', { contactProfileId, tenantId, contactId });

    // Actualizar contact_profile
    const { error: updateError } = await supabase
      .from('contact_profiles')
      .update({
        first_name: data.first_name.trim(),
        last_name: data.last_name.trim(),
        email: data.email.trim().toLowerCase(),
        updated_at: new Date().toISOString()
      })
      .eq('id', contactProfileId);

    if (updateError) {
      console.error('Error updating profile:', updateError);
      throw updateError;
    }

    // Registrar evento
    await supabase
      .from('events')
      .insert({
        tenant_id: tenantId,
        contact_id: contactId,
        event_type: 'profile_updated',
        payload: {
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          source: 'whatsapp_flow'
        }
      });

    console.log('Profile updated successfully');

    // Respuesta de éxito
    return new Response(JSON.stringify({
      version: "7.2",
      screen: "SUCCESS",
      data: {
        extension_message_response: {
          params: {
            flow_token: flowToken
          }
        }
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in profile flow handler:', error);
    return new Response(JSON.stringify({
      version: "7.2",
      screen: "PROFILE_FORM",
      data: { error: "Hubo un error al guardar tu perfil. Por favor intenta de nuevo." }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handler para Flow de Datos Bancarios
async function handleBankAccountFlow(
  data: BankAccountFlowResponse,
  flowToken: string,
  supabase: any
): Promise<Response> {
  console.log('Processing bank account flow:', { action: data.action, data });

  try {
    // Extraer contact_profile_id del flow_token
    // Format: bank_[tenant_id]_[contact_id]_[contact_profile_id]_[timestamp]
    const tokenParts = flowToken.split('_');
    if (tokenParts.length < 5 || tokenParts[0] !== 'bank') {
      throw new Error('Invalid flow token format');
    }

    const tenantId = tokenParts[1];
    const contactId = tokenParts[2];
    const contactProfileId = tokenParts[3];

    console.log('Processing account action:', { action: data.action, contactProfileId });

    if (data.action === 'delete') {
      // Eliminar cuenta (soft delete)
      const { error: deleteError } = await supabase
        .from('bank_transfer_accounts')
        .update({ is_active: false })
        .eq('id', data.account_id)
        .eq('contact_profile_id', contactProfileId);

      if (deleteError) {
        console.error('Error deleting account:', deleteError);
        throw deleteError;
      }

      // Registrar evento
      await supabase
        .from('events')
        .insert({
          tenant_id: tenantId,
          contact_id: contactId,
          event_type: 'bank_account_deleted',
          payload: {
            account_id: data.account_id,
            source: 'whatsapp_flow'
          }
        });

      console.log('Account deleted successfully');

    } else if (data.action === 'update') {
      // Validar datos
      const aliasValidation = validateAlias(data.alias);
      if (!aliasValidation.valid) {
        return new Response(JSON.stringify({
          version: "7.2",
          screen: "ACCOUNT_FORM",
          data: { error: aliasValidation.error }
        }), { headers: { 'Content-Type': 'application/json' } });
      }

      const accountNumberValidation = validateAccountNumber(data.account_number);
      if (!accountNumberValidation.valid) {
        return new Response(JSON.stringify({
          version: "7.2",
          screen: "ACCOUNT_FORM",
          data: { error: accountNumberValidation.error }
        }), { headers: { 'Content-Type': 'application/json' } });
      }

      // Actualizar cuenta existente
      const { error: updateError } = await supabase
        .from('bank_transfer_accounts')
        .update({
          alias: data.alias.trim(),
          bank_name: data.bank_name,
          account_type: data.account_type,
          account_number: data.account_number.trim(),
          is_default: data.is_default,
          updated_at: new Date().toISOString()
        })
        .eq('id', data.account_id)
        .eq('contact_profile_id', contactProfileId);

      if (updateError) {
        console.error('Error updating account:', updateError);
        throw updateError;
      }

      // Registrar evento
      await supabase
        .from('events')
        .insert({
          tenant_id: tenantId,
          contact_id: contactId,
          event_type: 'bank_account_updated',
          payload: {
            account_id: data.account_id,
            alias: data.alias,
            bank_name: data.bank_name,
            source: 'whatsapp_flow'
          }
        });

      console.log('Account updated successfully');

    } else if (data.action === 'create') {
      // Validar datos
      const aliasValidation = validateAlias(data.alias);
      if (!aliasValidation.valid) {
        return new Response(JSON.stringify({
          version: "7.2",
          screen: "ACCOUNT_FORM",
          data: { error: aliasValidation.error }
        }), { headers: { 'Content-Type': 'application/json' } });
      }

      const accountNumberValidation = validateAccountNumber(data.account_number);
      if (!accountNumberValidation.valid) {
        return new Response(JSON.stringify({
          version: "7.2",
          screen: "ACCOUNT_FORM",
          data: { error: accountNumberValidation.error }
        }), { headers: { 'Content-Type': 'application/json' } });
      }

      // Crear nueva cuenta
      const { error: insertError } = await supabase
        .from('bank_transfer_accounts')
        .insert({
          contact_profile_id: contactProfileId,
          alias: data.alias.trim(),
          bank_name: data.bank_name,
          account_type: data.account_type,
          account_number: data.account_number.trim(),
          is_default: data.is_default,
          is_active: true
        });

      if (insertError) {
        console.error('Error creating account:', insertError);
        throw insertError;
      }

      // Registrar evento
      await supabase
        .from('events')
        .insert({
          tenant_id: tenantId,
          contact_id: contactId,
          event_type: 'bank_account_added',
          payload: {
            alias: data.alias,
            bank_name: data.bank_name,
            account_type: data.account_type,
            source: 'whatsapp_flow'
          }
        });

      console.log('Account created successfully');
    }

    // Respuesta de éxito
    return new Response(JSON.stringify({
      version: "7.2",
      screen: "SUCCESS",
      data: {
        extension_message_response: {
          params: {
            flow_token: flowToken
          }
        }
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in bank account flow handler:', error);
    return new Response(JSON.stringify({
      version: "7.2",
      screen: "ACCOUNT_FORM",
      data: { error: "Hubo un error al guardar tu cuenta. Por favor intenta de nuevo." }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

serve(async (req: Request) => {
  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
      return new Response('Method not allowed', {
        status: 405,
        headers: corsHeaders
      });
    }

    const body: FlowRequest = await req.json();
    console.log('Flow request received:', {
      version: body.version,
      screen: body.screen,
      flow_token: body.flow_token
    });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Determinar qué flow es basado en el flow_token
    const flowType = body.flow_token.split('_')[0];

    let response: Response;

    if (flowType === 'profile') {
      response = await handleProfileFlow(body.data as ProfileFlowResponse, body.flow_token, supabase);
    } else if (flowType === 'bank') {
      response = await handleBankAccountFlow(body.data as BankAccountFlowResponse, body.flow_token, supabase);
    } else {
      return new Response(JSON.stringify({
        error: 'Unknown flow type'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return response;

  } catch (error) {
    console.error('Flows handler error:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
