-- Migración 019: Agregar campos de confirmación del borrower a agreements
-- Necesario para FASE 2.1: Confirmación del Contacto y FASE 2.11: Engagement

-- 1. Agregar campos de confirmación del borrower
ALTER TABLE agreements
ADD COLUMN IF NOT EXISTS borrower_confirmed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS borrower_confirmed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS borrower_rejection_reason VARCHAR(255),
ADD COLUMN IF NOT EXISTS borrower_rejection_details TEXT;

-- 2. Crear índice para búsquedas eficientes de confirmaciones
CREATE INDEX IF NOT EXISTS idx_agreements_borrower_confirmed
ON agreements(contact_id, borrower_confirmed)
WHERE borrower_confirmed = TRUE;

-- 3. Comentarios para documentación
COMMENT ON COLUMN agreements.borrower_confirmed IS 'Indica si el borrower (prestatario) confirmó haber recibido el préstamo';
COMMENT ON COLUMN agreements.borrower_confirmed_at IS 'Fecha y hora en que el borrower confirmó el préstamo';
COMMENT ON COLUMN agreements.borrower_rejection_reason IS 'Motivo de rechazo del borrower (no_recibio, monto_incorrecto, no_conoce, otro)';
COMMENT ON COLUMN agreements.borrower_rejection_details IS 'Detalles adicionales sobre el rechazo del borrower';

-- 4. Actualizar agreements existentes con status='active'
-- (Se asume que ya fueron confirmados implícitamente)
UPDATE agreements
SET borrower_confirmed = TRUE,
    borrower_confirmed_at = updated_at
WHERE status = 'active'
  AND borrower_confirmed IS NULL;

-- 5. Comentario adicional
COMMENT ON INDEX idx_agreements_borrower_confirmed IS 'Índice para contar confirmaciones del borrower (usado en mensaje de engagement)';
