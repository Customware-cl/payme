-- Migración 042: Actualizar ensure_user_tenant() - Remover self-contact
-- Elimina la creación automática del contacto "Yo (Mi cuenta)" ya que es innecesario
-- con el modelo lender_tenant_id/borrower_tenant_id

-- =====================================================
-- FUNCIÓN: ensure_user_tenant (v2 - sin self-contact)
-- =====================================================

CREATE OR REPLACE FUNCTION ensure_user_tenant(
  p_contact_profile_id UUID
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
  v_whatsapp_phone_id VARCHAR;
  v_whatsapp_token TEXT;
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

  -- 2. Obtener credenciales de WhatsApp del tenant maestro (con token más antiguo)
  SELECT whatsapp_phone_number_id, whatsapp_access_token
  INTO v_whatsapp_phone_id, v_whatsapp_token
  FROM tenants
  WHERE whatsapp_access_token IS NOT NULL
  ORDER BY created_at ASC
  LIMIT 1;

  -- 3. Obtener datos del contact_profile para nombrar el tenant
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

  -- 4. Crear tenant nuevo con credenciales compartidas
  INSERT INTO tenants (
    name,
    owner_contact_profile_id,
    whatsapp_phone_number_id,
    whatsapp_access_token,
    timezone
  ) VALUES (
    v_tenant_name,
    p_contact_profile_id,
    v_whatsapp_phone_id,
    v_whatsapp_token,
    'America/Santiago'
  )
  RETURNING id INTO v_tenant_id;

  RAISE NOTICE '[ensure_user_tenant] Tenant creado: % - %', v_tenant_id, v_tenant_name;

  -- 5. Registrar evento de tenant creado
  INSERT INTO events (
    tenant_id,
    event_type,
    payload
  ) VALUES (
    v_tenant_id,
    'opt_in_sent', -- Reutilizamos tipo existente
    jsonb_build_object(
      'action', 'tenant_created',
      'contact_profile_id', p_contact_profile_id,
      'tenant_name', v_tenant_name,
      'created_at', NOW()
    )
  );

  -- NOTA: Ya NO creamos self-contact "Yo (Mi cuenta)"
  -- Con lender_tenant_id/borrower_tenant_id no es necesario

  RETURN v_tenant_id;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '[ensure_user_tenant] Error creando tenant: %', SQLERRM;
END;
$$;

-- =====================================================
-- COMENTARIOS
-- =====================================================

COMMENT ON FUNCTION ensure_user_tenant(UUID) IS
'Asegura que un contact_profile tenga su propio tenant. Si no existe, lo crea automáticamente con configuración por defecto. Ya NO crea self-contact.';

-- =====================================================
-- LOG
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE 'Migración 042 completada:';
  RAISE NOTICE '- Función ensure_user_tenant() actualizada';
  RAISE NOTICE '- Self-contact "Yo (Mi cuenta)" ya NO se crea';
  RAISE NOTICE '- Justificación: Con lender_tenant_id/borrower_tenant_id es innecesario';
END $$;

-- Fin de migración 042
