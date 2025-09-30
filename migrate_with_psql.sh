#!/bin/bash

# Script para ejecutar migración 014 usando psql directo
set -e

echo "🚀 Ejecutando migración 014 con psql directo..."

# Cargar variables de entorno
if [ -f .env ]; then
    set -a
    source .env
    set +a
else
    echo "❌ Archivo .env no encontrado"
    exit 1
fi

# Construir URL de conexión PostgreSQL
DB_URL="postgresql://postgres.qgjxkszfdoolaxmsupil:${DATABASE_PASSWORD}@aws-1-sa-east-1.pooler.supabase.com:6543/postgres"

echo "📝 Ejecutando migración 014..."

# Ejecutar migración usando psql via Docker
docker run --rm -i postgres:15 psql "$DB_URL" << 'EOF'
-- Migración 014: Implementar tabla de relaciones para evitar contactos duplicados

-- Crear tabla contact_profiles
CREATE TABLE IF NOT EXISTS contact_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_e164 VARCHAR(20),
    telegram_id VARCHAR(50),
    telegram_username VARCHAR(50),
    telegram_first_name VARCHAR(255),
    telegram_last_name VARCHAR(255),
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT phone_or_telegram_required CHECK (
        phone_e164 IS NOT NULL OR telegram_id IS NOT NULL
    ),
    CONSTRAINT valid_phone_format CHECK (
        phone_e164 IS NULL OR phone_e164 ~ '^\+[1-9]\d{1,14}$'
    )
);

-- Crear índices únicos
CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_profiles_phone ON contact_profiles(phone_e164)
    WHERE phone_e164 IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_profiles_telegram_id ON contact_profiles(telegram_id)
    WHERE telegram_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_profiles_telegram_username ON contact_profiles(telegram_username)
    WHERE telegram_username IS NOT NULL;

-- Crear tabla tenant_contacts
CREATE TABLE IF NOT EXISTS tenant_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_profile_id UUID NOT NULL REFERENCES contact_profiles(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    nickname VARCHAR(100),
    preferred_channel VARCHAR(20) DEFAULT 'whatsapp'
        CHECK (preferred_channel IN ('whatsapp', 'telegram', 'auto')),
    whatsapp_id VARCHAR(50),
    opt_in_status opt_in_status NOT NULL DEFAULT 'pending',
    opt_in_date TIMESTAMPTZ,
    opt_out_date TIMESTAMPTZ,
    telegram_opt_in_status opt_in_status DEFAULT 'pending',
    timezone VARCHAR(50),
    preferred_language VARCHAR(5) DEFAULT 'es',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, contact_profile_id),
    CONSTRAINT valid_timezone_tenant_contact CHECK (
        timezone IS NULL OR timezone ~ '^[A-Za-z_/]+$'
    )
);

-- Crear índices para tenant_contacts
CREATE INDEX IF NOT EXISTS idx_tenant_contacts_tenant_id ON tenant_contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_contacts_profile_id ON tenant_contacts(contact_profile_id);
CREATE INDEX IF NOT EXISTS idx_tenant_contacts_name ON tenant_contacts(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_tenant_contacts_preferred_channel ON tenant_contacts(tenant_id, preferred_channel);

-- Agregar columnas a tablas existentes
ALTER TABLE agreements ADD COLUMN IF NOT EXISTS tenant_contact_id UUID;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS tenant_contact_id UUID;

-- Migrar datos existentes a contact_profiles
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
    CASE WHEN phone_e164 = '+000000000000' THEN NULL ELSE phone_e164 END,
    telegram_id,
    telegram_username,
    telegram_first_name,
    telegram_last_name,
    MIN(created_at),
    NOW()
FROM contacts
WHERE phone_e164 IS NOT NULL OR telegram_id IS NOT NULL
GROUP BY
    CASE WHEN phone_e164 = '+000000000000' THEN NULL ELSE phone_e164 END,
    telegram_id,
    telegram_username,
    telegram_first_name,
    telegram_last_name
ON CONFLICT DO NOTHING;

-- Migrar datos a tenant_contacts
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
    (c.phone_e164 IS NOT NULL
     AND c.phone_e164 != '+000000000000'
     AND cp.phone_e164 = c.phone_e164)
    OR
    (c.telegram_id IS NOT NULL
     AND cp.telegram_id = c.telegram_id)
)
ON CONFLICT DO NOTHING;

-- Comentarios
COMMENT ON TABLE contact_profiles IS 'Perfiles globales de contactos sin duplicados por teléfono/Telegram';
COMMENT ON TABLE tenant_contacts IS 'Relación many-to-many entre tenants y contact_profiles';

\echo 'Migración 014 completada exitosamente'
EOF

echo "✅ Migración 014 ejecutada correctamente"
echo "🎉 Tablas contact_profiles y tenant_contacts creadas y pobladas"