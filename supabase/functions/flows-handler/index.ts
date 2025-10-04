// Edge Function: WhatsApp Flows Handler
// Procesa respuestas de WhatsApp Flows (Profile y Bank Accounts)
// Implementa encriptación AES-128-GCM con RSA-OAEP para seguridad

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptAesKey, decryptFlowData, encryptResponse } from "../_shared/whatsapp-flows-encryption.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Interfaces para respuestas de flows
interface ProfileFlowResponse {
  first_name: string;
  last_name: string;
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
  action?: string; // "ping" for health check
  flow_token?: string;
  screen?: string;
  data?: ProfileFlowResponse | BankAccountFlowResponse;
  flow_id?: string;
  encrypted_aes_key?: string;
  encrypted_flow_data?: string;
  initial_vector?: string;
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

// Helper function to create Flow response (encrypted or plain)
async function createFlowResponse(
  responseData: any,
  aesKey?: ArrayBuffer,
  iv?: string
): Promise<Response> {
  try {
    if (aesKey && iv) {
      // Encrypt response for production Flow
      console.log('[CRYPTO] Encrypting response...');
      const encryptedResponse = await encryptResponse(responseData, aesKey, iv);

      return new Response(encryptedResponse, {
        headers: { 'Content-Type': 'text/plain' }
      });
    } else {
      // Plain JSON response for testing/debugging
      console.log('[CRYPTO] Returning plain JSON response (testing mode)');
      return new Response(JSON.stringify(responseData), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('[CRYPTO] Error creating response:', error);
    throw error;
  }
}

// Handler para Flow de Perfil Personal
async function handleProfileFlow(
  data: ProfileFlowResponse,
  flowToken: string,
  supabase: any,
  aesKey?: ArrayBuffer,
  iv?: string
): Promise<Response> {
  console.log('Processing profile flow:', data);

  // Validar datos
  const firstNameValidation = validateName(data.first_name, 'nombre');
  if (!firstNameValidation.valid) {
    return createFlowResponse({
      version: "7.2",
      screen: "PROFILE_FORM",
      data: { error: firstNameValidation.error }
    }, aesKey, iv);
  }

  const lastNameValidation = validateName(data.last_name, 'apellido');
  if (!lastNameValidation.valid) {
    return createFlowResponse({
      version: "7.2",
      screen: "PROFILE_FORM",
      data: { error: lastNameValidation.error }
    }, aesKey, iv);
  }

  const emailValidation = validateEmail(data.email);
  if (!emailValidation.valid) {
    return createFlowResponse({
      version: "7.2",
      screen: "PROFILE_FORM",
      data: { error: emailValidation.error }
    }, aesKey, iv);
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

    // Respuesta de éxito encriptada
    return createFlowResponse({
      version: "7.2",
      screen: "SUCCESS",
      data: {
        extension_message_response: {
          params: {
            flow_token: flowToken
          }
        }
      }
    }, aesKey, iv);

  } catch (error) {
    console.error('Error in profile flow handler:', error);
    return createFlowResponse({
      version: "7.2",
      screen: "PROFILE_FORM",
      data: { error: "Hubo un error al guardar tu perfil. Por favor intenta de nuevo." }
    }, aesKey, iv);
  }
}

// Handler para Flow de Datos Bancarios
async function handleBankAccountFlow(
  data: BankAccountFlowResponse,
  flowToken: string,
  supabase: any,
  aesKey?: ArrayBuffer,
  iv?: string
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
        return createFlowResponse({
          version: "7.2",
          screen: "ACCOUNT_FORM",
          data: { error: aliasValidation.error }
        }, aesKey, iv);
      }

      const accountNumberValidation = validateAccountNumber(data.account_number);
      if (!accountNumberValidation.valid) {
        return createFlowResponse({
          version: "7.2",
          screen: "ACCOUNT_FORM",
          data: { error: accountNumberValidation.error }
        }, aesKey, iv);
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
        return createFlowResponse({
          version: "7.2",
          screen: "ACCOUNT_FORM",
          data: { error: aliasValidation.error }
        }, aesKey, iv);
      }

      const accountNumberValidation = validateAccountNumber(data.account_number);
      if (!accountNumberValidation.valid) {
        return createFlowResponse({
          version: "7.2",
          screen: "ACCOUNT_FORM",
          data: { error: accountNumberValidation.error }
        }, aesKey, iv);
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

    // Respuesta de éxito encriptada
    return createFlowResponse({
      version: "7.2",
      screen: "SUCCESS",
      data: {
        extension_message_response: {
          params: {
            flow_token: flowToken
          }
        }
      }
    }, aesKey, iv);

  } catch (error) {
    console.error('Error in bank account flow handler:', error);
    return createFlowResponse({
      version: "7.2",
      screen: "ACCOUNT_FORM",
      data: { error: "Hubo un error al guardar tu cuenta. Por favor intenta de nuevo." }
    }, aesKey, iv);
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

    // Parse request body first
    const body: FlowRequest = await req.json();
    console.log('[FLOW] Request received - FULL BODY:', JSON.stringify(body, null, 2));
    console.log('[FLOW] Request summary:', {
      version: body.version,
      action: body.action,
      screen: body.screen,
      flow_token: body.flow_token,
      has_encrypted_data: !!body.encrypted_flow_data
    });

    // Health check (ping) - respond without encryption (before checking private key)
    // Un request es health check si:
    // 1. Tiene action: "ping", O
    // 2. No tiene flow_token Y no tiene datos (ni data ni encrypted_flow_data)
    const isHealthCheck = body.action === 'ping' ||
                         (!body.flow_token && !body.data && !body.encrypted_flow_data);

    if (isHealthCheck) {
      console.log('[FLOW] Health check detected - responding with status active');
      return new Response(JSON.stringify({
        version: body.version || "7.2",
        data: {
          status: "active"
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Si no es health check, necesitamos private key
    console.log('[FLOW] Processing Flow request - checking for private key...');
    const privateKey = Deno.env.get('WHATSAPP_FLOWS_PRIVATE_KEY');
    if (!privateKey) {
      console.error('[CRYPTO] WHATSAPP_FLOWS_PRIVATE_KEY not found in environment');
      return new Response(JSON.stringify({
        error: 'Server configuration error'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let flowData: any;
    let flowToken: string;
    let aesKey: ArrayBuffer | undefined;
    let iv: string | undefined;

    // For encrypted requests, decrypt first
    if (body.encrypted_flow_data && body.encrypted_aes_key && body.initial_vector) {
      console.log('[CRYPTO] Encrypted request detected - decrypting...');

      try {
        // 1. Decrypt AES key using RSA private key
        aesKey = await decryptAesKey(body.encrypted_aes_key, privateKey);
        console.log('[CRYPTO] AES key decrypted');

        // 2. Decrypt flow data using AES-GCM
        const decryptedData = await decryptFlowData(
          body.encrypted_flow_data,
          aesKey,
          body.initial_vector
        );
        console.log('[CRYPTO] Flow data decrypted:', decryptedData);

        // Check if decrypted data is a health check (ping)
        if (decryptedData.action === 'ping') {
          console.log('[FLOW] Health check (ping) detected in encrypted request');

          // Respond with encrypted ping response
          const pingResponse = {
            version: decryptedData.version || "3.0",
            data: {
              status: "active"
            }
          };

          const encryptedPingResponse = await encryptResponse(
            pingResponse,
            aesKey,
            body.initial_vector
          );

          return new Response(encryptedPingResponse, {
            status: 200,
            headers: { 'Content-Type': 'text/plain' }
          });
        }

        // Extract flow_token and data from decrypted payload
        flowToken = decryptedData.flow_token;
        flowData = decryptedData.data;
        iv = body.initial_vector;

      } catch (error) {
        console.error('[CRYPTO] Decryption error:', error);
        return new Response(JSON.stringify({
          error: 'Failed to decrypt request'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else {
      // Non-encrypted request (testing mode)
      console.log('[FLOW] Plain request (testing mode)');

      if (!body.flow_token || !body.data) {
        console.error('[FLOW] Missing required fields for Flow:', {
          flow_token: body.flow_token,
          has_data: !!body.data,
          full_body: JSON.stringify(body)
        });
        return new Response(JSON.stringify({
          error: 'Missing flow_token or data'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      flowToken = body.flow_token;
      flowData = body.data;
      // aesKey and iv remain undefined (plain mode)
    }

    // Validar que tenemos flow_token
    if (!flowToken) {
      console.error('[FLOW] Missing flow_token after processing');
      return new Response(JSON.stringify({
        error: 'Missing flow_token'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Determinar qué flow es basado en el flow_token
    const flowType = flowToken.split('_')[0];

    let response: Response;

    if (flowType === 'profile') {
      response = await handleProfileFlow(flowData as ProfileFlowResponse, flowToken, supabase, aesKey, iv);
    } else if (flowType === 'bank') {
      response = await handleBankAccountFlow(flowData as BankAccountFlowResponse, flowToken, supabase, aesKey, iv);
    } else {
      // Error response (plain JSON - testing mode)
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
