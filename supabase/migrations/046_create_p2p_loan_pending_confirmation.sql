-- Migración 046: Crear préstamos con status 'pending_confirmation' en lugar de 'active'
-- Corrige flujo de confirmación: lender crea → borrower confirma → activo

-- =====================================================
-- ACTUALIZAR FUNCIÓN create_p2p_loan
-- =====================================================

CREATE OR REPLACE FUNCTION create_p2p_loan(
  p_my_tenant_id UUID,
  p_other_contact_id UUID,
  p_i_am_lender BOOLEAN,
  p_amount DECIMAL,
  p_title VARCHAR,
  p_description TEXT,
  p_due_date DATE,
  p_currency VARCHAR DEFAULT 'CLP'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_agreement_id UUID;
  v_other_profile_id UUID;
  v_other_tenant_id UUID;
  v_my_profile_id UUID;
  v_lender_tenant_id UUID;
  v_borrower_tenant_id UUID;
  v_reciprocal_contact_id UUID;
  v_reciprocal_name VARCHAR;
  v_created_by_user_id UUID;
BEGIN
  -- 1. Obtener contact_profile_id y contact_tenant_id de la otra persona
  SELECT contact_profile_id, contact_tenant_id
  INTO v_other_profile_id, v_other_tenant_id
  FROM tenant_contacts
  WHERE id = p_other_contact_id;

  IF v_other_profile_id IS NULL THEN
    RAISE EXCEPTION '[create_p2p_loan] Contact not found: %', p_other_contact_id;
  END IF;

  -- 2. Obtener contact_profile_id del tenant actual (mi perfil)
  SELECT owner_contact_profile_id
  INTO v_my_profile_id
  FROM tenants
  WHERE id = p_my_tenant_id;

  -- 2b. Obtener el owner user del tenant para created_by
  SELECT id
  INTO v_created_by_user_id
  FROM users
  WHERE tenant_id = p_my_tenant_id
    AND role = 'owner'
  LIMIT 1;

  IF v_created_by_user_id IS NULL THEN
    RAISE EXCEPTION '[create_p2p_loan] Owner user not found for tenant: %', p_my_tenant_id;
  END IF;

  -- 3. Determinar quién es lender y quién es borrower
  IF p_i_am_lender THEN
    v_lender_tenant_id := p_my_tenant_id;
    v_borrower_tenant_id := v_other_tenant_id;
  ELSE
    v_lender_tenant_id := v_other_tenant_id;
    v_borrower_tenant_id := p_my_tenant_id;
  END IF;

  RAISE NOTICE '[create_p2p_loan] Lender: %, Borrower: %, I am lender: %',
    v_lender_tenant_id, v_borrower_tenant_id, p_i_am_lender;

  -- 4. Crear contacto recíproco si el otro usuario tiene tenant
  IF v_other_tenant_id IS NOT NULL THEN
    -- Buscar si ya existe mi contacto en el tenant del otro usuario
    SELECT id INTO v_reciprocal_contact_id
    FROM tenant_contacts
    WHERE tenant_id = v_other_tenant_id
      AND contact_profile_id = v_my_profile_id;

    -- Si no existe, crearlo
    IF v_reciprocal_contact_id IS NULL THEN
      -- Obtener mi nombre desde mi contact_profile
      SELECT COALESCE(
        first_name || ' ' || COALESCE(last_name, ''),
        phone_e164,
        'Usuario ' || substring(v_my_profile_id::text from 1 for 8)
      )
      INTO v_reciprocal_name
      FROM contact_profiles
      WHERE id = v_my_profile_id;

      -- Crear mi contacto en el tenant del otro usuario
      INSERT INTO tenant_contacts (
        tenant_id,
        contact_profile_id,
        contact_tenant_id,
        name
      ) VALUES (
        v_other_tenant_id,
        v_my_profile_id,
        p_my_tenant_id,
        v_reciprocal_name
      )
      RETURNING id INTO v_reciprocal_contact_id;

      RAISE NOTICE '[create_p2p_loan] Contacto recíproco creado: %', v_reciprocal_contact_id;
    END IF;
  END IF;

  -- 5. Crear agreement con created_by y status 'pending_confirmation'
  INSERT INTO agreements (
    tenant_id,             -- LEGACY: mantener para compatibilidad (siempre mi tenant)
    tenant_contact_id,     -- LEGACY: mantener para compatibilidad (siempre el otro contacto)
    lender_tenant_id,      -- NUEVO: tenant del prestamista
    borrower_tenant_id,    -- NUEVO: tenant del prestatario
    created_by,            -- NUEVO: owner user del tenant que crea
    type,
    title,
    description,
    amount,
    currency,
    start_date,
    due_date,
    status
  ) VALUES (
    p_my_tenant_id,               -- Legacy: siempre mi tenant
    p_other_contact_id,           -- Legacy: siempre el otro contacto
    v_lender_tenant_id,           -- P2P: quien presta
    v_borrower_tenant_id,         -- P2P: quien recibe (puede ser NULL)
    v_created_by_user_id,         -- Usuario owner del tenant
    'loan',
    p_title,
    p_description,
    p_amount,
    p_currency,
    CURRENT_DATE,
    p_due_date,
    'pending_confirmation'        -- ✅ CAMBIO: Esperar confirmación del borrower
  )
  RETURNING id INTO v_agreement_id;

  RAISE NOTICE '[create_p2p_loan] Agreement creado: % con status pending_confirmation', v_agreement_id;

  -- 6. Registrar evento
  INSERT INTO events (
    tenant_id,
    agreement_id,
    event_type,
    payload
  ) VALUES (
    p_my_tenant_id,
    v_agreement_id,
    'opt_in_sent',
    jsonb_build_object(
      'action', 'p2p_loan_created',
      'i_am_lender', p_i_am_lender,
      'lender_tenant_id', v_lender_tenant_id,
      'borrower_tenant_id', v_borrower_tenant_id,
      'amount', p_amount,
      'currency', p_currency,
      'status', 'pending_confirmation',
      'created_at', NOW()
    )
  );

  RETURN v_agreement_id;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '[create_p2p_loan] Error: %', SQLERRM;
END;
$$;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE 'Migración 046 completada:';
  RAISE NOTICE '- Función create_p2p_loan actualizada';
  RAISE NOTICE '- Préstamos ahora se crean con status pending_confirmation';
  RAISE NOTICE '- Borrower debe confirmar para activar el préstamo';
END $$;

-- Fin de migración 046
