-- =====================================================
-- Script para configurar nuevo tenant (número WhatsApp)
-- =====================================================
-- INSTRUCCIONES:
-- 1. Reemplaza los valores entre {{ }} con tus datos reales
-- 2. Ejecuta este script en Supabase SQL Editor
-- 3. Guarda el tenant_id generado para verificación
-- =====================================================

-- PASO 1: Insertar nuevo tenant
-- =====================================================

INSERT INTO tenants (
    name,
    whatsapp_phone_number_id,
    whatsapp_access_token,
    whatsapp_business_account_id,
    timezone,
    webhook_verify_token,
    settings
) VALUES (
    '{{NOMBRE_TENANT}}',                    -- Ej: 'Bot Préstamos - Número 2'
    '{{PHONE_NUMBER_ID}}',                  -- Ej: '123456789012345' (obtener de Meta Business)
    '{{ACCESS_TOKEN}}',                     -- Token permanente (System User Token de Meta)
    '{{BUSINESS_ACCOUNT_ID}}',              -- Ej: '773972555504544' (WABA ID)
    'America/Santiago',                      -- Timezone de Chile
    'token_prestabot_2025',                 -- Mismo verify token
    '{
        "whatsapp_flows": {
            "profile_flow_id": "{{PROFILE_FLOW_ID}}",
            "bank_accounts_flow_id": "{{BANK_ACCOUNTS_FLOW_ID}}"
        }
    }'::jsonb
)
RETURNING id, name, whatsapp_phone_number_id;

-- NOTA: Guarda el ID generado para usar en verificaciones


-- =====================================================
-- PASO 2: Verificar tenant creado
-- =====================================================

SELECT
    id,
    name,
    whatsapp_phone_number_id,
    CASE
        WHEN whatsapp_access_token IS NULL THEN '❌ NULL'
        WHEN whatsapp_access_token = '' THEN '❌ EMPTY'
        ELSE '✅ SET (' || LENGTH(whatsapp_access_token) || ' chars)'
    END as token_status,
    whatsapp_business_account_id,
    timezone,
    created_at
FROM tenants
ORDER BY created_at DESC
LIMIT 5;


-- =====================================================
-- PASO 3: Verificar que no hay duplicados
-- =====================================================

SELECT
    whatsapp_phone_number_id,
    COUNT(*) as count,
    STRING_AGG(name, ', ') as tenant_names
FROM tenants
WHERE whatsapp_phone_number_id IS NOT NULL
GROUP BY whatsapp_phone_number_id
HAVING COUNT(*) > 1;

-- Si este query devuelve filas, tienes números duplicados (ERROR)


-- =====================================================
-- OPCIONAL: Crear usuario admin para el tenant
-- =====================================================

-- Descomenta y ejecuta si necesitas un usuario administrador

/*
INSERT INTO users (
    tenant_id,
    email,
    role,
    first_name,
    last_name
) VALUES (
    '{{TENANT_ID}}',                        -- ID del tenant creado en PASO 1
    '{{ADMIN_EMAIL}}',                      -- Ej: 'admin@empresa.com'
    'owner',                                -- owner, admin, o member
    '{{FIRST_NAME}}',                       -- Nombre
    '{{LAST_NAME}}'                         -- Apellido
)
RETURNING id, email, role;
*/


-- =====================================================
-- INSTRUCCIONES POST-INSTALACIÓN
-- =====================================================

/*

✅ CHECKLIST DE CONFIGURACIÓN EN META BUSINESS:

1. Webhook Configuration:
   - URL: https://qgjxkszfdoolaxmsupil.supabase.co/functions/v1/wa_webhook
   - Verify Token: token_prestabot_2025
   - Eventos suscritos: messages, message_status (opcional)

2. System User Token:
   - Debe ser permanente (60 días o sin expiración)
   - Permisos requeridos:
     * business_management
     * whatsapp_business_management
     * whatsapp_business_messaging

3. WhatsApp Flows (si aplica):
   Ejecutar en terminal:

   curl -X POST "https://graph.facebook.com/v21.0/{{PHONE_NUMBER_ID}}/whatsapp_business_encryption" \
     -H "Authorization: Bearer {{ACCESS_TOKEN}}" \
     -d "business_public_key=$(cat whatsapp_flows_public_key.pem | tr -d '\n')"

   Verificar:

   curl "https://graph.facebook.com/v21.0/{{PHONE_NUMBER_ID}}/whatsapp_business_encryption" \
     -H "Authorization: Bearer {{ACCESS_TOKEN}}"


📊 VERIFICACIÓN DE FUNCIONAMIENTO:

1. Enviar mensaje de prueba desde el nuevo número
2. Revisar logs en Supabase Dashboard
3. Verificar que el tenant correcto recibe el mensaje:

   SELECT
       t.name as tenant_name,
       c.name as contact_name,
       c.phone_e164,
       c.created_at
   FROM contacts c
   JOIN tenants t ON t.id = c.tenant_id
   WHERE t.whatsapp_phone_number_id = '{{PHONE_NUMBER_ID}}'
   ORDER BY c.created_at DESC
   LIMIT 5;

*/
