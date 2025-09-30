-- =====================================================
-- MIGRACIÓN 015: Corregir tabla agreements
-- Ejecutar en SQL Editor de Supabase Dashboard
-- =====================================================

-- 1. Hacer contact_id opcional
ALTER TABLE agreements ALTER COLUMN contact_id DROP NOT NULL;

-- 2. Agregar tenant_contact_id si no existe
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

-- 3. Agregar foreign key constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_agreements_tenant_contact'
    ) THEN
        ALTER TABLE agreements
        ADD CONSTRAINT fk_agreements_tenant_contact
        FOREIGN KEY (tenant_contact_id) REFERENCES tenant_contacts(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 4. Crear índices
CREATE INDEX IF NOT EXISTS idx_agreements_tenant_contact_id
ON agreements(tenant_contact_id)
WHERE tenant_contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agreements_tenant_status
ON agreements(tenant_id, status, due_date)
WHERE status = 'active';

-- 5. Agregar constraint de validación
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'chk_contact_reference'
    ) THEN
        ALTER TABLE agreements
        ADD CONSTRAINT chk_contact_reference
        CHECK (contact_id IS NOT NULL OR tenant_contact_id IS NOT NULL);
    END IF;
END $$;

-- 6. Verificar resultados
SELECT
    table_name,
    column_name,
    is_nullable,
    data_type
FROM information_schema.columns
WHERE table_name = 'agreements'
AND column_name IN ('contact_id', 'tenant_contact_id')
ORDER BY column_name;