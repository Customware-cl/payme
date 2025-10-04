-- Migración 021: Agregar contact_profile_id a la tabla contacts
-- Esto conecta la tabla contacts (usada en el webhook) con contact_profiles

-- Agregar columna contact_profile_id a contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS contact_profile_id UUID REFERENCES contact_profiles(id);

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_contacts_contact_profile_id ON contacts(contact_profile_id);

-- Comentario
COMMENT ON COLUMN contacts.contact_profile_id IS 'Referencia al perfil global del contacto';
