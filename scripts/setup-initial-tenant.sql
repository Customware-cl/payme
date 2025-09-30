-- Setup script para crear tenant inicial y datos de prueba
-- Ejecutar una sola vez para inicializar el sistema

-- 1. Crear tenant principal
INSERT INTO tenants (
    id,
    name,
    domain,
    timezone,
    language,
    currency,
    whatsapp_phone_number_id,
    whatsapp_business_account_id,
    whatsapp_access_token,
    verify_token,
    webhook_secret,
    settings,
    status
) VALUES (
    gen_random_uuid(),
    'PrestaBot Chile',
    'prestabot.cl',
    'America/Santiago',
    'es_CL',
    'CLP',
    '778143428720890',
    '773972555504544',
    'EAFU9IECsZBf0BPhU9vqt3jD9tZCeTu45HkCbjyXI02pKilI2XPMbqSY0y7tKBMsJSjOcqXd3rLndeteJJMDYP8kh1FkGK2tdpEdbx53m30MQPINvOsfsgMFu3Icf2ekRZCx2UVwEpJOC9G1GKOSeWzRN7qsAr19dPrjZC3f0ZBebseEowZCAWMEPh1Ys0alYjS7aSWlnp2mFtXwZAn0gtSVjbR0pEieItZBQihKlLJCX',
    'token_prestabot_2025',
    'token_prestabot_2025',
    '{
        "auto_create_contacts": true,
        "default_reminder_config": {
            "enabled": true,
            "before_24h": true,
            "due_date": true,
            "overdue": true
        },
        "conversation_timeout_minutes": 30
    }'::jsonb,
    'active'
) ON CONFLICT (id) DO NOTHING;

-- 2. Obtener el tenant ID para crear usuario
WITH tenant_data AS (
    SELECT id as tenant_id FROM tenants WHERE name = 'PrestaBot Chile' LIMIT 1
)
-- 3. Crear usuario administrador (simulado)
INSERT INTO users (
    id,
    tenant_id,
    auth_user_id,
    email,
    name,
    role,
    status,
    last_login_at
)
SELECT
    gen_random_uuid(),
    tenant_data.tenant_id,
    gen_random_uuid(), -- Auth user ID simulado
    'admin@prestabot.cl',
    'Administrador PrestaBot',
    'owner',
    'active',
    NOW()
FROM tenant_data
ON CONFLICT (email, tenant_id) DO NOTHING;

-- 4. Crear contacto de prueba
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
    'accepted',
    'es_CL',
    'America/Santiago',
    '{"created_from": "setup_script", "is_test_user": true}'::jsonb
FROM tenant_data
ON CONFLICT (tenant_id, phone_e164) DO NOTHING;

-- 5. Verificar datos creados
SELECT
    'Tenant creado:' as info,
    t.name,
    t.domain,
    t.timezone,
    t.currency,
    t.status
FROM tenants t
WHERE t.name = 'PrestaBot Chile';

SELECT
    'Usuario creado:' as info,
    u.name,
    u.email,
    u.role,
    u.status
FROM users u
JOIN tenants t ON u.tenant_id = t.id
WHERE t.name = 'PrestaBot Chile';

SELECT
    'Contacto creado:' as info,
    c.name,
    c.phone_e164,
    c.opt_in_status,
    c.preferred_language
FROM contacts c
JOIN tenants t ON c.tenant_id = t.id
WHERE t.name = 'PrestaBot Chile';

-- 6. Mensaje de éxito
SELECT 'Setup completo - Sistema listo para pruebas' as status;