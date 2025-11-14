-- Eliminar versión antigua de ensure_user_tenant que causa ambigüedad

-- PROBLEMA DETECTADO:
-- Existían dos versiones de ensure_user_tenant:
--   1. ensure_user_tenant(p_contact_profile_id UUID) <- Versión antigua
--   2. ensure_user_tenant(p_contact_profile_id UUID, p_invited_by_tenant_id UUID DEFAULT NULL, p_acquisition_type TEXT DEFAULT 'organic') <- Versión nueva
--
-- Cuando se llamaba con solo 1 parámetro desde la web app, PostgreSQL no podía decidir
-- cuál usar y lanzaba error:
--   "Could not choose the best candidate function"
--
-- SOLUCIÓN:
-- Eliminar la versión antigua (1 parámetro) para que solo exista la nueva versión

-- Eliminar versión antigua (1 parámetro)
DROP FUNCTION IF EXISTS ensure_user_tenant(UUID);

-- La versión nueva (3 parámetros con DEFAULT) quedará como única
COMMENT ON FUNCTION ensure_user_tenant(UUID, UUID, TEXT) IS
'v4 - Única versión activa. Crea tenant con tracking de origen (organic/invited) y referral tracking.';

-- Verificación
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_proc
  WHERE proname = 'ensure_user_tenant';

  IF v_count = 1 THEN
    RAISE NOTICE 'Migración 050 completada: Solo existe 1 versión de ensure_user_tenant';
  ELSE
    RAISE EXCEPTION 'Error: Existen % versiones de ensure_user_tenant', v_count;
  END IF;
END $$;
