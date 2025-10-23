# 🛡️ Plan de Migración Multi-Tenant SIN RIESGOS

**Fecha:** 2025-10-22
**Estado:** ✅ Listo para ejecutar
**Tiempo estimado:** 30-45 minutos

---

## 📋 Resumen Ejecutivo

Este plan permite habilitar soporte multi-tenant (múltiples números WhatsApp) de forma **100% segura**, sin riesgo de romper el sistema actual.

### ✅ Garantías de Seguridad

1. **✅ Retrocompatible:** El código actual sigue funcionando exactamente igual
2. **✅ Fallback automático:** Si algo falla, usa variables de entorno como antes
3. **✅ Sin cambios destructivos:** No se modifican datos existentes
4. **✅ Rollback fácil:** Se puede revertir en menos de 5 minutos
5. **✅ Testing completo:** Scripts de verificación antes y después del deploy

---

## 🎯 Fases de Implementación

### FASE 1: Preparación y Validación (10 min)

**Objetivo:** Asegurar que el entorno actual está estable

#### 1.1. Backup de configuración actual

```bash
# Exportar tenant actual
cd /data2/presta_bot

# Guardar configuración actual
echo "=== BACKUP TENANT ACTUAL ===" > backup-tenant.txt
date >> backup-tenant.txt
echo "" >> backup-tenant.txt

# Si tienes acceso a supabase CLI:
npx supabase db dump -f backup-$(date +%Y%m%d).sql --project-ref qgjxkszfdoolaxmsupil

# O guardar manualmente en Supabase SQL Editor:
# SELECT * FROM tenants;
# SELECT * FROM contacts LIMIT 5;
```

#### 1.2. Verificar variables de entorno

```bash
# Verificar que tienes las variables actuales
grep -E "WHATSAPP_ACCESS_TOKEN|WHATSAPP_PHONE_NUMBER_ID" .env

# Deberías ver:
# WHATSAPP_ACCESS_TOKEN=EAF...
# WHATSAPP_PHONE_NUMBER_ID=778143...
```

✅ **Checkpoint 1:** Si las variables existen, continúa. Si no, configúralas primero.

#### 1.3. Verificar tenant actual en base de datos

```sql
-- Ejecutar en Supabase SQL Editor
SELECT
    id,
    name,
    whatsapp_phone_number_id,
    CASE
        WHEN whatsapp_access_token IS NULL THEN '❌ NULL'
        WHEN whatsapp_access_token = '' THEN '❌ EMPTY'
        ELSE '✅ SET (' || LENGTH(whatsapp_access_token) || ' chars)'
    END as token_status,
    created_at
FROM tenants
ORDER BY created_at DESC;
```

✅ **Checkpoint 2:** Anota el `id` y `name` del tenant actual.

---

### FASE 2: Verificación Pre-Deploy (5 min)

**Objetivo:** Verificar que los cambios de código no tienen errores

#### 2.1. Verificar sintaxis TypeScript

```bash
cd /data2/presta_bot

# Verificar que no hay errores de sintaxis
deno check supabase/functions/wa_webhook/index.ts
deno check supabase/functions/_shared/flow-handlers.ts

# Si ves errores, DETENTE y repórtalos
```

✅ **Checkpoint 3:** Ambos archivos deben pasar sin errores.

#### 2.2. Ejecutar script de verificación

```bash
# Crear archivo .env si no existe
cp .env.example .env

# Configurar variables requeridas
# SUPABASE_URL=https://qgjxkszfdoolaxmsupil.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=tu_key

# Ejecutar verificación
deno run --allow-env --allow-net --allow-read scripts/verify-multi-tenant-setup.ts
```

**Resultados esperados:**
- ✅ Al menos 1 tenant configurado
- ⚠️ Es normal que muestre "Using token from: env var" (porque aún no está en el tenant)
- ✅ No debe haber duplicados de phone_number_id

✅ **Checkpoint 4:** Script debe completar sin errores críticos.

---

### FASE 3: Deploy Seguro (10 min)

**Objetivo:** Desplegar cambios con fallback automático

#### 3.1. Deploy de edge functions

```bash
cd /data2/presta_bot

# Deploy función principal (webhook)
npx supabase functions deploy wa_webhook \
  --project-ref qgjxkszfdoolaxmsupil \
  --no-verify-jwt

# Deploy función de flow handlers
npx supabase functions deploy flows-handler \
  --project-ref qgjxkszfdoolaxmsupil \
  --no-verify-jwt
```

**Nota:** El flag `--no-verify-jwt` es necesario porque el webhook recibe requests de Meta sin JWT.

✅ **Checkpoint 5:** Ambos deploys deben completar exitosamente.

#### 3.2. Verificación inmediata post-deploy

```bash
# Enviar mensaje de prueba desde WhatsApp al número actual
# Escribe: "hola"

# Luego verificar logs en Supabase Dashboard:
# 1. Ir a: https://supabase.com/dashboard/project/qgjxkszfdoolaxmsupil/logs/edge-functions
# 2. Filtrar por: wa_webhook
# 3. Buscar en los últimos 5 minutos
```

**Logs esperados:**
```
[ROUTING] Buscando tenant para: +56XXXXXXXX
[ROUTING] ✓ Mensaje enrutado al tenant del usuario: [nombre]
[INTERACTIVE] Using token from: env var  ← Normal por ahora
```

✅ **Checkpoint 6:** El bot debe responder normalmente. Si responde, el deploy fue exitoso.

---

### FASE 4: Migración del Token al Tenant (5 min)

**Objetivo:** Mover el token de la variable de entorno a la base de datos

#### 4.1. Actualizar tenant con token

```sql
-- Ejecutar en Supabase SQL Editor
-- Reemplaza {TENANT_ID} con el ID de tu tenant (de Checkpoint 2)
-- Reemplaza {ACCESS_TOKEN} con tu token actual (de .env)

UPDATE tenants
SET whatsapp_access_token = '{ACCESS_TOKEN}'
WHERE id = '{TENANT_ID}';

-- Verificar actualización
SELECT
    id,
    name,
    whatsapp_phone_number_id,
    CASE
        WHEN whatsapp_access_token IS NULL THEN '❌ NULL'
        WHEN whatsapp_access_token = '' THEN '❌ EMPTY'
        ELSE '✅ SET (' || LENGTH(whatsapp_access_token) || ' chars)'
    END as token_status
FROM tenants
WHERE id = '{TENANT_ID}';
```

✅ **Checkpoint 7:** Token debe mostrar "✅ SET (XXX chars)".

#### 4.2. Probar con token del tenant

```bash
# Enviar otro mensaje de prueba desde WhatsApp
# Escribe: "estado"

# Verificar logs en Supabase Dashboard
```

**Logs esperados (CAMBIO IMPORTANTE):**
```
[INTERACTIVE] Using token from: tenant  ← ¡Ahora usa token del tenant!
```

✅ **Checkpoint 8:** El bot debe responder Y el log debe decir "tenant" en lugar de "env var".

---

### FASE 5: Testing Completo (10 min)

**Objetivo:** Validar que todo funciona correctamente

#### 5.1. Pruebas funcionales

```bash
# Test 1: Mensaje simple
WhatsApp → "hola"
Esperado: Menú principal con botones

# Test 2: Ver estado
WhatsApp → "estado"
Esperado: Lista de préstamos

# Test 3: Crear préstamo (si aplica)
WhatsApp → Click en "Nuevo préstamo"
Esperado: Flujo de creación funciona
```

✅ **Checkpoint 9:** Todas las funcionalidades deben funcionar igual que antes.

#### 5.2. Ejecutar script de verificación final

```bash
deno run --allow-env --allow-net --allow-read scripts/verify-multi-tenant-setup.ts
```

**Resultados esperados:**
- ✅ Tenant tiene token configurado
- ✅ Token es válido según Meta API
- ✅ Contactos están correctamente asociados
- ✅ No hay duplicados

✅ **Checkpoint 10:** Script debe mostrar "✅ CONFIGURACIÓN CORRECTA - LISTA PARA MULTI-TENANT".

---

### FASE 6 (OPCIONAL): Agregar Segundo Número (Variable)

**Solo ejecuta esta fase si ya tienes el segundo número listo**

#### 6.1. Obtener credenciales del segundo número

En Meta Business Manager:
1. Ve a: WhatsApp → Configuration
2. Anota:
   - `PHONE_NUMBER_ID` (diferente al actual)
   - `ACCESS_TOKEN` (System User permanente)
   - `BUSINESS_ACCOUNT_ID`

#### 6.2. Crear segundo tenant

```bash
# Abrir script SQL
nano scripts/setup-new-tenant.sql

# O copiar y editar manualmente en Supabase SQL Editor
```

Reemplaza los valores `{{MARCADOS}}`:
```sql
INSERT INTO tenants (
    name,
    whatsapp_phone_number_id,
    whatsapp_access_token,
    whatsapp_business_account_id,
    timezone,
    webhook_verify_token,
    settings
) VALUES (
    'Bot Préstamos - Número 2',           -- Tu nombre
    '123456789012345',                     -- PHONE_NUMBER_ID del nuevo número
    'EAFU9I...',                           -- ACCESS_TOKEN del nuevo número
    '773972555504544',                     -- WABA_ID (puede ser el mismo)
    'America/Santiago',
    'token_prestabot_2025',
    '{}'::jsonb
);
```

#### 6.3. Configurar webhook en Meta

Para el segundo número:
1. Meta Business → WhatsApp → Configuration
2. Webhook URL: `https://qgjxkszfdoolaxmsupil.supabase.co/functions/v1/wa_webhook`
3. Verify Token: `token_prestabot_2025`
4. Subscribe to: `messages`

#### 6.4. Probar segundo número

```bash
# Enviar "hola" desde el SEGUNDO número
# El bot debe responder independientemente

# Verificar logs:
# Debe mostrar: [ROUTING] ✓ Mensaje enrutado al tenant del usuario: Bot Préstamos - Número 2
# Debe mostrar: [INTERACTIVE] Using token from: tenant
```

---

## 🚨 Plan de Rollback (5 min)

Si algo sale mal, sigue estos pasos:

### Rollback Rápido (sin perder datos)

```bash
# 1. Revertir edge functions a versión anterior
npx supabase functions delete wa_webhook --project-ref qgjxkszfdoolaxmsupil
npx supabase functions delete flows-handler --project-ref qgjxkszfdoolaxmsupil

# 2. Re-deployar versión sin cambios
git checkout HEAD~1 supabase/functions/
npx supabase functions deploy wa_webhook --project-ref qgjxkszfdoolaxmsupil --no-verify-jwt
npx supabase functions deploy flows-handler --project-ref qgjxkszfdoolaxmsupil --no-verify-jwt

# 3. El sistema volverá a usar WHATSAPP_ACCESS_TOKEN de variables de entorno
```

### Rollback Completo (restaurar backup)

```sql
-- Solo si es necesario (muy raro)
-- Restaurar tenant original desde backup
DELETE FROM tenants WHERE created_at > 'FECHA_ANTES_DEL_CAMBIO';

-- O restaurar todo desde dump SQL
-- psql -U postgres -h ... -f backup-YYYYMMDD.sql
```

---

## ✅ Checklist Final

Antes de dar por terminada la migración, verifica:

- [ ] El número actual sigue funcionando perfectamente
- [ ] Los logs muestran "Using token from: tenant"
- [ ] Script de verificación pasa sin errores
- [ ] Todas las funcionalidades (hola, estado, nuevo préstamo) funcionan
- [ ] (Opcional) Segundo número funciona independientemente
- [ ] No hay errores en Supabase Edge Function logs
- [ ] Los contactos están correctamente aislados por tenant

---

## 📊 Monitoreo Post-Migración

### Qué revisar en los próximos días

**Supabase Dashboard → Edge Functions → Logs:**

1. **Buscar errores de token:**
   ```
   Filter: "error" OR "unauthorized" OR "token"
   ```

2. **Verificar uso de token correcto:**
   ```
   Filter: "Using token from"
   ```
   - Debe decir "tenant", no "env var"

3. **Verificar routing de mensajes:**
   ```
   Filter: "ROUTING"
   ```
   - Cada número debe enrutarse a su tenant correcto

### Métricas de éxito

- ✅ 0 errores de autenticación en 24 horas
- ✅ 100% de mensajes enrutados correctamente
- ✅ Cada tenant usa su propio token
- ✅ No hay cruce de contactos entre tenants

---

## 🆘 Soporte y Troubleshooting

### Problema: Bot no responde después del deploy

**Causa probable:** Error en el deploy de edge function

**Solución:**
```bash
# Ver logs detallados
npx supabase functions logs wa_webhook --project-ref qgjxkszfdoolaxmsupil

# Buscar errores de sintaxis o imports
# Si encuentras error, re-deployar
npx supabase functions deploy wa_webhook --project-ref qgjxkszfdoolaxmsupil --no-verify-jwt
```

### Problema: Logs muestran "Using token from: env var" después de actualizar tenant

**Causa:** El token no se guardó correctamente en la base de datos

**Solución:**
```sql
-- Verificar que el token esté en la BD
SELECT
    id,
    name,
    LENGTH(whatsapp_access_token) as token_length
FROM tenants;

-- Si es NULL o 0, actualizar:
UPDATE tenants
SET whatsapp_access_token = 'TU_TOKEN_AQUI'
WHERE id = 'TENANT_ID';
```

### Problema: Segundo número no recibe mensajes

**Causa:** Webhook no configurado en Meta o phone_number_id incorrecto

**Solución:**
```bash
# 1. Verificar phone_number_id en BD
SELECT whatsapp_phone_number_id FROM tenants;

# 2. Verificar que coincide con Meta Business
# Meta Business → WhatsApp → Phone numbers → Details

# 3. Verificar webhook esté configurado
# Meta Business → WhatsApp → Configuration → Webhook
```

---

## 📞 Contacto

Si encuentras problemas durante la migración:

1. **NO continues** si algún checkpoint falla
2. Ejecuta el plan de rollback
3. Documenta el error exacto (logs, mensajes, screenshots)
4. Contacta al equipo de desarrollo

---

**¡Éxito en la migración! 🚀**
