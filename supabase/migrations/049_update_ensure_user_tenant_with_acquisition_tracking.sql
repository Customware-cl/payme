-- Actualizar ensure_user_tenant para trackear origen de usuarios

CREATE OR REPLACE FUNCTION ensure_user_tenant(
  p_contact_profile_id UUID,
  p_invited_by_tenant_id UUID DEFAULT NULL,
  p_acquisition_type TEXT DEFAULT 'organic'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID;
  v_phone VARCHAR;
  v_first_name VARCHAR;
  v_last_name VARCHAR;
  v_tenant_name VARCHAR;
BEGIN
  -- 1. Buscar tenant existente del usuario
  SELECT id INTO v_tenant_id
  FROM tenants
  WHERE owner_contact_profile_id = p_contact_profile_id;

  -- Si ya tiene tenant, retornarlo
  IF v_tenant_id IS NOT NULL THEN
    RAISE NOTICE '[ensure_user_tenant] Tenant existente encontrado: %', v_tenant_id;
    RETURN v_tenant_id;
  END IF;

  -- 2. Obtener datos del contact_profile para nombrar el tenant
  SELECT phone_e164, first_name, last_name
  INTO v_phone, v_first_name, v_last_name
  FROM contact_profiles
  WHERE id = p_contact_profile_id;

  -- Construir nombre del tenant
  IF v_first_name IS NOT NULL AND v_last_name IS NOT NULL THEN
    v_tenant_name := v_first_name || ' ' || v_last_name;
  ELSIF v_phone IS NOT NULL THEN
    v_tenant_name := 'Cuenta de ' || v_phone;
  ELSE
    v_tenant_name := 'Usuario ' || substring(p_contact_profile_id::text from 1 for 8);
  END IF;

  -- 3. Crear tenant nuevo con tracking de origen
  INSERT INTO tenants (
    name,
    owner_contact_profile_id,
    timezone,
    invited_by_tenant_id,
    acquisition_type,
    welcome_message_sent
  ) VALUES (
    v_tenant_name,
    p_contact_profile_id,
    'America/Santiago',
    p_invited_by_tenant_id,
    p_acquisition_type,
    FALSE  -- Se marcará TRUE después de enviar mensaje de bienvenida
  )
  RETURNING id INTO v_tenant_id;

  RAISE NOTICE '[ensure_user_tenant] Tenant creado: % - % (type: %, invited_by: %)',
    v_tenant_id, v_tenant_name, p_acquisition_type, p_invited_by_tenant_id;

  -- 4. Registrar evento de tenant creado
  INSERT INTO events (
    tenant_id,
    event_type,
    payload
  ) VALUES (
    v_tenant_id,
    'opt_in_sent',
    jsonb_build_object(
      'action', 'tenant_created',
      'contact_profile_id', p_contact_profile_id,
      'tenant_name', v_tenant_name,
      'acquisition_type', p_acquisition_type,
      'invited_by_tenant_id', p_invited_by_tenant_id,
      'created_at', NOW()
    )
  );

  RETURN v_tenant_id;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '[ensure_user_tenant] Error creando tenant: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION ensure_user_tenant(UUID, UUID, TEXT) IS
'v4 - Crea tenant con tracking de origen (organic/invited) y referral tracking. Marca welcome_message_sent como FALSE para posterior envío de bienvenida.';
