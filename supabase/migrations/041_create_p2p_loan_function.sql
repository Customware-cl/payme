-- Migración 041: Crear función create_p2p_loan()
-- Crea préstamos con sincronización automática entre tenants

-- =====================================================
-- FUNCIÓN: create_p2p_loan
-- =====================================================

CREATE OR REPLACE FUNCTION create_p2p_loan(
  p_lender_tenant_id UUID,
  p_borrower_contact_id UUID, -- tenant_contact_id del borrower en el tenant del lender
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
  v_borrower_profile_id UUID;
  v_borrower_tenant_id UUID;
  v_lender_profile_id UUID;
  v_lender_contact_in_borrower_tenant UUID;
  v_lender_name VARCHAR;
BEGIN
  -- 1. Obtener contact_profile_id y contact_tenant_id del borrower
  SELECT contact_profile_id, contact_tenant_id
  INTO v_borrower_profile_id, v_borrower_tenant_id
  FROM tenant_contacts
  WHERE id = p_borrower_contact_id;

  IF v_borrower_profile_id IS NULL THEN
    RAISE EXCEPTION '[create_p2p_loan] Borrower contact not found: %', p_borrower_contact_id;
  END IF;

  -- 2. Obtener contact_profile_id del lender (owner del tenant)
  SELECT owner_contact_profile_id
  INTO v_lender_profile_id
  FROM tenants
  WHERE id = p_lender_tenant_id;

  RAISE NOTICE '[create_p2p_loan] Lender: %, Borrower: %, Borrower tenant: %',
    p_lender_tenant_id, v_borrower_profile_id, v_borrower_tenant_id;

  -- 3. Si borrower tiene tenant, buscar/crear tenant_contact recíproco
  IF v_borrower_tenant_id IS NOT NULL THEN
    -- Buscar si ya existe tenant_contact del lender en tenant del borrower
    SELECT id INTO v_lender_contact_in_borrower_tenant
    FROM tenant_contacts
    WHERE tenant_id = v_borrower_tenant_id
      AND contact_profile_id = v_lender_profile_id;

    -- Si no existe, crearlo
    IF v_lender_contact_in_borrower_tenant IS NULL THEN
      -- Obtener nombre del lender desde su contact_profile
      SELECT COALESCE(
        first_name || ' ' || COALESCE(last_name, ''),
        phone_e164,
        'Usuario ' || substring(v_lender_profile_id::text from 1 for 8)
      )
      INTO v_lender_name
      FROM contact_profiles
      WHERE id = v_lender_profile_id;

      -- Crear tenant_contact del lender en tenant del borrower
      INSERT INTO tenant_contacts (
        tenant_id,
        contact_profile_id,
        contact_tenant_id,
        name
      ) VALUES (
        v_borrower_tenant_id,
        v_lender_profile_id,
        p_lender_tenant_id, -- El lender tiene su propio tenant
        v_lender_name
      )
      RETURNING id INTO v_lender_contact_in_borrower_tenant;

      RAISE NOTICE '[create_p2p_loan] Tenant contact recíproco creado: %', v_lender_contact_in_borrower_tenant;
    END IF;
  END IF;

  -- 4. Crear agreement
  INSERT INTO agreements (
    tenant_id,             -- LEGACY: mantener para compatibilidad
    tenant_contact_id,     -- LEGACY: mantener para compatibilidad
    lender_tenant_id,      -- NUEVO
    borrower_tenant_id,    -- NUEVO
    type,
    title,
    description,
    amount,
    currency,
    start_date,
    due_date,
    status
  ) VALUES (
    p_lender_tenant_id,           -- Legacy: tenant_id = lender
    p_borrower_contact_id,        -- Legacy: tenant_contact_id = borrower en tenant lender
    p_lender_tenant_id,
    v_borrower_tenant_id,         -- Puede ser NULL si borrower no está registrado
    'loan',
    p_title,
    p_description,
    p_amount,
    p_currency,
    CURRENT_DATE,
    p_due_date,
    'active'
  )
  RETURNING id INTO v_agreement_id;

  RAISE NOTICE '[create_p2p_loan] Agreement creado: %', v_agreement_id;

  -- 5. Registrar evento
  INSERT INTO events (
    tenant_id,
    agreement_id,
    event_type,
    payload
  ) VALUES (
    p_lender_tenant_id,
    v_agreement_id,
    'opt_in_sent', -- Reutilizamos tipo existente
    jsonb_build_object(
      'action', 'p2p_loan_created',
      'lender_tenant_id', p_lender_tenant_id,
      'borrower_tenant_id', v_borrower_tenant_id,
      'amount', p_amount,
      'currency', p_currency,
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
-- COMENTARIOS Y PERMISOS
-- =====================================================

COMMENT ON FUNCTION create_p2p_loan(UUID, UUID, DECIMAL, VARCHAR, TEXT, DATE, VARCHAR) IS
'Crea un préstamo P2P entre dos tenants. Auto-crea contactos recíprocos si es necesario. Mantiene compatibilidad con campos legacy.';

-- Permitir que edge functions llamen a esta función
GRANT EXECUTE ON FUNCTION create_p2p_loan(UUID, UUID, DECIMAL, VARCHAR, TEXT, DATE, VARCHAR) TO service_role;

-- =====================================================
-- TESTS BÁSICOS
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE 'Migración 041 completada:';
  RAISE NOTICE '- Función create_p2p_loan() creada';
  RAISE NOTICE '- Sincronización P2P habilitada';
  RAISE NOTICE '- Permisos asignados a service_role';
END $$;

-- Fin de migración 041
