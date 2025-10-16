-- Migración 027: Soporte para Self-Contact (Registrar préstamos recibidos)
-- Permite que un usuario se represente a sí mismo como tenant_contact
-- Uso: Registrar "Pedro me prestó $1000" donde YO soy el borrower

-- =====================================================
-- 1. AGREGAR COMENTARIOS ACLARATORIOS EN AGREEMENTS
-- =====================================================

COMMENT ON COLUMN agreements.tenant_contact_id IS 'Borrower (prestatario): Quién recibe el préstamo. Puede ser self_contact si registro préstamo recibido';
COMMENT ON COLUMN agreements.lender_tenant_contact_id IS 'Lender (prestamista): Quién presta. NULL = owner del tenant presta (legacy)';
COMMENT ON COLUMN agreements.created_by IS 'Usuario que creó el registro en el sistema';

-- =====================================================
-- 2. ÍNDICE PARA SELF CONTACTS
-- =====================================================

-- Índice para buscar el self_contact de un tenant rápidamente
CREATE INDEX IF NOT EXISTS idx_tenant_contacts_is_self
ON tenant_contacts((metadata->>'is_self'))
WHERE (metadata->>'is_self')::boolean = true;

-- =====================================================
-- 3. FUNCIÓN: GET OR CREATE SELF CONTACT
-- =====================================================

CREATE OR REPLACE FUNCTION get_or_create_self_contact(
  p_tenant_id UUID,
  p_user_id UUID
) RETURNS UUID AS $$
DECLARE
  v_self_contact_id UUID;
  v_contact_profile_id UUID;
  v_user_phone VARCHAR;
  v_user_first_name VARCHAR;
  v_user_last_name VARCHAR;
  v_user_email VARCHAR;
  v_full_name VARCHAR;
BEGIN
  -- 1. Buscar si ya existe self_contact para este tenant
  SELECT tc.id INTO v_self_contact_id
  FROM tenant_contacts tc
  WHERE tc.tenant_id = p_tenant_id
    AND (tc.metadata->>'is_self')::boolean = true
  LIMIT 1;

  -- Si ya existe, retornarlo
  IF v_self_contact_id IS NOT NULL THEN
    RETURN v_self_contact_id;
  END IF;

  -- 2. No existe, necesitamos crearlo
  -- Obtener datos del usuario
  SELECT
    phone,
    first_name,
    last_name,
    email
  INTO
    v_user_phone,
    v_user_first_name,
    v_user_last_name,
    v_user_email
  FROM users
  WHERE id = p_user_id;

  -- Validar que encontramos el usuario
  IF v_user_phone IS NULL AND v_user_email IS NULL THEN
    RAISE EXCEPTION 'Usuario % no encontrado o sin phone/email', p_user_id;
  END IF;

  -- Construir nombre completo
  v_full_name := TRIM(CONCAT(v_user_first_name, ' ', v_user_last_name));
  IF v_full_name = '' THEN
    v_full_name := 'Usuario';
  END IF;

  -- 3. Buscar o crear contact_profile
  IF v_user_phone IS NOT NULL THEN
    -- Intentar buscar por teléfono
    SELECT id INTO v_contact_profile_id
    FROM contact_profiles
    WHERE phone_e164 = v_user_phone
    LIMIT 1;
  END IF;

  -- Si no existe contact_profile, crearlo
  IF v_contact_profile_id IS NULL THEN
    INSERT INTO contact_profiles (
      phone_e164,
      first_name,
      last_name,
      email,
      verified
    ) VALUES (
      v_user_phone,
      v_user_first_name,
      v_user_last_name,
      v_user_email,
      true -- Self contacts están verificados por definición
    )
    RETURNING id INTO v_contact_profile_id;
  ELSE
    -- Actualizar datos si ya existe
    UPDATE contact_profiles
    SET
      first_name = COALESCE(v_user_first_name, first_name),
      last_name = COALESCE(v_user_last_name, last_name),
      email = COALESCE(v_user_email, email),
      verified = true,
      updated_at = NOW()
    WHERE id = v_contact_profile_id;
  END IF;

  -- 4. Crear tenant_contact con flag is_self
  INSERT INTO tenant_contacts (
    tenant_id,
    contact_profile_id,
    name,
    metadata,
    opt_in_status
  ) VALUES (
    p_tenant_id,
    v_contact_profile_id,
    'Yo (Mi cuenta)', -- Nombre especial para self
    jsonb_build_object(
      'is_self', true,
      'user_id', p_user_id,
      'created_by_migration', '027'
    ),
    'opted_in' -- Self contacts están opted in por defecto
  )
  RETURNING id INTO v_self_contact_id;

  RAISE NOTICE 'Self contact creado: tenant_id=%, user_id=%, tenant_contact_id=%',
    p_tenant_id, p_user_id, v_self_contact_id;

  RETURN v_self_contact_id;
END;
$$ LANGUAGE plpgsql;

-- Comentario de la función
COMMENT ON FUNCTION get_or_create_self_contact(UUID, UUID) IS
'Obtiene o crea el tenant_contact que representa al usuario mismo dentro de su tenant.
Usado para registrar préstamos donde el usuario es el borrower (prestatario).';

-- =====================================================
-- 4. FUNCIÓN HELPER: OBTENER SELF CONTACT SI EXISTE
-- =====================================================

CREATE OR REPLACE FUNCTION get_self_contact_id(
  p_tenant_id UUID
) RETURNS UUID AS $$
DECLARE
  v_self_contact_id UUID;
BEGIN
  SELECT tc.id INTO v_self_contact_id
  FROM tenant_contacts tc
  WHERE tc.tenant_id = p_tenant_id
    AND (tc.metadata->>'is_self')::boolean = true
  LIMIT 1;

  RETURN v_self_contact_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_self_contact_id(UUID) IS
'Retorna el tenant_contact_id del self contact si existe, NULL si no existe.
No crea el registro, solo consulta.';

-- =====================================================
-- 5. VALIDACIÓN
-- =====================================================

DO $$
BEGIN
  -- Verificar que la función existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'get_or_create_self_contact'
  ) THEN
    RAISE EXCEPTION 'Función get_or_create_self_contact no fue creada';
  END IF;

  -- Verificar que el índice existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'tenant_contacts'
    AND indexname = 'idx_tenant_contacts_is_self'
  ) THEN
    RAISE EXCEPTION 'Índice idx_tenant_contacts_is_self no fue creado';
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migración 027 completada exitosamente';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Funciones creadas:';
  RAISE NOTICE '  - get_or_create_self_contact(tenant_id, user_id)';
  RAISE NOTICE '  - get_self_contact_id(tenant_id)';
  RAISE NOTICE '';
  RAISE NOTICE 'Índices creados:';
  RAISE NOTICE '  - idx_tenant_contacts_is_self';
  RAISE NOTICE '';
  RAISE NOTICE 'Uso:';
  RAISE NOTICE '  SELECT get_or_create_self_contact(''<tenant_id>'', ''<user_id>'');';
  RAISE NOTICE '========================================';
END $$;
