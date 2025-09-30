-- Migración 015: Corregir tabla agreements para usar tenant_contacts
-- Soluciona el problema de foreign key conflicts entre contacts y tenant_contacts

-- =====================================================
-- 1. HACER CONTACT_ID OPCIONAL
-- =====================================================

-- Hacer contact_id opcional para permitir usar tenant_contact_id
ALTER TABLE agreements ALTER COLUMN contact_id DROP NOT NULL;

COMMENT ON COLUMN agreements.contact_id IS 'ID del contacto (tabla contacts legacy) - opcional para compatibilidad';

-- =====================================================
-- 2. AGREGAR FOREIGN KEY PARA TENANT_CONTACT_ID
-- =====================================================

-- Verificar que tenant_contact_id existe (debería existir de migración 014)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'agreements'
        AND column_name = 'tenant_contact_id'
    ) THEN
        ALTER TABLE agreements ADD COLUMN tenant_contact_id UUID;
    END IF;
END $$;

-- Agregar foreign key constraint para tenant_contact_id
ALTER TABLE agreements
ADD CONSTRAINT fk_agreements_tenant_contact
FOREIGN KEY (tenant_contact_id) REFERENCES tenant_contacts(id) ON DELETE CASCADE;

-- Agregar comentario
COMMENT ON COLUMN agreements.tenant_contact_id IS 'ID del contacto en nueva estructura tenant_contacts';

-- =====================================================
-- 3. CREAR ÍNDICES PARA OPTIMIZACIÓN
-- =====================================================

-- Índice para búsquedas por tenant_contact_id
CREATE INDEX IF NOT EXISTS idx_agreements_tenant_contact_id
ON agreements(tenant_contact_id)
WHERE tenant_contact_id IS NOT NULL;

-- Índice compuesto para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_agreements_tenant_status
ON agreements(tenant_id, status, due_date)
WHERE status = 'active';

-- =====================================================
-- 4. AGREGAR CONSTRAINT DE VALIDACIÓN
-- =====================================================

-- Asegurar que al menos uno de contact_id o tenant_contact_id esté presente
ALTER TABLE agreements
ADD CONSTRAINT chk_contact_reference
CHECK (contact_id IS NOT NULL OR tenant_contact_id IS NOT NULL);

COMMENT ON CONSTRAINT chk_contact_reference ON agreements IS 'Asegurar que existe referencia a contacto (legacy o nuevo)';

-- =====================================================
-- 5. MIGRAR DATOS EXISTENTES (SI LOS HAY)
-- =====================================================

-- Actualizar agreements existentes que tengan contact_id pero no tenant_contact_id
UPDATE agreements
SET tenant_contact_id = (
    SELECT tc.id
    FROM tenant_contacts tc
    JOIN contact_profiles cp ON tc.contact_profile_id = cp.id
    JOIN contacts c ON (
        (c.phone_e164 IS NOT NULL AND c.phone_e164 != '+000000000000' AND cp.phone_e164 = c.phone_e164)
        OR (c.telegram_id IS NOT NULL AND cp.telegram_id = c.telegram_id)
    )
    WHERE c.id = agreements.contact_id
    AND tc.tenant_id = agreements.tenant_id
    LIMIT 1
)
WHERE contact_id IS NOT NULL
AND tenant_contact_id IS NULL;

-- =====================================================
-- 6. ESTADÍSTICAS DE MIGRACIÓN
-- =====================================================

DO $$
DECLARE
    total_agreements INTEGER;
    with_contact_id INTEGER;
    with_tenant_contact_id INTEGER;
    with_both INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_agreements FROM agreements;
    SELECT COUNT(*) INTO with_contact_id FROM agreements WHERE contact_id IS NOT NULL;
    SELECT COUNT(*) INTO with_tenant_contact_id FROM agreements WHERE tenant_contact_id IS NOT NULL;
    SELECT COUNT(*) INTO with_both FROM agreements WHERE contact_id IS NOT NULL AND tenant_contact_id IS NOT NULL;

    RAISE NOTICE 'Migración 015 completada:';
    RAISE NOTICE '- Total agreements: %', total_agreements;
    RAISE NOTICE '- Con contact_id: %', with_contact_id;
    RAISE NOTICE '- Con tenant_contact_id: %', with_tenant_contact_id;
    RAISE NOTICE '- Con ambos: %', with_both;
END $$;

-- Fin de migración 015