-- Migración 047: Simplificar ensure_user_tenant() - Ya NO copiar credenciales WhatsApp
-- Arquitectura: Solo el bot tiene credenciales, todos los mensajes se envían desde BOT_TENANT_ID

-- =====================================================
-- FUNCIÓN: ensure_user_tenant (v3 - sin copiar credenciales)
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

  -- 3. Crear tenant nuevo SIN credenciales WhatsApp
  -- Los mensajes se envían desde el BOT_TENANT_ID configurado como secret
  INSERT INTO tenants (
    name,
    owner_contact_profile_id,
    timezone
  ) VALUES (
    v_tenant_name,
    p_contact_profile_id,
    'America/Santiago'
  )
  RETURNING id INTO v_tenant_id;

  RAISE NOTICE '[ensure_user_tenant] Tenant creado: % - %', v_tenant_id, v_tenant_name;

  -- 4. Registrar evento de tenant creado
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
'v3 - Crea tenant de usuario SIN copiar credenciales WhatsApp. Los mensajes se envían desde BOT_TENANT_ID. Arquitectura simplificada.';

-- =====================================================
-- LOG
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE 'Migración 047 completada:';
  RAISE NOTICE '- Función ensure_user_tenant() actualizada (v3)';
  RAISE NOTICE '- YA NO copia whatsapp_phone_number_id ni whatsapp_access_token';
  RAISE NOTICE '- Arquitectura simplificada: solo bot envía mensajes';
  RAISE NOTICE '- Requiere BOT_TENANT_ID configurado como secret de Supabase';
END $$;

-- Fin de migración 047
