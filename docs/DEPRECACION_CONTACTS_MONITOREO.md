# Monitoreo de Deprecación de Sistema Legacy de Contactos

## 🎯 Estado Actual

**Fases completadas:**
- ✅ **FASE 1**: Data Migration (migración 032 aplicada)
- ✅ **FASE 2**: Code Migration (edge functions desplegadas)

**Fases pendientes:**
- ⏳ **FASE 3**: Schema Migration (migración 033 **NO aplicada**, punto de no retorno)
- ⏳ **FASE 4**: Cleanup Final (migración 034 **NO aplicada**, irreversible)

---

## 📊 Qué Monitorear (Próximas 24-48 horas)

### 1. Logs de Edge Functions

#### a) Verificar que NO hay errores de FK
```bash
# En Dashboard de Supabase → Functions → wa_webhook → Logs
# Buscar errores relacionados con:
```

❌ **Errores a buscar (NO deberían aparecer):**
```
foreign key constraint "fk_whatsapp_messages_tenant_contact" violated
Key (tenant_contact_id)=(...) is not present in table "tenant_contacts"
```

✅ **Logs esperados (deberían aparecer):**
```
[Webhook] Using tenant_contact: <uuid>
[Webhook] Message saved successfully
```

#### b) Verificar inserts exitosos
```sql
-- Ejecutar en SQL Editor para verificar que nuevos mensajes tienen tenant_contact_id
SELECT
  id,
  created_at,
  tenant_contact_id,
  contact_id,
  direction
FROM whatsapp_messages
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;
```

**Resultado esperado:**
- ✅ `tenant_contact_id`: debe tener UUID válido
- ✅ `contact_id`: debe ser NULL
- ❌ Si `tenant_contact_id` es NULL → **PROBLEMA**, contactar soporte

### 2. Verificar Events

```sql
-- Verificar que eventos recientes usan tenant_contact_id
SELECT
  id,
  created_at,
  event_type,
  tenant_contact_id,
  contact_id
FROM events
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;
```

**Resultado esperado:**
- ✅ `tenant_contact_id`: debe tener UUID válido
- ✅ `contact_id`: debe ser NULL

### 3. Verificar Integridad de Datos Migrados

```sql
-- Contar registros con tenant_contact_id NULL (debería ser 0)
SELECT
  'whatsapp_messages' as tabla,
  COUNT(*) as nulls_count
FROM whatsapp_messages
WHERE contact_id IS NOT NULL AND tenant_contact_id IS NULL

UNION ALL

SELECT
  'events' as tabla,
  COUNT(*) as nulls_count
FROM events
WHERE contact_id IS NOT NULL AND tenant_contact_id IS NULL

UNION ALL

SELECT
  'messages' as tabla,
  COUNT(*) as nulls_count
FROM messages
WHERE contact_id IS NOT NULL AND tenant_contact_id IS NULL;
```

**Resultado esperado:**
- ✅ Todas las filas: `nulls_count = 0`
- ❌ Si hay nulls → ejecutar backfill manual:

```sql
-- Backfill manual si es necesario
UPDATE whatsapp_messages wm
SET tenant_contact_id = c.tenant_contact_id
FROM contacts c
WHERE wm.contact_id = c.id
  AND wm.tenant_contact_id IS NULL;
```

### 4. Performance de Queries

```sql
-- Verificar que queries con tenant_contact_id son rápidas
EXPLAIN ANALYZE
SELECT created_at, content
FROM whatsapp_messages
WHERE tenant_contact_id = '<algún-uuid-real>'
  AND tenant_id = '<algún-tenant-uuid>'
ORDER BY created_at DESC
LIMIT 20;
```

**Resultado esperado:**
- ✅ Execution Time: < 10ms
- ✅ Debe usar índice: `idx_whatsapp_messages_tenant_contact_id`

---

## ⚠️ Señales de Alerta

### 🔴 CRÍTICO - Detener si aparece:

1. **FK Constraint Violations**
   ```
   Error: foreign key constraint violated
   Key (tenant_contact_id)=(...) is not present
   ```
   → **Acción**: Rollback código inmediatamente

2. **NULL tenant_contact_id en registros nuevos**
   ```sql
   SELECT COUNT(*) FROM whatsapp_messages
   WHERE created_at > NOW() - INTERVAL '1 hour'
     AND tenant_contact_id IS NULL;
   -- Si retorna > 0 → PROBLEMA
   ```
   → **Acción**: Revisar código de wa_webhook, puede haber error en deploy

3. **Errores de "column does not exist"**
   ```
   Error: column "contact_id" of relation "whatsapp_messages" does not exist
   ```
   → **Acción**: Este error NO debería aparecer todavía (contact_id aún existe)

### 🟡 ADVERTENCIA - Investigar:

1. **Queries lentas** (>100ms para operaciones simples)
   → Verificar que índices se crearon correctamente

2. **Aumento en uso de memoria**
   → Normal si hay muchos índices, monitorear

---

## ✅ Checklist Antes de FASE 3

**Esperar 24-48 horas**, luego verificar:

- [ ] ✅ 0 errores de FK constraint en logs
- [ ] ✅ 100% de nuevos registros tienen `tenant_contact_id` válido
- [ ] ✅ 0 registros legacy con `tenant_contact_id` NULL
- [ ] ✅ Performance de queries normal (<10ms)
- [ ] ✅ Funcionalidad de WhatsApp funciona correctamente
- [ ] ✅ AI Agent puede consultar préstamos sin errores
- [ ] ✅ No hay quejas de usuarios

**Si todos los checks pasan → Seguro continuar con FASE 3**

---

## 🚀 Ejecutar FASE 3 (Cuando estés listo)

```bash
# En Supabase Dashboard → SQL Editor
# Abrir archivo: supabase/migrations/033_deprecate_contacts_phase3_schema_migration.sql
# Ejecutar completo

# O via MCP:
# (solicitar a Claude Code que aplique migración 033)
```

**⚠️ Recuerda: FASE 3 es punto de no retorno**

---

## 📋 Ejecutar FASE 4 (Semana después de FASE 3)

**Requisitos previos:**
- ✅ FASE 3 aplicada por >7 días sin errores
- ✅ No hay referencias a tabla `contacts` en código
- ✅ Logs NO muestran uso de columnas `contact_id`

```bash
# IRREVERSIBLE - Leer archivo completo antes de ejecutar
# Abrir: supabase/migrations/034_deprecate_contacts_phase4_cleanup.sql
# Validar que entiendes las consecuencias
# Descomentar línea de seguridad en el script
# Ejecutar

# ⚠️ NO HAY ROLLBACK DESPUÉS DE ESTO
```

---

## 🔄 Rollback (Si es necesario durante monitoreo)

### Rollback de FASE 2 (Código)
```bash
# Opción A: Revertir commit
git revert <commit-hash>

# Opción B: Rollback manual
# 1. Editar wa_webhook/index.ts
# 2. Cambiar: tenant_contact_id → contact_id
# 3. Restaurar creación de legacyContact
# 4. Redesplegar: npx supabase functions deploy wa_webhook
```

### Rollback de FASE 1 (Schema) - Solo si absolutamente necesario
```sql
-- Ver comentarios al final de 032_deprecate_contacts_phase1_data_migration.sql
DROP INDEX IF EXISTS idx_whatsapp_messages_tenant_contact_id;
-- ... (resto de indices)

ALTER TABLE whatsapp_messages DROP COLUMN IF EXISTS tenant_contact_id;
-- ... (resto de tablas)
```

---

## 📞 Soporte

**Si encuentras problemas:**
1. Documentar error exacto (screenshot de logs)
2. Ejecutar queries de diagnóstico arriba
3. Reportar en GitHub issue con tag `deprecation-legacy-contacts`
