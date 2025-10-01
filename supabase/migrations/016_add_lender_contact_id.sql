-- Migración 016: Agregar lender_contact_id para soportar préstamos entre contactos
-- Permite representar: "Rodrigo le prestó a Juan", "Juan le prestó a Pedro", etc.

-- =====================================================
-- 1. AGREGAR COLUMNA LENDER_CONTACT_ID
-- =====================================================

-- Agregar columna para identificar quién presta (lender)
-- NULL = préstamo del owner del tenant (compatibilidad con datos antiguos)
ALTER TABLE agreements
ADD COLUMN lender_contact_id UUID;

-- Agregar foreign key
ALTER TABLE agreements
ADD CONSTRAINT fk_lender_contact
FOREIGN KEY (lender_contact_id)
REFERENCES contacts(id)
ON DELETE SET NULL;

-- =====================================================
-- 2. CREAR ÍNDICES PARA BÚSQUEDAS RÁPIDAS
-- =====================================================

-- Índice para buscar préstamos que YO hice (como lender)
CREATE INDEX idx_agreements_lender_contact_id
ON agreements(lender_contact_id)
WHERE lender_contact_id IS NOT NULL;

-- Índice compuesto para búsquedas por tenant + lender
CREATE INDEX idx_agreements_tenant_lender
ON agreements(tenant_id, lender_contact_id)
WHERE lender_contact_id IS NOT NULL;

-- =====================================================
-- 3. COMENTARIOS
-- =====================================================

COMMENT ON COLUMN agreements.lender_contact_id IS 'Contact que presta (lender). NULL = owner del tenant presta';
COMMENT ON COLUMN agreements.contact_id IS 'Contact que recibe el préstamo (borrower)';

-- =====================================================
-- 4. VERIFICACIÓN
-- =====================================================

-- Verificar que la migración se aplicó correctamente
DO $$
BEGIN
    -- Verificar que la columna existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'agreements'
        AND column_name = 'lender_contact_id'
    ) THEN
        RAISE EXCEPTION 'Columna lender_contact_id no fue creada';
    END IF;

    -- Verificar que el índice existe
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'agreements'
        AND indexname = 'idx_agreements_lender_contact_id'
    ) THEN
        RAISE EXCEPTION 'Índice idx_agreements_lender_contact_id no fue creado';
    END IF;

    RAISE NOTICE 'Migración 016 completada exitosamente';
    RAISE NOTICE 'Columna lender_contact_id agregada a agreements';
    RAISE NOTICE 'Índices creados para búsquedas rápidas';
END $$;
