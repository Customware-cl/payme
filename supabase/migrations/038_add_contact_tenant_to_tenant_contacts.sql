-- Migración 038: Agregar contact_tenant_id a tenant_contacts
-- Permite identificar el tenant del contacto para sincronización P2P

-- =====================================================
-- 1. AGREGAR COLUMNA CONTACT_TENANT_ID
-- =====================================================

ALTER TABLE tenant_contacts
ADD COLUMN contact_tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;

COMMENT ON COLUMN tenant_contacts.contact_tenant_id IS 'Tenant ID del contacto (si el contacto tiene su propio tenant). NULL = contacto no registrado aún';

-- =====================================================
-- 2. CREAR ÍNDICES
-- =====================================================

-- Índice para búsquedas por contact_tenant_id
CREATE INDEX idx_tenant_contacts_contact_tenant
ON tenant_contacts(contact_tenant_id)
WHERE contact_tenant_id IS NOT NULL;

-- Índice compuesto para búsquedas de aliases cruzados
-- "Cuando busco el alias que tenant X tiene para tenant Y"
CREATE INDEX idx_tenant_contacts_tenant_contact_tenant
ON tenant_contacts(tenant_id, contact_tenant_id)
WHERE contact_tenant_id IS NOT NULL;

-- =====================================================
-- 3. POBLAR DATOS EXISTENTES
-- =====================================================

-- Actualizar tenant_contacts donde el contact_profile tiene su propio tenant
UPDATE tenant_contacts tc
SET contact_tenant_id = (
    SELECT t.id
    FROM tenants t
    WHERE t.owner_contact_profile_id = tc.contact_profile_id
    LIMIT 1
)
WHERE tc.contact_profile_id IS NOT NULL
  AND tc.contact_tenant_id IS NULL;

-- =====================================================
-- 4. ESTADÍSTICAS
-- =====================================================

DO $$
DECLARE
    total_contacts INTEGER;
    with_tenant INTEGER;
    without_tenant INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_contacts FROM tenant_contacts;
    SELECT COUNT(*) INTO with_tenant FROM tenant_contacts WHERE contact_tenant_id IS NOT NULL;
    SELECT COUNT(*) INTO without_tenant FROM tenant_contacts WHERE contact_tenant_id IS NULL;

    RAISE NOTICE 'Migración 038 completada:';
    RAISE NOTICE '- Total tenant_contacts: %', total_contacts;
    RAISE NOTICE '- Con tenant asignado: %', with_tenant;
    RAISE NOTICE '- Sin tenant (no registrado): %', without_tenant;
END $$;

-- Fin de migración 038
