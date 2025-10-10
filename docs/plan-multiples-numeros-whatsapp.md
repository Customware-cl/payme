# Plan: Duplicar Bot a Múltiples Números de WhatsApp

**Fecha:** 2025-10-03
**Estado:** Pendiente de Implementación

---

## Contexto

El sistema **ya está diseñado para multi-tenant** y puede soportar múltiples números de WhatsApp. La arquitectura actual tiene todo lo necesario:

- ✅ Tabla `tenants` con campos específicos por número
- ✅ Webhook que identifica el tenant por `phone_number_id`
- ✅ Separación completa de datos (RLS)
- ⚠️ **Bug encontrado**: Envío de mensajes usa token global en lugar de token del tenant

---

## Arquitectura Actual

### Base de Datos

```sql
CREATE TABLE tenants (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    whatsapp_phone_number_id VARCHAR(50),  -- ID único del número
    whatsapp_access_token TEXT,            -- Token específico del número
    whatsapp_business_account_id VARCHAR(50),
    -- ... otros campos
);
```

### Flujo de Mensajes Entrantes

1. Meta envía webhook con `phone_number_id` en metadata
2. `wa_webhook` busca tenant: `WHERE whatsapp_phone_number_id = ?`
3. Procesa mensaje con contexto del tenant correcto
4. Todos los datos se asocian al `tenant_id` correcto

### Problema Identificado

**Archivo:** `supabase/functions/wa_webhook/index.ts` línea 1539

```typescript
// ❌ ACTUAL - Usa token global
const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');

// ✅ DEBERÍA SER - Usar token del tenant
const accessToken = tenant.whatsapp_access_token;
```

**Impacto:** Todos los mensajes se envían con el mismo token, limitando a un solo número.

---

## Plan de Implementación

### Fase 1: Fix del Bug de Tokens (CRÍTICO)

**Objetivo:** Permitir que cada tenant use su propio token de WhatsApp.

#### 1.1. Modificar envío de mensajes

**Archivos a modificar:**
- `supabase/functions/wa_webhook/index.ts`

**Cambios:**

```typescript
// Buscar todas las instancias de:
const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');

// Reemplazar por:
const accessToken = tenant.whatsapp_access_token || Deno.env.get('WHATSAPP_ACCESS_TOKEN');
```

**Ubicaciones específicas:**
- Línea ~1539: Envío de mensajes interactivos (botones/flows)
- Cualquier otro lugar que envíe mensajes a WhatsApp

#### 1.2. Testing del fix

1. Verificar que el tenant actual tiene `whatsapp_access_token` poblado en DB
2. Probar envío de mensajes
3. Confirmar que no hay regresiones

---

### Fase 2: Configuración del Segundo Número en Meta

#### 2.1. Obtener credenciales del segundo número

**Requisitos previos:**
- Acceso a Meta Business Manager
- Segundo número de WhatsApp Business configurado
- Acceso a la app de WhatsApp Business

**Datos necesarios:**
1. `PHONE_NUMBER_ID` del segundo número
2. `ACCESS_TOKEN` permanente (System User token)
3. `BUSINESS_ACCOUNT_ID` (puede ser el mismo WABA o diferente)

#### 2.2. Configurar webhook en Meta

**URL del webhook:** (el mismo para todos los números)
```
https://qgjxkszfdoolaxmsupil.supabase.co/functions/v1/wa_webhook
```

**Verify Token:**
```
token_prestabot_2025
```

**Pasos:**
1. Ir a Meta for Developers → App → WhatsApp → Configuration
2. Agregar webhook URL
3. Seleccionar eventos: `messages`
4. Guardar

#### 2.3. Configurar WhatsApp Flows

Si el segundo número usará Flows:

```bash
# Configurar public key para el segundo número
curl -X POST "https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID_2}/whatsapp_business_encryption" \
  -H "Authorization: Bearer ${ACCESS_TOKEN_2}" \
  -d "business_public_key=$(cat whatsapp_flows_public_key.pem | tr -d '\n')"
```

**Nota:** Puede usar la misma clave pública que el primer número.

---

### Fase 3: Crear Segundo Tenant en Base de Datos

#### 3.1. Insertar nuevo tenant

```sql
INSERT INTO tenants (
    name,
    whatsapp_phone_number_id,
    whatsapp_access_token,
    whatsapp_business_account_id,
    timezone,
    settings
) VALUES (
    'Tenant Número 2',                    -- Nombre descriptivo
    '123456789012345',                    -- PHONE_NUMBER_ID del segundo número
    'EAFU9I...',                          -- ACCESS_TOKEN permanente del segundo número
    '773972555504544',                    -- WABA_ID (puede ser el mismo)
    'America/Santiago',                   -- Zona horaria
    '{}'::jsonb                          -- Configuración inicial
);
```

#### 3.2. Verificar creación

```sql
SELECT
    id,
    name,
    whatsapp_phone_number_id,
    created_at
FROM tenants
ORDER BY created_at DESC;
```

#### 3.3. Configurar Flows para el segundo número

Si usará Flows, insertar en `.env` o Supabase Secrets:

```bash
# Opcional: Crear Flow ID específico para el segundo tenant
WHATSAPP_PROFILE_FLOW_ID_TENANT2=1234567890
```

O usar el mismo Flow para ambos números (recomendado para simplificar).

---

### Fase 4: Testing y Validación

#### 4.1. Test del primer número (tenant existente)

1. Enviar "hola" desde el primer número
2. Verificar respuesta del bot
3. Probar comando "Mi Perfil" (Flow)
4. Confirmar logs en Supabase

**Logs esperados:**
```
[PROFILE_FLOW] Tenant ID: {tenant_1_id}
[PROFILE_FLOW] Contact ID: {contact_id}
```

#### 4.2. Test del segundo número (nuevo tenant)

1. Enviar "hola" desde el segundo número
2. Verificar respuesta del bot
3. Probar comando "Mi Perfil" (Flow)
4. Confirmar logs en Supabase

**Logs esperados:**
```
[PROFILE_FLOW] Tenant ID: {tenant_2_id}
[PROFILE_FLOW] Contact ID: {contact_id_diferente}
```

#### 4.3. Verificar aislamiento de datos

```sql
-- Contactos del Tenant 1
SELECT COUNT(*) FROM contacts WHERE tenant_id = '{tenant_1_id}';

-- Contactos del Tenant 2
SELECT COUNT(*) FROM contacts WHERE tenant_id = '{tenant_2_id}';

-- Verificar que no hay cruce
SELECT
    t.name as tenant_name,
    COUNT(c.id) as num_contacts
FROM tenants t
LEFT JOIN contacts c ON c.tenant_id = t.id
GROUP BY t.id, t.name;
```

#### 4.4. Verificar que cada número usa su token

**Método:** Revisar logs de requests a Meta

```typescript
// En wa_webhook, agregar log temporal:
console.log('[TOKEN_CHECK]', {
  tenant_id: tenant.id,
  tenant_name: tenant.name,
  token_prefix: accessToken.substring(0, 20) + '...'
});
```

Verificar que cada tenant usa un token diferente.

---

## Alternativa: Mismo Tenant, Múltiples Números

**No recomendada**, pero posible si necesitas:
- Números redundantes para el mismo negocio
- Compartir contactos entre números
- Balanceo de carga simple

**Implementación:**
1. No crear nuevo tenant
2. Agregar campos adicionales a tenant:
   ```sql
   ALTER TABLE tenants ADD COLUMN whatsapp_phone_number_id_2 VARCHAR(50);
   ALTER TABLE tenants ADD COLUMN whatsapp_access_token_2 TEXT;
   ```
3. Modificar webhook para buscar tenant por cualquiera de los dos IDs
4. Más complejo de mantener, no aprovecha la arquitectura multi-tenant

---

## Consideraciones Importantes

### 1. Tokens de Acceso

**Usar System User Tokens permanentes:**
- Duración: 60 días o sin vencimiento
- Permisos necesarios:
  - `business_management`
  - `whatsapp_business_management`
  - `whatsapp_business_messaging`

**Evitar:**
- Tokens temporales de 24 horas (causan interrupciones)
- Compartir el mismo token entre números (limita escalabilidad)

### 2. WhatsApp Flows

**Opciones:**
- **Opción A:** Mismo Flow JSON para ambos números
  - Más simple de mantener
  - Actualizar una vez afecta a todos

- **Opción B:** Flow JSON diferente por tenant
  - Mayor personalización
  - Requiere tabla `tenant_flows` o campo `flow_id` en tenants

**Recomendación:** Opción A inicialmente, migrar a B si se necesita personalización.

### 3. Costos de WhatsApp

Cada número tiene:
- Límite de conversaciones gratuitas mensuales
- Costos por conversación adicional
- Límite de mensajes por día (tier-based)

**Verificar:** Que tienes presupuesto para múltiples números.

### 4. Rate Limits

**Por número:**
- Tier 1: ~1,000 conversaciones/día
- Tier 2: ~10,000 conversaciones/día
- Tier 3+: Más

**Importante:** Cada número tiene su propio tier y límites.

---

## Roadmap de Implementación

### Sprint 1 (1-2 días)
- [ ] Fix del bug de tokens
- [ ] Testing con número existente
- [ ] Deploy a producción

### Sprint 2 (2-3 días)
- [ ] Obtener credenciales del segundo número
- [ ] Configurar webhook en Meta
- [ ] Crear tenant en DB
- [ ] Testing básico

### Sprint 3 (1-2 días)
- [ ] Configurar WhatsApp Flows para segundo número
- [ ] Testing completo
- [ ] Validación de aislamiento de datos
- [ ] Monitoreo y ajustes

---

## Checklist de Implementación

### Pre-requisitos
- [ ] Acceso a segundo número de WhatsApp Business
- [ ] Permisos de administrador en Meta Business Manager
- [ ] Acceso a Supabase Dashboard
- [ ] Backup de base de datos actual

### Fase 1: Fix de Tokens
- [ ] Identificar todas las llamadas a `WHATSAPP_ACCESS_TOKEN`
- [ ] Modificar para usar `tenant.whatsapp_access_token`
- [ ] Agregar fallback a env var para compatibilidad
- [ ] Testing local
- [ ] Deploy a producción
- [ ] Verificar que número actual funciona

### Fase 2: Meta Configuration
- [ ] Obtener `PHONE_NUMBER_ID` del segundo número
- [ ] Generar System User token permanente
- [ ] Configurar webhook en Meta
- [ ] Configurar public key para Flows (si aplica)
- [ ] Verificar webhook con test de Meta

### Fase 3: Database
- [ ] Insertar nuevo tenant con credenciales
- [ ] Verificar creación exitosa
- [ ] Configurar timezone y settings
- [ ] Opcional: Crear usuarios del tenant

### Fase 4: Testing
- [ ] Test número 1: Envío/recepción de mensajes
- [ ] Test número 2: Envío/recepción de mensajes
- [ ] Test número 1: WhatsApp Flows
- [ ] Test número 2: WhatsApp Flows
- [ ] Verificar aislamiento de datos
- [ ] Verificar tokens correctos por tenant
- [ ] Pruebas de carga (opcional)

### Fase 5: Documentación
- [ ] Actualizar README con configuración multi-número
- [ ] Documentar proceso de agregar nuevos números
- [ ] Agregar sección de troubleshooting
- [ ] Actualizar diagramas de arquitectura

---

## Troubleshooting

### Problema: "Tenant not found"

**Causa:** El `phone_number_id` en el webhook no coincide con ningún tenant.

**Solución:**
```sql
-- Verificar phone_number_id del tenant
SELECT id, name, whatsapp_phone_number_id
FROM tenants
WHERE whatsapp_phone_number_id = '{phone_number_id_from_webhook}';

-- Si está vacío, actualizar
UPDATE tenants
SET whatsapp_phone_number_id = '{correct_phone_number_id}'
WHERE id = '{tenant_id}';
```

### Problema: Mensajes no se envían desde segundo número

**Causa:** Token incorrecto o expirado.

**Solución:**
```sql
-- Verificar token del tenant
SELECT id, name,
  CASE
    WHEN whatsapp_access_token IS NULL THEN 'NULL'
    WHEN whatsapp_access_token = '' THEN 'EMPTY'
    ELSE 'SET (' || LENGTH(whatsapp_access_token) || ' chars)'
  END as token_status
FROM tenants;

-- Actualizar token
UPDATE tenants
SET whatsapp_access_token = '{new_permanent_token}'
WHERE id = '{tenant_id}';

-- Re-deploy edge function para limpiar cache
npx supabase functions deploy wa_webhook --project-ref qgjxkszfdoolaxmsupil --no-verify-jwt
```

### Problema: Datos se mezclan entre tenants

**Causa:** Bug en lógica de aislamiento o falta de RLS.

**Diagnóstico:**
```sql
-- Verificar que contacts tienen tenant_id correcto
SELECT
  c.id,
  c.phone_e164,
  c.tenant_id,
  t.name as tenant_name
FROM contacts c
JOIN tenants t ON t.id = c.tenant_id
ORDER BY c.created_at DESC
LIMIT 20;

-- Verificar RLS está activo
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('contacts', 'agreements', 'reminders');
```

**Solución:**
- Verificar que todas las queries incluyen `WHERE tenant_id = ?`
- Habilitar RLS en tablas faltantes
- Revisar políticas RLS existentes

### Problema: WhatsApp Flows no funcionan en segundo número

**Causa:** Public key no configurado para ese número.

**Solución:**
```bash
# Configurar public key
curl -X POST "https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID_2}/whatsapp_business_encryption" \
  -H "Authorization: Bearer ${ACCESS_TOKEN_2}" \
  -d "business_public_key=$(cat whatsapp_flows_public_key.pem | tr -d '\n')"

# Verificar configuración
curl "https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID_2}/whatsapp_business_encryption" \
  -H "Authorization: Bearer ${ACCESS_TOKEN_2}"
```

---

## Métricas de Éxito

Al completar la implementación, deberías poder:

- ✅ Enviar/recibir mensajes desde ambos números
- ✅ Cada número tiene sus propios contactos separados
- ✅ Cada número usa su propio token de acceso
- ✅ WhatsApp Flows funcionan en ambos números
- ✅ No hay cruce de datos entre tenants
- ✅ Los logs identifican claramente cada tenant
- ✅ Ambos números responden independientemente

---

## Referencias

- **Documentación Multi-tenant:** `/data2/presta_bot/docs/whatsapp-flows-guide.md`
- **Schema DB:** `/data2/presta_bot/supabase/migrations/001_initial_schema.sql`
- **Webhook Handler:** `/data2/presta_bot/supabase/functions/wa_webhook/index.ts`
- **WhatsApp API Docs:** https://developers.facebook.com/docs/whatsapp/cloud-api/

---

**Última actualización:** 2025-10-03
**Autor:** Claude Code
**Estado:** Documento de planificación - Pendiente de aprobación
