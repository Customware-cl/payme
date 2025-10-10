// Edge Function: Setup WhatsApp Flow Public Key
// Configura la clave pública en Meta Business Manager usando la API

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const wabaId = Deno.env.get('WHATSAPP_BUSINESS_ACCOUNT_ID');
    const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const publicKeyPem = Deno.env.get('WHATSAPP_FLOWS_PUBLIC_KEY');

    console.log('[SETUP] Starting Flow public key setup...');
    console.log('[SETUP] WABA ID:', wabaId ? `${wabaId.substring(0, 10)}...` : 'NOT SET');
    console.log('[SETUP] Access Token:', accessToken ? 'SET' : 'NOT SET');
    console.log('[SETUP] Public Key:', publicKeyPem ? 'SET' : 'NOT SET');

    if (!wabaId || !accessToken || !publicKeyPem) {
      return new Response(JSON.stringify({
        error: 'Missing required secrets',
        details: {
          has_waba_id: !!wabaId,
          has_access_token: !!accessToken,
          has_public_key: !!publicKeyPem
        },
        instructions: 'Set the following secrets in Supabase:\n- WHATSAPP_BUSINESS_ACCOUNT_ID\n- WHATSAPP_ACCESS_TOKEN\n- WHATSAPP_FLOWS_PUBLIC_KEY'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const action = new URL(req.url).searchParams.get('action') || 'set';

    if (action === 'get') {
      // Get current public key
      const url = `https://graph.facebook.com/v21.0/${wabaId}/whatsapp_business_encryption`;

      console.log('[SETUP] Getting current public key from Meta...');

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      });

      const result = await response.json();

      if (response.ok) {
        return new Response(JSON.stringify({
          success: true,
          action: 'get',
          data: result.data || [],
          message: result.data?.length > 0
            ? 'Public key is already configured'
            : 'No public key configured yet'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        throw new Error(`Meta API error: ${JSON.stringify(result)}`);
      }

    } else if (action === 'set') {
      // Set public key
      const url = `https://graph.facebook.com/v21.0/${wabaId}/whatsapp_business_encryption`;

      console.log('[SETUP] Setting public key on Meta...');
      console.log('[SETUP] URL:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          business_public_key: publicKeyPem
        })
      });

      const result = await response.json();

      if (response.ok) {
        console.log('[SETUP] ✅ Public key configured successfully!');

        return new Response(JSON.stringify({
          success: true,
          action: 'set',
          result,
          message: '✅ WhatsApp Flows public key configured successfully!',
          next_steps: [
            '1. Test your Flow by sending "hola" to WhatsApp',
            '2. Click on "👤 Mi Perfil"',
            '3. Verify the Flow opens (no blank screen)',
            '4. Complete the form and verify data is saved'
          ]
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        console.error('[SETUP] ❌ Error from Meta:', result);
        throw new Error(`Meta API error: ${JSON.stringify(result)}`);
      }
    } else {
      return new Response(JSON.stringify({
        error: 'Invalid action',
        valid_actions: ['get', 'set'],
        usage: 'Call with ?action=get or ?action=set'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('[SETUP] Error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      details: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
