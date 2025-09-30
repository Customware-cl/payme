-- Migración 013: Hacer phone_e164 realmente opcional
-- Remover NOT NULL constraint definitivamente

ALTER TABLE contacts ALTER COLUMN phone_e164 DROP NOT NULL;