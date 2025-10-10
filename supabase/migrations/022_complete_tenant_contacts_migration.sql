-- Migración 022: Completar migración a tenant_contacts
-- Asegura que todo el sistema use tenant_contacts en lugar de contacts legacy

-- =====================================================
-- 1. ASEGURAR QUE TODOS LOS CONTACTS TIENEN CONTACT_PROFILE
-- =====================================================

-- Crear contact_profiles para contacts que no tengan uno
INSERT INTO contact_profiles (phone_e164, telegram_id, telegram_username, telegram_first_name, telegram_last_name, created_at, updated_at)
SELECT
    CASE WHEN c.phone_e164 = '+000000000000' THEN NULL ELSE c.phone_e164 END,
    c.telegram_id,
    c.telegram_username,
    c.telegram_first_name,
    c.telegram_last_name,
    c.created_at,
    NOW()
FROM contacts c
WHERE c.contact_profile_id IS NULL
  AND (c.phone_e164 IS NOT NULL OR c.telegram_id IS NOT NULL)
ON CONFLICT DO NOTHING;

-- Actualizar contacts para que apunten a su contact_profile
UPDATE contacts c
SET contact_profile_id = cp.id
FROM contact_profiles cp
WHERE c.contact_profile_id IS NULL
  AND (
    (c.phone_e164 IS NOT NULL AND c.phone_e164 != '+000000000000' AND cp.phone_e164 = c.phone_e164)
    OR (c.telegram_id IS NOT NULL AND cp.telegram_id = c.telegram_id)
  );

-- =====================================================
-- 2. CREAR TENANT_CONTACTS PARA TODOS LOS CONTACTS
-- =====================================================

-- Insertar tenant_contacts para cada contact que no tenga uno
INSERT INTO tenant_contacts (
    tenant_id,
    contact_profile_id,
    name,
    preferred_channel,
    whatsapp_id,
    opt_in_status,
    opt_in_date,
    opt_out_date,
    telegram_opt_in_status,
    timezone,
    preferred_language,
    metadata,
    created_at,
    updated_at
)
SELECT
    c.tenant_id,
    c.contact_profile_id,
    c.name, -- Nombre personalizado que le puso el tenant
    COALESCE(c.preferred_channel, 'whatsapp'),
    c.whatsapp_id,
    c.opt_in_status,
    c.opt_in_date,
    c.opt_out_date,
    COALESCE(c.telegram_opt_in_status, 'pending'::opt_in_status),
    c.timezone,
    c.preferred_language,
    c.metadata,
    c.created_at,
    c.updated_at
FROM contacts c
WHERE c.contact_profile_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM tenant_contacts tc
    WHERE tc.tenant_id = c.tenant_id
      AND tc.contact_profile_id = c.contact_profile_id
  );

-- =====================================================
-- 3. CREAR MAPEO DE CONTACT_ID A TENANT_CONTACT_ID
-- =====================================================

-- Crear tabla temporal para mapear contact_id → tenant_contact_id
CREATE TEMP TABLE contact_to_tenant_contact_mapping AS
SELECT
    c.id as contact_id,
    tc.id as tenant_contact_id
FROM contacts c
JOIN tenant_contacts tc ON tc.tenant_id = c.tenant_id
    AND tc.contact_profile_id = c.contact_profile_id;

-- =====================================================
-- 4. ACTUALIZAR AGREEMENTS: BORROWER (contact_id)
-- =====================================================

-- Actualizar agreements.tenant_contact_id basado en contact_id (borrower)
UPDATE agreements a
SET tenant_contact_id = m.tenant_contact_id
FROM contact_to_tenant_contact_mapping m
WHERE a.contact_id = m.contact_id
  AND a.tenant_contact_id IS NULL;

-- =====================================================
-- 5. CREAR NUEVA COLUMNA LENDER_TENANT_CONTACT_ID
-- =====================================================

-- Agregar nueva columna para lender en tenant_contacts
ALTER TABLE agreements ADD COLUMN IF NOT EXISTS lender_tenant_contact_id UUID;

-- Agregar foreign key
ALTER TABLE agreements
ADD CONSTRAINT fk_agreements_lender_tenant_contact
FOREIGN KEY (lender_tenant_contact_id) REFERENCES tenant_contacts(id) ON DELETE CASCADE;

-- Agregar índice
CREATE INDEX IF NOT EXISTS idx_agreements_lender_tenant_contact_id
ON agreements(lender_tenant_contact_id)
WHERE lender_tenant_contact_id IS NOT NULL;

-- Comentario
COMMENT ON COLUMN agreements.lender_tenant_contact_id IS 'ID del tenant_contact que presta (lender)';

-- =====================================================
-- 6. ACTUALIZAR AGREEMENTS: LENDER (lender_contact_id)
-- =====================================================

-- Actualizar agreements.lender_tenant_contact_id basado en lender_contact_id
UPDATE agreements a
SET lender_tenant_contact_id = m.tenant_contact_id
FROM contact_to_tenant_contact_mapping m
WHERE a.lender_contact_id = m.contact_id
  AND a.lender_tenant_contact_id IS NULL;

-- =====================================================
-- 7. AGREGAR COLUMNA DE MAPEO EN CONTACTS (TEMPORAL)
-- =====================================================

-- Agregar columna para mantener referencia a tenant_contact
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tenant_contact_id UUID;

-- Actualizar con el mapeo
UPDATE contacts c
SET tenant_contact_id = tc.id
FROM tenant_contacts tc
WHERE tc.tenant_id = c.tenant_id
  AND tc.contact_profile_id = c.contact_profile_id;

-- Agregar foreign key
ALTER TABLE contacts
ADD CONSTRAINT fk_contacts_tenant_contact
FOREIGN KEY (tenant_contact_id) REFERENCES tenant_contacts(id) ON DELETE SET NULL;

-- Comentario
COMMENT ON COLUMN contacts.tenant_contact_id IS 'Mapeo a tenant_contacts para migración - TEMPORAL';

-- =====================================================
-- 8. ACTUALIZAR MESSAGES PARA USAR TENANT_CONTACT_ID
-- =====================================================

-- Ya existe messages.tenant_contact_id de migración 014, solo actualizarlo
UPDATE messages m
SET tenant_contact_id = c.tenant_contact_id
FROM contacts c
WHERE m.contact_id = c.id
  AND m.tenant_contact_id IS NULL
  AND c.tenant_contact_id IS NOT NULL;

-- =====================================================
-- 9. ESTADÍSTICAS DE MIGRACIÓN
-- =====================================================

DO $$
DECLARE
    total_contacts INTEGER;
    contacts_with_profile INTEGER;
    total_tenant_contacts INTEGER;
    total_agreements INTEGER;
    agreements_with_tenant_contact INTEGER;
    agreements_with_lender_tenant_contact INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_contacts FROM contacts;
    SELECT COUNT(*) INTO contacts_with_profile FROM contacts WHERE contact_profile_id IS NOT NULL;
    SELECT COUNT(*) INTO total_tenant_contacts FROM tenant_contacts;
    SELECT COUNT(*) INTO total_agreements FROM agreements;
    SELECT COUNT(*) INTO agreements_with_tenant_contact FROM agreements WHERE tenant_contact_id IS NOT NULL;
    SELECT COUNT(*) INTO agreements_with_lender_tenant_contact FROM agreements WHERE lender_tenant_contact_id IS NOT NULL;

    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migración 022 completada exitosamente';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Contacts:';
    RAISE NOTICE '  - Total: %', total_contacts;
    RAISE NOTICE '  - Con contact_profile: %', contacts_with_profile;
    RAISE NOTICE '  - Porcentaje: %%%', ROUND((contacts_with_profile::numeric / NULLIF(total_contacts, 0) * 100), 2);
    RAISE NOTICE '';
    RAISE NOTICE 'Tenant Contacts:';
    RAISE NOTICE '  - Total: %', total_tenant_contacts;
    RAISE NOTICE '';
    RAISE NOTICE 'Agreements:';
    RAISE NOTICE '  - Total: %', total_agreements;
    RAISE NOTICE '  - Con borrower (tenant_contact_id): %', agreements_with_tenant_contact;
    RAISE NOTICE '  - Con lender (lender_tenant_contact_id): %', agreements_with_lender_tenant_contact;
    RAISE NOTICE '';
    RAISE NOTICE 'Próximos pasos:';
    RAISE NOTICE '  1. Refactorizar código para usar tenant_contacts';
    RAISE NOTICE '  2. Verificar que queries usen tenant_contact_id';
    RAISE NOTICE '  3. Eventualmente deprecar tabla contacts';
    RAISE NOTICE '========================================';
END $$;

-- Fin de migración 022
