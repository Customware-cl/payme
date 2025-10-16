// Edge Function: create-received-loan
// Permite a un usuario registrar un préstamo que RECIBIÓ (donde él es el borrower)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { checkIfContactIsAppUser, findContactProfileByPhone } from '../_shared/user-detection.ts';
import { WhatsAppTemplates } from '../_shared/whatsapp-templates.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validar y decodificar token (soporta short y LLT)
async function parseToken(token: string, supabase: any): Promise<{ tenant_id: string; contact_id: string; user_id: string } | null> {
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

      // Obtener user_id desde la tabla users (owner del tenant)
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('tenant_id', tenant_id)
        .eq('role', 'owner')
        .single();

      const user_id = userData?.id;

      return { tenant_id, contact_id, user_id };

    } else if (parts[0] === 'menu' && parts.length === 4) {
      // Short token
      const tenant_id = parts[1];
      const contact_id = parts[2];
      const timestamp = parseInt(parts[3]);

      const now = Date.now();
      const tokenAge = now - timestamp;
      const oneHour = 60 * 60 * 1000;

      if (tokenAge > oneHour) {
        console.log('Short token expired');
        return null;
      }

      // Obtener user_id desde la tabla users (owner del tenant)
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('tenant_id', tenant_id)
        .eq('role', 'owner')
        .single();

      const user_id = userData?.id;

      return { tenant_id, contact_id, user_id };
    }

    console.error('Invalid token format');
    return null;
  } catch (error) {
    console.error('Error parsing token:', error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Crear cliente de Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parsear request
    const { lender, loan, token } = await req.json();

    console.log('[CREATE_RECEIVED_LOAN] Request:', { lender, loan, token: token?.substring(0, 20) });

    // Validar token
    if (!token) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Token requerido'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const tokenData = await parseToken(token, supabase);
    if (!tokenData) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Token inválido o expirado'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { tenant_id, contact_id, user_id } = tokenData;

    // Validar datos del préstamo
    if (!loan || !loan.due_date) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Datos del préstamo incompletos (due_date requerido)'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validar que tenga monto O descripción de objeto
    const hasAmount = loan.amount && loan.amount > 0;
    const hasItemDescription = loan.title || loan.description || loan.item_description;

    if (!hasAmount && !hasItemDescription) {
      return new Response(JSON.stringify({
        success: false,
        error: 'El préstamo debe tener un monto o una descripción del objeto'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validar datos del lender
    if (!lender || (!lender.contact_id && !lender.phone)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Debe proporcionar lender.contact_id o lender.phone + lender.name'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 1. Borrower soy YO (el usuario autenticado - viene del token)
    // No necesitamos crear un self_contact especial, ya existe como tenant_contact
    const borrower_tenant_contact_id = contact_id; // del token
    console.log('[CREATE_RECEIVED_LOAN] Borrower (YO):', borrower_tenant_contact_id);

    // 2. Lender es el contacto seleccionado (existente o nuevo)
    let lender_tenant_contact_id: string;
    let lender_contact_profile_id: string;

    if (lender.contact_id) {
      // Contacto existente en mis tenant_contacts
      console.log('[CREATE_RECEIVED_LOAN] Using existing lender contact:', lender.contact_id);
      lender_tenant_contact_id = lender.contact_id;

      // Obtener contact_profile_id
      const { data: lenderContact } = await supabase
        .from('tenant_contacts')
        .select('contact_profile_id')
        .eq('id', lender_tenant_contact_id)
        .single();

      lender_contact_profile_id = lenderContact?.contact_profile_id;

    } else {
      // Crear nuevo contacto (lender no está en mis contactos)
      console.log('[CREATE_RECEIVED_LOAN] Creating new lender contact:', lender);

      // Buscar o crear contact_profile
      let contactProfile = await findContactProfileByPhone(supabase, lender.phone);

      if (!contactProfile) {
        // No existe, crear nuevo
        const { data: newProfile, error: profileError } = await supabase
          .from('contact_profiles')
          .insert({
            phone_e164: lender.phone,
            first_name: lender.name,
            email: lender.email || null
          })
          .select()
          .single();

        if (profileError) {
          console.error('[CREATE_RECEIVED_LOAN] Error creating contact profile:', profileError);
          return new Response(JSON.stringify({
            success: false,
            error: 'Error al crear contacto'
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        contactProfile = newProfile;
      }

      lender_contact_profile_id = contactProfile.id;

      // Crear tenant_contact
      const { data: newTenantContact, error: tenantContactError } = await supabase
        .from('tenant_contacts')
        .insert({
          tenant_id: tenant_id,
          contact_profile_id: lender_contact_profile_id,
          name: lender.name,
          metadata: { created_from: 'received_loan' }
        })
        .select()
        .single();

      if (tenantContactError) {
        console.error('[CREATE_RECEIVED_LOAN] Error creating tenant contact:', tenantContactError);
        return new Response(JSON.stringify({
          success: false,
          error: 'Error al crear tenant contact'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      lender_tenant_contact_id = newTenantContact.id;
    }

    // Obtener nombre del lender para usar en títulos
    const { data: lenderContactData } = await supabase
      .from('tenant_contacts')
      .select('name')
      .eq('id', lender_tenant_contact_id)
      .single();

    const lenderName = lenderContactData?.name || 'contacto';

    // 3. Crear agreement
    console.log('[CREATE_RECEIVED_LOAN] Creating agreement...');

    // Determinar el tipo de préstamo y estructurar datos apropiadamente
    const isMoneyLoan = hasAmount; // Si tiene monto > 0, es dinero
    const agreementData: any = {
      tenant_id: tenant_id,
      tenant_contact_id: borrower_tenant_contact_id, // YO soy borrower
      lender_tenant_contact_id: lender_tenant_contact_id, // LENDER
      created_by: user_id,
      type: 'loan',
      start_date: loan.start_date || new Date().toISOString().split('T')[0],
      due_date: loan.due_date,
      status: 'active',
      metadata: {
        created_from: 'received_loan_form',
        loan_type: 'received',
        is_money_loan: isMoneyLoan
      }
    };

    if (isMoneyLoan) {
      // Préstamo de DINERO
      agreementData.amount = loan.amount;
      agreementData.currency = loan.currency || 'CLP';
      agreementData.title = loan.title || `Préstamo en efectivo de ${lenderName}`;
      agreementData.item_description = loan.title || 'Préstamo en efectivo';
      agreementData.description = loan.description || null;
    } else {
      // Préstamo de OBJETO
      agreementData.amount = null;
      agreementData.currency = null;
      agreementData.title = loan.title || `Préstamo de ${lenderName}`;
      agreementData.item_description = loan.title || loan.description || loan.item_description;
      agreementData.description = loan.description || loan.title || loan.item_description;
    }

    const { data: agreement, error: agreementError } = await supabase
      .from('agreements')
      .insert(agreementData)
      .select()
      .single();

    if (agreementError) {
      console.error('[CREATE_RECEIVED_LOAN] Error creating agreement:', agreementError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Error al crear préstamo'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[CREATE_RECEIVED_LOAN] Agreement created:', agreement.id);

    // 4. Viralidad: Detectar si lender es usuario y enviar notificación/invitación
    const userDetection = await checkIfContactIsAppUser(supabase, lender_contact_profile_id);

    // Obtener datos del borrower y lender para notificaciones
    const { data: borrowerContact } = await supabase
      .from('tenant_contacts')
      .select('name')
      .eq('id', borrower_tenant_contact_id)
      .single();

    const borrowerName = borrowerContact?.name || 'Un usuario';

    // Obtener teléfono y nombre del lender desde contact_profile
    const { data: lenderProfile } = await supabase
      .from('contact_profiles')
      .select('phone_e164, first_name, last_name')
      .eq('id', lender_contact_profile_id)
      .single();

    const lenderPhone = lenderProfile?.phone_e164;
    const lenderName = lender.name ||
                       [lenderProfile?.first_name, lenderProfile?.last_name].filter(Boolean).join(' ') ||
                       'Usuario';

    let invitationStatus = { sent: false, type: 'none' };

    if (userDetection.isUser) {
      // ESCENARIO A o B: Lender es usuario de la app
      console.log('[CREATE_RECEIVED_LOAN] Lender is app user, sending in-app notification');

      // Buscar el tenant_contact del lender en su propio tenant
      const { data: lenderOwnContact } = await supabase
        .from('tenant_contacts')
        .select('id')
        .eq('tenant_id', userDetection.tenant_id)
        .eq('contact_profile_id', lender_contact_profile_id)
        .single();

      let lenderContactIdInOwnTenant = lenderOwnContact?.id;

      // Si no existe, crear un self_contact para el lender en su propio tenant
      if (!lenderContactIdInOwnTenant) {
        console.log('[CREATE_RECEIVED_LOAN] Creating self_contact for lender in their own tenant');
        const { data: newSelfContact } = await supabase
          .from('tenant_contacts')
          .insert({
            tenant_id: userDetection.tenant_id,
            contact_profile_id: lender_contact_profile_id,
            name: userDetection.user_name || lenderName,
            metadata: { is_self: true, created_from: 'received_loan_notification' }
          })
          .select('id')
          .single();

        lenderContactIdInOwnTenant = newSelfContact?.id;
      }

      if (lenderContactIdInOwnTenant) {
        // Registrar evento de notificación
        const { error: eventError } = await supabase.from('events').insert({
          tenant_id: userDetection.tenant_id,
          contact_id: lenderContactIdInOwnTenant,
          agreement_id: agreement.id,
          event_type: 'button_clicked',
          payload: {
            type: 'loan_registered_by_borrower',
            borrower_name: borrowerName,
            amount: loan.amount,
            currency: loan.currency || 'CLP',
            message: `${borrowerName} registró un préstamo que recibió de ti`
          }
        });

        if (eventError) {
          console.error('[CREATE_RECEIVED_LOAN] Error creating event:', eventError);
          invitationStatus = { sent: false, type: 'in_app_notification', error: eventError.message };
        } else {
          invitationStatus = { sent: true, type: 'in_app_notification' };
        }
      } else {
        console.error('[CREATE_RECEIVED_LOAN] Could not find or create lender contact in their own tenant');
        invitationStatus = { sent: false, type: 'in_app_notification', error: 'Could not create contact' };
      }

    } else {
      // ESCENARIO C: Lender NO es usuario, enviar invitación por WhatsApp
      console.log('[CREATE_RECEIVED_LOAN] Lender is not app user, sending WhatsApp invitation');

      if (!lenderPhone) {
        console.error('[CREATE_RECEIVED_LOAN] Lender phone not available');
        invitationStatus = { sent: false, type: 'no_phone_available' };
      } else {
        // Obtener credenciales de WhatsApp del tenant
        const { data: tenant } = await supabase
          .from('tenants')
          .select('whatsapp_phone_number_id, whatsapp_access_token')
          .eq('id', tenant_id)
          .single();

        if (tenant?.whatsapp_phone_number_id && tenant?.whatsapp_access_token) {
          const whatsapp = new WhatsAppTemplates(
            tenant.whatsapp_phone_number_id,
            tenant.whatsapp_access_token
          );

          // TODO: Generar URL de invitación con pre-registro
          const invitationUrl = `https://app.payme.cl/register?ref=${lender_contact_profile_id}`;

          const result = await whatsapp.sendLoanInvitationTemplate(
            lenderPhone,
            lenderName,
            borrowerName,
            loan.amount,
            loan.currency || 'CLP',
            invitationUrl
          );

          if (result.success) {
            invitationStatus = { sent: true, type: 'whatsapp_invitation', messageId: result.messageId };
          } else {
            console.error('[CREATE_RECEIVED_LOAN] Error sending WhatsApp invitation:', result.error);
            invitationStatus = { sent: false, type: 'whatsapp_invitation', error: result.error };
          }
        } else {
          console.warn('[CREATE_RECEIVED_LOAN] WhatsApp not configured for tenant');
          invitationStatus = { sent: false, type: 'whatsapp_not_configured' };
        }
      }
    }

    // 5. Retornar respuesta
    return new Response(JSON.stringify({
      success: true,
      data: {
        agreement_id: agreement.id,
        borrower_contact_id: borrower_tenant_contact_id,
        lender_contact_id: lender_tenant_contact_id,
        invitation_status: invitationStatus,
        lender_is_user: userDetection.isUser
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[CREATE_RECEIVED_LOAN] Exception:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
