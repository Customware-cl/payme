-- Migración 012: Hacer phone_e164 opcional para usuarios de Telegram
-- Permite crear contactos sin teléfono para canales como Telegram

-- =====================================================
-- HACER PHONE_E164 OPCIONAL
-- =====================================================

-- Hacer phone_e164 opcional para usuarios de otros canales
ALTER TABLE contacts
  ALTER COLUMN phone_e164 DROP NOT NULL;

-- Comentario explicativo
COMMENT ON COLUMN contacts.phone_e164 IS 'Número de teléfono en formato E164 - opcional para usuarios de canales no telefónicos como Telegram';

-- Agregar índice para búsquedas por canal preferido
CREATE INDEX IF NOT EXISTS idx_contacts_preferred_channel
  ON contacts(tenant_id, preferred_channel);

-- Agregar índice para usuarios de Telegram
CREATE INDEX IF NOT EXISTS idx_contacts_telegram_id
  ON contacts(tenant_id, telegram_id)
  WHERE telegram_id IS NOT NULL;

-- Fin de migración 012