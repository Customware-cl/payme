-- Setup script corregido para crear tenant inicial
-- Basado en la estructura real de las tablas

-- 1. Crear tenant principal
INSERT INTO tenants (
    id,
    name,
    timezone,
    whatsapp_phone_number_id,
    whatsapp_business_account_id,
    whatsapp_access_token,
    webhook_verify_token,
    settings
) VALUES (
    gen_random_uuid(),
    'PrestaBot Chile',
    'America/Santiago',
    '778143428720890',
    '773972555504544',
    'EAFU9IECsZBf0BPhU9vqt3jD9tZCeTu45HkCbjyXI02pKilI2XPMbqSY0y7tKBMsJSjOcqXd3rLndeteJJMDYP8kh1FkGK2tdpEdbx53m30MQPINvOsfsgMFu3Icf2ekRZCx2UVwEpJOC9G1GKOSeWzRN7qsAr19dPrjZC3f0ZBebseEowZCAWMEPh1Ys0alYjS7aSWlnp2mFtXwZAn0gtSVjbR0pEieItZBQihKlLJCX',
    'token_prestabot_2025',
    '{
        "auto_create_contacts": true,
        "default_reminder_config": {
            "enabled": true,
            "before_24h": true,
            "due_date": true,
            "overdue": true
        },
        "conversation_timeout_minutes": 30,
        "currency": "CLP",
        "language": "es_CL"
    }'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- 2. Crear usuario administrador
WITH tenant_data AS (
    SELECT id as tenant_id FROM tenants WHERE name = 'PrestaBot Chile' LIMIT 1
)
INSERT INTO users (
    id,
    tenant_id,
    auth_user_id,
    email,
    role,
    first_name,
    last_name,
    last_login_at
)
SELECT
    gen_random_uuid(),
    tenant_data.tenant_id,
    gen_random_uuid(),
    'admin@prestabot.cl',
    'owner',
    'Administrador',
    'PrestaBot',
    NOW()
FROM tenant_data
ON CONFLICT (tenant_id, email) DO NOTHING;

-- 3. Crear contacto de prueba
WITH tenant_data AS (
    SELECT id as tenant_id FROM tenants WHERE name = 'PrestaBot Chile' LIMIT 1
)
INSERT INTO contacts (
    id,
    tenant_id,
    phone_e164,
    name,
    opt_in_status,
    preferred_language,
    timezone,
    metadata
)
SELECT
    gen_random_uuid(),
    tenant_data.tenant_id,
    '+56964943476',
    'Usuario de Prueba',
    'opted_in',
    'es',
    'America/Santiago',
    '{"created_from": "setup_script", "is_test_user": true}'::jsonb
FROM tenant_data
ON CONFLICT (tenant_id, phone_e164) DO NOTHING;

-- 4. Verificar datos creados
SELECT
    'Tenant:' as info,
    t.name,
    t.timezone,
    t.whatsapp_phone_number_id
FROM tenants t
WHERE t.name = 'PrestaBot Chile';

SELECT
    'Usuario:' as info,
    u.email,
    u.role,
    u.first_name,
    u.last_name
FROM users u
JOIN tenants t ON u.tenant_id = t.id
WHERE t.name = 'PrestaBot Chile';

SELECT
    'Contacto:' as info,
    c.name,
    c.phone_e164,
    c.opt_in_status
FROM contacts c
JOIN tenants t ON c.tenant_id = t.id
WHERE t.name = 'PrestaBot Chile';

SELECT 'Setup completo - Sistema listo para pruebas' as status;