-- Migración 018: Agregar estados de confirmación al ENUM agreement_status
-- Necesario para FASE 2.1: Confirmación del Contacto

-- Agregar 'pending_confirmation' al ENUM agreement_status
ALTER TYPE agreement_status ADD VALUE IF NOT EXISTS 'pending_confirmation';

-- Agregar 'rejected' al ENUM agreement_status
ALTER TYPE agreement_status ADD VALUE IF NOT EXISTS 'rejected';

-- Comentario para documentación
COMMENT ON TYPE agreement_status IS 'Estados de acuerdo: active, completed, cancelled, overdue, returned, due_soon, paused, pending_confirmation, rejected';
