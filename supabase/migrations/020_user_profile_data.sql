-- Migración 020: Agregar datos de perfil personal y cuentas bancarias
-- Permite a los usuarios gestionar su información personal y datos de transferencia

-- =====================================================
-- 1. EXTENDER CONTACT_PROFILES CON DATOS PERSONALES
-- =====================================================

-- Agregar campos de perfil personal a contact_profiles
ALTER TABLE contact_profiles
ADD COLUMN first_name VARCHAR(100),
ADD COLUMN last_name VARCHAR(100),
ADD COLUMN email VARCHAR(255);

-- Índice para búsqueda por email
CREATE INDEX idx_contact_profiles_email ON contact_profiles(email)
    WHERE email IS NOT NULL;

-- Constraint para validar formato de email
ALTER TABLE contact_profiles
ADD CONSTRAINT valid_email_format CHECK (
    email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
);

-- Comentarios
COMMENT ON COLUMN contact_profiles.first_name IS 'Nombre del contacto';
COMMENT ON COLUMN contact_profiles.last_name IS 'Apellido del contacto';
COMMENT ON COLUMN contact_profiles.email IS 'Email del contacto';

-- =====================================================
-- 2. CREAR TABLA BANK_TRANSFER_ACCOUNTS
-- =====================================================

-- Crear tipo ENUM para tipos de cuenta
CREATE TYPE account_type AS ENUM ('corriente', 'ahorro', 'vista', 'rut');

-- Tabla para datos de transferencia bancaria
CREATE TABLE bank_transfer_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_profile_id UUID NOT NULL REFERENCES contact_profiles(id) ON DELETE CASCADE,

    -- Datos de la cuenta
    alias VARCHAR(100) NOT NULL, -- Ej: "Cuenta Principal", "Banco Chile"
    bank_name VARCHAR(100) NOT NULL, -- Ej: "Banco de Chile", "Santander"
    account_type account_type NOT NULL, -- corriente, ahorro, vista, rut
    account_number VARCHAR(50) NOT NULL, -- Número de cuenta

    -- Estado
    is_default BOOLEAN DEFAULT FALSE, -- Marca si es la cuenta predeterminada
    is_active BOOLEAN DEFAULT TRUE, -- Permite desactivar sin eliminar

    -- Auditoría
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_alias_per_contact UNIQUE(contact_profile_id, alias)
);

-- Índices para búsquedas rápidas
CREATE INDEX idx_bank_accounts_contact_profile ON bank_transfer_accounts(contact_profile_id);
CREATE INDEX idx_bank_accounts_is_default ON bank_transfer_accounts(contact_profile_id, is_default)
    WHERE is_default = TRUE;
CREATE INDEX idx_bank_accounts_is_active ON bank_transfer_accounts(is_active)
    WHERE is_active = TRUE;

-- Trigger para updated_at
CREATE TRIGGER update_bank_transfer_accounts_updated_at
    BEFORE UPDATE ON bank_transfer_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Función para asegurar solo una cuenta default por contacto
CREATE OR REPLACE FUNCTION ensure_single_default_account()
RETURNS TRIGGER AS $$
BEGIN
    -- Si se está marcando como default, desmarcar las demás
    IF NEW.is_default = TRUE THEN
        UPDATE bank_transfer_accounts
        SET is_default = FALSE
        WHERE contact_profile_id = NEW.contact_profile_id
          AND id != NEW.id
          AND is_default = TRUE;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para mantener una sola cuenta default
CREATE TRIGGER trigger_single_default_account
    BEFORE INSERT OR UPDATE ON bank_transfer_accounts
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_default_account();

-- Comentarios
COMMENT ON TABLE bank_transfer_accounts IS 'Cuentas bancarias para transferencias de los contactos';
COMMENT ON COLUMN bank_transfer_accounts.alias IS 'Alias descriptivo de la cuenta';
COMMENT ON COLUMN bank_transfer_accounts.bank_name IS 'Nombre del banco';
COMMENT ON COLUMN bank_transfer_accounts.account_type IS 'Tipo de cuenta: corriente, ahorro, vista, rut';
COMMENT ON COLUMN bank_transfer_accounts.account_number IS 'Número de cuenta bancaria';
COMMENT ON COLUMN bank_transfer_accounts.is_default IS 'Marca si es la cuenta predeterminada para transferencias';

-- =====================================================
-- 3. MIGRAR DATOS EXISTENTES (SI APLICA)
-- =====================================================

-- Migrar nombres de telegram a first_name si existen
UPDATE contact_profiles
SET first_name = telegram_first_name
WHERE telegram_first_name IS NOT NULL
  AND first_name IS NULL;

UPDATE contact_profiles
SET last_name = telegram_last_name
WHERE telegram_last_name IS NOT NULL
  AND last_name IS NULL;

-- =====================================================
-- 4. VALIDACIÓN
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE 'Migración 020 completada exitosamente.';
    RAISE NOTICE 'Contact profiles actualizados: %', (SELECT COUNT(*) FROM contact_profiles);
    RAISE NOTICE 'Bank transfer accounts creados: %', (SELECT COUNT(*) FROM bank_transfer_accounts);
END $$;
