-- Migración 010: Hacer phone_number opcional en conversation_states
-- Para soportar usuarios de Telegram sin teléfono

-- =====================================================
-- HACER PHONE_NUMBER OPCIONAL
-- =====================================================

-- Permitir NULL en phone_number para usuarios de Telegram
ALTER TABLE conversation_states
  ALTER COLUMN phone_number DROP NOT NULL;

-- Agregar índice para búsquedas por tenant y contact
CREATE INDEX IF NOT EXISTS idx_conversation_states_tenant_contact
  ON conversation_states(tenant_id, contact_id);

-- Comentario
COMMENT ON COLUMN conversation_states.phone_number IS 'Teléfono del contacto - opcional para usuarios de Telegram';

-- Fin de migración 010