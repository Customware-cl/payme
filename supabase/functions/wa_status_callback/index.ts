// Edge Function: WhatsApp Status Callback
// Versión simplificada para deployment inicial

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// Funciones auxiliares
function verifyWebhookToken(mode: string, token: string, challenge: string, verifyToken: string): string | null {
  if (mode === 'subscribe' && token === verifyToken) {
    return challenge;
  }
  return null;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    // GET: Webhook verification (mismo que wa_webhook)
    if (req.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      const verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN');
      if (!verifyToken) {
        console.error('WHATSAPP_VERIFY_TOKEN not configured');
        return new Response('Forbidden', { status: 403, headers: corsHeaders });
      }

      const result = verifyWebhookToken(mode!, token!, challenge!, verifyToken);

      if (result) {
        console.log('Status webhook verification successful');
        return new Response(result, {
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
        });
      } else {
        console.warn('Status webhook verification failed', { mode, token });
        return new Response('Forbidden', { status: 403, headers: corsHeaders });
      }
    }

    // POST: Process status updates
    if (req.method === 'POST') {
      const body = await req.text();
      const data = JSON.parse(body);

      console.log('Status webhook received:', JSON.stringify(data, null, 2));

      // Initialize Supabase client
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      let processedStatuses = 0;

      // Process each entry
      for (const entry of data.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field === 'messages') {
            // Process status updates
            for (const status of change.value.statuses || []) {
              console.log('Processing status update:', status);

              // Update message status in database
              const { error } = await supabase
                .from('whatsapp_messages')
                .update({
                  status: status.status,
                  ...(status.status === 'delivered' && {
                    delivered_at: new Date(parseInt(status.timestamp) * 1000).toISOString()
                  }),
                  ...(status.status === 'read' && {
                    read_at: new Date(parseInt(status.timestamp) * 1000).toISOString()
                  })
                })
                .eq('wa_message_id', status.id);

              if (error) {
                console.error('Error updating message status:', error);
              } else {
                processedStatuses++;
              }
            }
          }
        }
      }

      const response = {
        success: true,
        processed_statuses: processedStatuses
      };

      console.log('Status webhook processing completed:', response);

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response('Method not allowed', {
      status: 405,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Status webhook processing failed:', error);

    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});