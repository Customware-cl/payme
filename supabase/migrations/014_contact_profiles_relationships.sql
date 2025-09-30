-- Migración 014: Implementar tabla de relaciones para evitar contactos duplicados
-- Crea contact_profiles (globales únicos) y tenant_contacts (relación tenant-contacto)

-- =====================================================
-- 1. CREAR NUEVAS TABLAS
-- =====================================================

-- Tabla de perfiles de contacto globales (sin duplicados por teléfono/telegram)
CREATE TABLE contact_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identificadores únicos
    phone_e164 VARCHAR(20), -- Formato E.164: +521234567890
    telegram_id VARCHAR(50), -- ID numérico de Telegram
    telegram_username VARCHAR(50), -- Username sin @

    -- Datos básicos de Telegram (se mantienen aquí por ser globales)
    telegram_first_name VARCHAR(255),
    telegram_last_name VARCHAR(255),

    -- Estado de verificación
    verified BOOLEAN DEFAULT FALSE,

    -- Auditoría
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints: Al menos uno de los identificadores debe existir
    CONSTRAINT phone_or_telegram_required CHECK (
        phone_e164 IS NOT NULL OR telegram_id IS NOT NULL
    ),
    CONSTRAINT valid_phone_format CHECK (
        phone_e164 IS NULL OR phone_e164 ~ '^\+[1-9]\d{1,14}$'
    )
);

-- Índices únicos para evitar duplicados
CREATE UNIQUE INDEX idx_contact_profiles_phone ON contact_profiles(phone_e164)
    WHERE phone_e164 IS NOT NULL;
CREATE UNIQUE INDEX idx_contact_profiles_telegram_id ON contact_profiles(telegram_id)
    WHERE telegram_id IS NOT NULL;
CREATE UNIQUE INDEX idx_contact_profiles_telegram_username ON contact_profiles(telegram_username)
    WHERE telegram_username IS NOT NULL;

-- Tabla de relaciones tenant-contacto (cada tenant puede tener su propia vista del contacto)
CREATE TABLE tenant_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_profile_id UUID NOT NULL REFERENCES contact_profiles(id) ON DELETE CASCADE,

    -- Datos específicos del tenant sobre este contacto
    name VARCHAR(255) NOT NULL, -- Cómo el tenant conoce al contacto
    nickname VARCHAR(100), -- Alias opcional

    -- Canal y configuraciones
    preferred_channel VARCHAR(20) DEFAULT 'whatsapp'
        CHECK (preferred_channel IN ('whatsapp', 'telegram', 'auto')),

    -- WhatsApp específico
    whatsapp_id VARCHAR(50), -- ID de WhatsApp del contacto
    opt_in_status opt_in_status NOT NULL DEFAULT 'pending',
    opt_in_date TIMESTAMPTZ,
    opt_out_date TIMESTAMPTZ,

    -- Telegram específico
    telegram_opt_in_status opt_in_status DEFAULT 'pending',

    -- Configuración personal
    timezone VARCHAR(50), -- Si es diferente al tenant
    preferred_language VARCHAR(5) DEFAULT 'es',

    -- Metadatos específicos del tenant
    metadata JSONB DEFAULT '{}',

    -- Auditoría
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Un tenant no puede tener el mismo contact_profile dos veces
    UNIQUE(tenant_id, contact_profile_id),

    -- Constraints
    CONSTRAINT valid_timezone_tenant_contact CHECK (
        timezone IS NULL OR timezone ~ '^[A-Za-z_/]+$'
    )
);

-- Índices para búsquedas rápidas
CREATE INDEX idx_tenant_contacts_tenant_id ON tenant_contacts(tenant_id);
CREATE INDEX idx_tenant_contacts_profile_id ON tenant_contacts(contact_profile_id);
CREATE INDEX idx_tenant_contacts_name ON tenant_contacts(tenant_id, name);
CREATE INDEX idx_tenant_contacts_preferred_channel ON tenant_contacts(tenant_id, preferred_channel);

-- Comentarios
COMMENT ON TABLE contact_profiles IS 'Perfiles globales de contactos sin duplicados por teléfono/Telegram';
COMMENT ON TABLE tenant_contacts IS 'Relación many-to-many entre tenants y contact_profiles';
COMMENT ON COLUMN tenant_contacts.name IS 'Nombre como el tenant conoce al contacto';
COMMENT ON COLUMN tenant_contacts.nickname IS 'Alias opcional del contacto para este tenant';

-- =====================================================
-- 2. MIGRAR DATOS EXISTENTES
-- =====================================================

-- Insertar contact_profiles únicos basados en phone_e164 y telegram_id
INSERT INTO contact_profiles (
    phone_e164,
    telegram_id,
    telegram_username,
    telegram_first_name,
    telegram_last_name,
    created_at,
    updated_at
)
SELECT DISTINCT
    CASE WHEN phone_e164 = '+000000000000' THEN NULL ELSE phone_e164 END, -- Limpiar placeholders
    telegram_id,
    telegram_username,
    telegram_first_name,
    telegram_last_name,
    MIN(created_at), -- Tomar la fecha más antigua
    NOW()
FROM contacts
WHERE phone_e164 IS NOT NULL OR telegram_id IS NOT NULL
GROUP BY
    CASE WHEN phone_e164 = '+000000000000' THEN NULL ELSE phone_e164 END,
    telegram_id,
    telegram_username,
    telegram_first_name,
    telegram_last_name;

-- Insertar tenant_contacts relacionando con contact_profiles
INSERT INTO tenant_contacts (
    tenant_id,
    contact_profile_id,
    name,
    preferred_channel,
    whatsapp_id,
    opt_in_status,
    opt_in_date,
    opt_out_date,
    telegram_opt_in_status,
    timezone,
    preferred_language,
    metadata,
    created_at,
    updated_at
)
SELECT
    c.tenant_id,
    cp.id as contact_profile_id,
    c.name,
    COALESCE(c.preferred_channel, 'whatsapp'),
    c.whatsapp_id,
    c.opt_in_status,
    c.opt_in_date,
    c.opt_out_date,
    COALESCE(c.telegram_opt_in_status, 'pending'::opt_in_status),
    c.timezone,
    c.preferred_language,
    c.metadata,
    c.created_at,
    c.updated_at
FROM contacts c
JOIN contact_profiles cp ON (
    -- Relacionar por phone_e164
    (c.phone_e164 IS NOT NULL
     AND c.phone_e164 != '+000000000000'
     AND cp.phone_e164 = c.phone_e164)
    OR
    -- Relacionar por telegram_id
    (c.telegram_id IS NOT NULL
     AND cp.telegram_id = c.telegram_id)
);

-- =====================================================
-- 3. ACTUALIZAR FOREIGN KEYS EN TABLAS DEPENDIENTES
-- =====================================================

-- Agregar nueva columna tenant_contact_id a agreements
ALTER TABLE agreements ADD COLUMN tenant_contact_id UUID;

-- Actualizar agreements para apuntar a tenant_contacts
UPDATE agreements
SET tenant_contact_id = tc.id
FROM tenant_contacts tc
WHERE agreements.contact_id = (
    SELECT c.id
    FROM contacts c
    JOIN contact_profiles cp ON (
        (c.phone_e164 IS NOT NULL AND c.phone_e164 != '+000000000000' AND cp.phone_e164 = c.phone_e164)
        OR (c.telegram_id IS NOT NULL AND cp.telegram_id = c.telegram_id)
    )
    WHERE tc.contact_profile_id = cp.id
    AND tc.tenant_id = agreements.tenant_id
    LIMIT 1
);

-- Agregar nueva columna tenant_contact_id a messages
ALTER TABLE messages ADD COLUMN tenant_contact_id UUID;

-- Actualizar messages para apuntar a tenant_contacts
UPDATE messages
SET tenant_contact_id = tc.id
FROM tenant_contacts tc
WHERE messages.contact_id = (
    SELECT c.id
    FROM contacts c
    JOIN contact_profiles cp ON (
        (c.phone_e164 IS NOT NULL AND c.phone_e164 != '+000000000000' AND cp.phone_e164 = c.phone_e164)
        OR (c.telegram_id IS NOT NULL AND cp.telegram_id = c.telegram_id)
    )
    WHERE tc.contact_profile_id = cp.id
    AND tc.tenant_id = messages.tenant_id
    LIMIT 1
);

-- =====================================================
-- 4. VALIDAR MIGRACIÓN
-- =====================================================

-- Verificar que todos los records tienen su tenant_contact_id
DO $$
DECLARE
    orphaned_agreements INTEGER;
    orphaned_messages INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphaned_agreements FROM agreements WHERE tenant_contact_id IS NULL;
    SELECT COUNT(*) INTO orphaned_messages FROM messages WHERE tenant_contact_id IS NULL;

    IF orphaned_agreements > 0 THEN
        RAISE WARNING 'Se encontraron % agreements sin tenant_contact_id', orphaned_agreements;
    END IF;

    IF orphaned_messages > 0 THEN
        RAISE WARNING 'Se encontraron % messages sin tenant_contact_id', orphaned_messages;
    END IF;

    RAISE NOTICE 'Migración completada. Contact profiles: %, Tenant contacts: %',
        (SELECT COUNT(*) FROM contact_profiles),
        (SELECT COUNT(*) FROM tenant_contacts);
END $$;