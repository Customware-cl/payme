-- Migración 037: Agregar owner_contact_profile_id a tenants
-- Implementa arquitectura auto-tenant donde cada usuario obtiene su propio tenant

-- =====================================================
-- 1. AGREGAR COLUMNA OWNER
-- =====================================================

ALTER TABLE tenants
ADD COLUMN owner_contact_profile_id UUID REFERENCES contact_profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN tenants.owner_contact_profile_id IS 'Contact profile del dueño de este tenant (null = tenant compartido/legacy)';

-- =====================================================
-- 2. CREAR ÍNDICE ÚNICO
-- =====================================================

-- Un contact_profile solo puede ser owner de 1 tenant
CREATE UNIQUE INDEX idx_tenants_owner_profile
ON tenants(owner_contact_profile_id)
WHERE owner_contact_profile_id IS NOT NULL;

-- Índice para búsquedas por owner
CREATE INDEX idx_tenants_owner_lookup
ON tenants(owner_contact_profile_id)
WHERE owner_contact_profile_id IS NOT NULL;

-- =====================================================
-- 3. ESTADÍSTICAS
-- =====================================================

DO $$
DECLARE
    total_tenants INTEGER;
    with_owner INTEGER;
    without_owner INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_tenants FROM tenants;
    SELECT COUNT(*) INTO with_owner FROM tenants WHERE owner_contact_profile_id IS NOT NULL;
    SELECT COUNT(*) INTO without_owner FROM tenants WHERE owner_contact_profile_id IS NULL;

    RAISE NOTICE 'Migración 037 completada:';
    RAISE NOTICE '- Total tenants: %', total_tenants;
    RAISE NOTICE '- Con owner asignado: %', with_owner;
    RAISE NOTICE '- Sin owner (legacy): %', without_owner;
END $$;

-- Fin de migración 037
