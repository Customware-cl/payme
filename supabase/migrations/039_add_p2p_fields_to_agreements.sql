-- Migración 039: Agregar campos P2P a agreements
-- Implementa sincronización bidireccional de préstamos entre tenants

-- =====================================================
-- 1. AGREGAR COLUMNAS LENDER/BORROWER TENANT
-- =====================================================

ALTER TABLE agreements
ADD COLUMN lender_tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
ADD COLUMN borrower_tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;

COMMENT ON COLUMN agreements.lender_tenant_id IS 'Tenant del prestamista (quien presta el dinero/item)';
COMMENT ON COLUMN agreements.borrower_tenant_id IS 'Tenant del prestatario (quien recibe el préstamo). NULL = contacto no registrado aún';

-- =====================================================
-- 2. HACER CAMPOS LEGACY OPCIONALES
-- =====================================================

-- tenant_id ya es NOT NULL, pero será deprecado gradualmente
-- tenant_contact_id ya es opcional desde migración 015

COMMENT ON COLUMN agreements.tenant_id IS 'LEGACY: Usar lender_tenant_id o borrower_tenant_id según perspectiva';
COMMENT ON COLUMN agreements.tenant_contact_id IS 'LEGACY: Usar referencias directas a lender/borrower';

-- =====================================================
-- 3. CREAR ÍNDICES
-- =====================================================

-- Índices para búsquedas de préstamos por lender/borrower
CREATE INDEX idx_agreements_lender_tenant
ON agreements(lender_tenant_id)
WHERE lender_tenant_id IS NOT NULL;

CREATE INDEX idx_agreements_borrower_tenant
ON agreements(borrower_tenant_id)
WHERE borrower_tenant_id IS NOT NULL;

-- Índice compuesto para consultas "préstamos entre X y Y"
CREATE INDEX idx_agreements_lender_borrower
ON agreements(lender_tenant_id, borrower_tenant_id)
WHERE lender_tenant_id IS NOT NULL AND borrower_tenant_id IS NOT NULL;

-- =====================================================
-- 4. MIGRAR DATOS EXISTENTES
-- =====================================================

-- Poblar lender_tenant_id con el tenant_id actual (asumiendo que el tenant actual es el lender)
UPDATE agreements
SET lender_tenant_id = tenant_id
WHERE lender_tenant_id IS NULL;

-- Poblar borrower_tenant_id buscando el tenant del contact
UPDATE agreements a
SET borrower_tenant_id = (
    SELECT tc.contact_tenant_id
    FROM tenant_contacts tc
    WHERE tc.id = a.tenant_contact_id
    LIMIT 1
)
WHERE a.tenant_contact_id IS NOT NULL
  AND a.borrower_tenant_id IS NULL;

-- =====================================================
-- 5. ESTADÍSTICAS
-- =====================================================

DO $$
DECLARE
    total_agreements INTEGER;
    with_lender INTEGER;
    with_borrower INTEGER;
    p2p_complete INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_agreements FROM agreements;
    SELECT COUNT(*) INTO with_lender FROM agreements WHERE lender_tenant_id IS NOT NULL;
    SELECT COUNT(*) INTO with_borrower FROM agreements WHERE borrower_tenant_id IS NOT NULL;
    SELECT COUNT(*) INTO p2p_complete
    FROM agreements
    WHERE lender_tenant_id IS NOT NULL AND borrower_tenant_id IS NOT NULL;

    RAISE NOTICE 'Migración 039 completada:';
    RAISE NOTICE '- Total agreements: %', total_agreements;
    RAISE NOTICE '- Con lender_tenant_id: %', with_lender;
    RAISE NOTICE '- Con borrower_tenant_id: %', with_borrower;
    RAISE NOTICE '- P2P completo (ambos tenants): %', p2p_complete;
END $$;

-- Fin de migración 039
