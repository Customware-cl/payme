-- Hacer phone_e164 opcional
ALTER TABLE contacts ALTER COLUMN phone_e164 DROP NOT NULL;