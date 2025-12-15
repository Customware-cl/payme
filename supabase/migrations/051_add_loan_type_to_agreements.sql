-- Migración 051: Agregar campo loan_type a tabla agreements
-- Distingue entre préstamos de dinero vs objetos de forma explícita

-- 1. Crear ENUM loan_type (money = dinero, object = objeto físico, unknown = legacy/migración)
DO $$ BEGIN
    CREATE TYPE loan_type AS ENUM ('money', 'object', 'unknown');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Agregar columna loan_type con default 'unknown' para no romper inserts existentes
ALTER TABLE agreements
ADD COLUMN IF NOT EXISTS loan_type loan_type DEFAULT 'unknown';

-- 3. Migrar datos existentes basado en la lógica actual (amount != null = dinero)
UPDATE agreements
SET loan_type = CASE
    WHEN type = 'loan' AND amount IS NOT NULL THEN 'money'::loan_type
    WHEN type = 'loan' AND amount IS NULL THEN 'object'::loan_type
    ELSE 'unknown'::loan_type
END
WHERE type = 'loan' AND loan_type = 'unknown';

-- 4. También migrar desde metadata donde exista información explícita
UPDATE agreements
SET loan_type = CASE
    WHEN metadata->>'loan_type' = 'money' THEN 'money'::loan_type
    WHEN metadata->>'loan_type' = 'object' THEN 'object'::loan_type
    WHEN metadata->>'is_money_loan' = 'true' THEN 'money'::loan_type
    WHEN metadata->>'is_money_loan' = 'false' THEN 'object'::loan_type
    ELSE loan_type -- mantener valor actual si no hay info en metadata
END
WHERE type = 'loan';

-- 5. Crear índice para consultas frecuentes por loan_type
CREATE INDEX IF NOT EXISTS idx_agreements_loan_type ON agreements(loan_type)
WHERE type = 'loan';

-- Comentario: No agregamos constraint NOT NULL aún para permitir transición gradual
-- Una vez estabilizado, se puede agregar:
-- ALTER TABLE agreements
-- ADD CONSTRAINT loan_type_required_for_loans
-- CHECK (type != 'loan' OR loan_type IS NOT NULL);
