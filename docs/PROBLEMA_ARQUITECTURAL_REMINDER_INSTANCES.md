# 🚨 Problema Arquitectural: Reminder Instances No Se Generan para Préstamos

**Fecha de descubrimiento**: 2025-10-13
**Severidad**: 🔴 **CRÍTICA**
**Impacto**: Sistema de recordatorios completamente inoperativo para préstamos

---

## 📋 Resumen Ejecutivo

El sistema de recordatorios de préstamos **NO está funcionando** porque las instancias ejecutables (`reminder_instances`) nunca se generan automáticamente cuando se crean los préstamos.

**Resultado**: Los recordatorios configurados existen en la base de datos pero nunca se envían por WhatsApp.

---

## 🔍 Problema Descubierto

### Síntomas
- Usuario creó préstamos con fecha de vencimiento "mañana" (13/10)
- Configuró recordatorios para enviarse a las 09:00
- **NINGÚN recordatorio se envió**
- 0 mensajes de WhatsApp generados por el cron job

### Análisis Realizado
```sql
-- 1. Verificar préstamos con vencimiento hoy
SELECT id, title, due_date, created_at
FROM agreements
WHERE due_date = '2025-10-13'
ORDER BY created_at DESC;
-- ✅ Resultado: 5 préstamos encontrados

-- 2. Verificar configuraciones de recordatorios
SELECT r.id, r.reminder_type, r.days_offset, r.time_of_day,
       COUNT(ri.id) as reminder_instances_count
FROM agreements a
LEFT JOIN reminders r ON r.agreement_id = a.id
LEFT JOIN reminder_instances ri ON ri.reminder_id = r.id
WHERE a.due_date = '2025-10-13'
GROUP BY r.id, a.id;
-- ✅ Resultado: 15 reminders (5 préstamos × 3 tipos: before_24h, due_date, overdue)
-- ❌ Problema: reminder_instances_count = 0 para TODOS

-- 3. Verificar mensajes enviados hoy
SELECT COUNT(*) FROM whatsapp_messages
WHERE DATE(sent_at) = '2025-10-13' AND direction = 'outbound';
-- ❌ Resultado: 0 mensajes
```

---

## 🧬 Causa Raíz

### Arquitectura Actual (Incorrecta)

```
┌─────────────────────────────────────────────────────┐
│  Usuario crea préstamo via WhatsApp Flow           │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│  flow-handlers.ts → handleNewLoanFlow()             │
│  1. Crea agreement (préstamo)                       │
│  2. Llama setupDefaultReminders()                   │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│  setupDefaultReminders()                            │
│  ✅ Inserta 3 registros en tabla "reminders"       │
│     - before_24h (09:00, -1 día)                    │
│     - due_date (09:00, 0 días)                      │
│     - overdue (16:00, +1 día)                       │
│                                                     │
│  ❌ NO LLAMA generate_reminder_instances()         │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
            ❌ FIN DEL FLUJO
     (reminder_instances NUNCA se crean)
```

### Flujo Esperado (Correcto)

```
┌─────────────────────────────────────────────────────┐
│  Usuario crea préstamo via WhatsApp Flow           │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│  flow-handlers.ts → handleNewLoanFlow()             │
│  1. Crea agreement (préstamo)                       │
│  2. Llama setupDefaultReminders()                   │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│  setupDefaultReminders()                            │
│  ✅ Inserta 3 registros en tabla "reminders"       │
│  ✅ LLAMA generate_reminder_instances() para cada   │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│  generate_reminder_instances(reminder_id, due_date) │
│  ✅ Calcula scheduled_for = due_date + offset       │
│  ✅ Solo crea si scheduled_for > NOW()             │
│  ✅ Inserta en tabla "reminder_instances"          │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│  Cron Job: process_pending_reminders()              │
│  (Se ejecuta cada hora)                             │
│  ✅ Lee reminder_instances con status='pending'     │
│  ✅ Envía mensajes vía WhatsApp                     │
│  ✅ Actualiza status='sent'                         │
└─────────────────────────────────────────────────────┘
```

---

## 📂 Código Problemático

### Archivo: `/supabase/functions/_shared/flow-handlers.ts`

```typescript
private async setupDefaultReminders(agreementId: string, dueDate: string, timezone: string): Promise<void> {
  const reminders = [
    { type: 'before_24h', offset: -1, time: '09:00:00' },
    { type: 'due_date', offset: 0, time: '09:00:00' },
    { type: 'overdue', offset: 1, time: '16:00:00' }
  ];

  for (const reminder of reminders) {
    await this.supabase
      .from('reminders')
      .insert({
        agreement_id: agreementId,
        reminder_type: reminder.type,
        days_offset: reminder.offset,
        time_of_day: reminder.time,
        timezone: timezone,
        is_active: true
      });

    // ❌ FALTA LLAMAR A generate_reminder_instances()
    // ❌ Debería llamar:
    // await this.supabase.rpc('generate_reminder_instances', {
    //   p_reminder_id: insertedReminder.id,
    //   p_due_date: dueDate,
    //   p_timezone: timezone
    // });
  }
}
```

---

## 🧪 Evidencia Técnica

### Generación Manual de Instancias (Prueba Realizada)

```sql
DO $
DECLARE
    reminder_record RECORD;
    instances_count INTEGER := 0;
BEGIN
    FOR reminder_record IN
        SELECT r.id as reminder_id, a.due_date
        FROM reminders r
        JOIN agreements a ON a.id = r.agreement_id
        WHERE a.due_date = '2025-10-13' AND r.is_active = true
    LOOP
        SELECT generate_reminder_instances(
            reminder_record.reminder_id,
            reminder_record.due_date::DATE,
            'America/Santiago'
        ) INTO instances_count;
    END LOOP;
END $;
```

**Resultado de generación manual**:
- ✅ Se crearon 5 instancias de tipo "overdue" (para mañana 14/10 a las 19:00 UTC = 16:00 Chile)
- ❌ NO se crearon instancias para "before_24h" y "due_date" porque:
  - `scheduled_for` calculado = 12/10 12:00 y 13/10 12:00 (ya pasaron)
  - La función `generate_reminder_instances()` tiene validación: `IF scheduled_datetime > NOW()`
  - **Conclusión**: Las instancias debieron generarse AYER cuando se creó el préstamo, no hoy

---

## 📊 Impacto

### Funcionalidad Afectada
- ❌ Recordatorios 24h antes del vencimiento: **NO funcionan**
- ❌ Recordatorios el día del vencimiento: **NO funcionan**
- ❌ Recordatorios post-vencimiento: **NO funcionan**

### Datos del Sistema
```
Total préstamos en sistema: ~50+
Total reminders configurados: ~150+ (50 × 3 tipos)
Total reminder_instances generadas: 0 (antes de fix manual)

Tasa de éxito del sistema: 0%
```

### Usuario Final
- **NO recibe notificaciones** de préstamos próximos a vencer
- **NO recibe recordatorios** de pagos pendientes
- **Pérdida total** de funcionalidad de gestión proactiva

---

## 🎯 Solución Propuesta

### Fix Inmediato

Modificar `setupDefaultReminders()` en `/supabase/functions/_shared/flow-handlers.ts`:

```typescript
private async setupDefaultReminders(agreementId: string, dueDate: string, timezone: string): Promise<void> {
  const reminders = [
    { type: 'before_24h', offset: -1, time: '09:00:00' },
    { type: 'due_date', offset: 0, time: '09:00:00' },
    { type: 'overdue', offset: 1, time: '16:00:00' }
  ];

  for (const reminder of reminders) {
    // 1. Insertar reminder y obtener el ID
    const { data: insertedReminder, error: insertError } = await this.supabase
      .from('reminders')
      .insert({
        agreement_id: agreementId,
        reminder_type: reminder.type,
        days_offset: reminder.offset,
        time_of_day: reminder.time,
        timezone: timezone,
        is_active: true
      })
      .select('id')
      .single();

    if (insertError || !insertedReminder) {
      console.error('Error creating reminder:', insertError);
      continue;
    }

    // ✅ 2. Generar reminder_instance inmediatamente
    const { data: instanceResult, error: instanceError } = await this.supabase
      .rpc('generate_reminder_instances', {
        p_reminder_id: insertedReminder.id,
        p_due_date: dueDate,
        p_timezone: timezone
      });

    if (instanceError) {
      console.error('Error generating reminder instance:', instanceError);
    } else {
      console.log(`Created ${instanceResult} instance(s) for reminder ${reminder.type}`);
    }
  }
}
```

### Fix Retroactivo (Datos Existentes)

**Opción A**: Generar instancias para todos los préstamos activos con `due_date` futura

```sql
DO $
DECLARE
    reminder_record RECORD;
    instances_count INTEGER := 0;
    total_instances INTEGER := 0;
BEGIN
    FOR reminder_record IN
        SELECT r.id as reminder_id, a.due_date, a.timezone
        FROM reminders r
        JOIN agreements a ON a.id = r.agreement_id
        WHERE a.status IN ('active', 'pending')  -- Solo préstamos activos
          AND a.type = 'loan'                     -- Solo préstamos (no servicios)
          AND a.due_date >= CURRENT_DATE          -- Solo futuras
          AND r.is_active = true
          AND NOT EXISTS (                        -- Que NO tengan instancias ya
            SELECT 1 FROM reminder_instances ri
            WHERE ri.reminder_id = r.id
          )
    LOOP
        SELECT generate_reminder_instances(
            reminder_record.reminder_id,
            reminder_record.due_date::DATE,
            COALESCE(reminder_record.timezone, 'America/Santiago')
        ) INTO instances_count;

        total_instances := total_instances + instances_count;
    END LOOP;

    RAISE NOTICE 'Total instances created: %', total_instances;
END $;
```

**Opción B**: Dejar préstamos pasados sin instancias (solo generar para nuevos préstamos en adelante)

---

## 📅 Estado Actual del Cron Job

### `/supabase/migrations/004_setup_cron_jobs.sql`

```sql
CREATE OR REPLACE FUNCTION generate_recurring_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $
DECLARE
    agreement_record RECORD;
    instances_created integer := 0;
BEGIN
    FOR agreement_record IN
        SELECT *
        FROM agreements
        WHERE type = 'service'  -- ❌ SOLO SERVICIOS, NO PRÉSTAMOS
        AND status = 'active'
        AND next_due_date IS NOT NULL
        AND next_due_date <= CURRENT_DATE + INTERVAL '7 days'
    LOOP
        -- Genera instances para servicios recurrentes...
    END LOOP;

    RETURN instances_created;
END;
$;
```

**Problema Adicional**: El cron `generate_recurring_reminders()` **solo procesa servicios**, no préstamos.

**¿Esto es intencional?**
- ✅ **Sí para servicios recurrentes**: Tienen `next_due_date` y se regeneran automáticamente
- ❌ **No para préstamos one-time**: Deben generar instancias en el momento de creación

---

## ✅ Checklist de Implementación

- [ ] Modificar `setupDefaultReminders()` para llamar `generate_reminder_instances()`
- [ ] Probar con préstamo nuevo (crear y verificar que se generen 3 instancias)
- [ ] Decidir estrategia retroactiva (A o B)
- [ ] Ejecutar script retroactivo si aplica
- [ ] Verificar cron `process_pending_reminders()` está activo
- [ ] Probar envío real de recordatorio (esperar a que llegue hora programada)
- [ ] Actualizar documentación del sistema de recordatorios
- [ ] Commit y deploy a producción

---

## 📚 Referencias

- **Función DB**: `generate_reminder_instances()` en `/supabase/migrations/003_seed_data.sql`
- **Cron Job**: `process_pending_reminders()` en `/supabase/migrations/004_setup_cron_jobs.sql`
- **Handler**: `setupDefaultReminders()` en `/supabase/functions/_shared/flow-handlers.ts`

---

## 📝 Notas Adicionales

### Timezone Handling

⚠️ **PROBLEMA CRÍTICO ADICIONAL**: Manejo incorrecto de timezones

#### Estado Actual

**Tenant configurado**:
```sql
SELECT timezone FROM tenants WHERE name = 'PrestaBot Chile';
-- Resultado: 'America/Santiago' (Chile, UTC-3)
```

**Función `generate_reminder_instances()`**:
```sql
CREATE OR REPLACE FUNCTION generate_reminder_instances(
    p_reminder_id UUID,
    p_due_date DATE,
    p_timezone TEXT DEFAULT 'America/Mexico_City'  -- ❌ DEFAULT INCORRECTO
)
```

**Problema**:
- Default timezone es `'America/Mexico_City'` (México, UTC-6)
- Tenant chileno usa `'America/Santiago'` (Chile, UTC-3)
- **Diferencia**: 3 horas de error

#### Llamadas a `generate_reminder_instances()`

**1. `setupDefaultReminders()` (línea 560)**:
- ❌ NO llama a la función (problema principal)

**2. `regenerateReminders()` (línea 622)**:
```typescript
await this.supabase.rpc('generate_reminder_instances', {
  reminder_id: reminder.id,
  due_date: newDueDate
  // ❌ FALTA: No pasa p_timezone
  // Usará default 'America/Mexico_City' en vez de 'America/Santiago'
});
```

**3. `generate_recurring_reminders()` cron (línea 168)**:
```sql
instances_created := instances_created + generate_reminder_instances(
    reminder_record.id,
    agreement_record.next_due_date::text,
    (SELECT timezone FROM tenants WHERE id = agreement_record.tenant_id)  -- ✅ CORRECTO
);
```

#### Impacto del Error de Timezone

**Ejemplo**: Recordatorio programado para 09:00 hora Chile

**Con timezone correcto** (`America/Santiago`, UTC-3):
```sql
'2025-10-13 09:00:00' AT TIME ZONE 'America/Santiago'
= '2025-10-13 09:00:00-03'  (09:00 Chile)
= '2025-10-13 12:00:00+00'  (almacenado como 12:00 UTC)

-- Cron ejecuta a las 12:00 UTC = 09:00 Chile ✅
```

**Con timezone incorrecto** (`America/Mexico_City`, UTC-6):
```sql
'2025-10-13 09:00:00' AT TIME ZONE 'America/Mexico_City'
= '2025-10-13 09:00:00-06'  (09:00 México)
= '2025-10-13 15:00:00+00'  (almacenado como 15:00 UTC)

-- Cron ejecuta a las 15:00 UTC = 12:00 Chile ❌ (3 horas tarde)
```

#### Solución: Pasar Timezone del Tenant

**Modificar `regenerateReminders()`**:
```typescript
private async regenerateReminders(
  agreementId: string,
  newDueDate: string,
  tenantId: string  // ✅ AGREGAR parámetro
): Promise<void> {
  // Obtener timezone del tenant
  const { data: tenant } = await this.supabase
    .from('tenants')
    .select('timezone')
    .eq('id', tenantId)
    .single();

  const timezone = tenant?.timezone || 'America/Santiago';

  // Generar instancias con timezone correcto
  for (const reminder of reminders) {
    await this.supabase.rpc('generate_reminder_instances', {
      p_reminder_id: reminder.id,
      p_due_date: newDueDate,
      p_timezone: timezone  // ✅ PASAR TIMEZONE
    });
  }
}
```

**Modificar `setupDefaultReminders()`** (cuando se implemente):
```typescript
private async setupDefaultReminders(
  agreementId: string,
  tenantId: string,
  dueDate: string  // ✅ AGREGAR parámetro
): Promise<void> {
  // Obtener timezone del tenant
  const { data: tenant } = await this.supabase
    .from('tenants')
    .select('timezone')
    .eq('id', tenantId)
    .single();

  const timezone = tenant?.timezone || 'America/Santiago';

  // Crear reminders y generar instancias
  for (const reminder of reminders) {
    // Insertar reminder y obtener ID
    const { data: insertedReminder } = await this.supabase
      .from('reminders')
      .insert({ ... })
      .select('id')
      .single();

    // Generar instance con timezone correcto
    await this.supabase.rpc('generate_reminder_instances', {
      p_reminder_id: insertedReminder.id,
      p_due_date: dueDate,
      p_timezone: timezone  // ✅ PASAR TIMEZONE
    });
  }
}
```

#### Documentación Completa

Ver documentación detallada de timezone en:
**`/docs/TIMEZONE_MANEJO_RECORDATORIOS.md`**

Incluye:
- Tipos de datos (DATE vs TIMESTAMPTZ)
- Cálculo de scheduled_datetime con timezone
- Comparación con NOW() en cron job
- Casos de prueba con ejemplos reales
- Checklist de implementación

### Validación de Instancias Futuras

La función solo crea instancias futuras:
```sql
IF scheduled_datetime > NOW() THEN
    INSERT INTO reminder_instances ...
END IF;
```

**Implicación**: Si un préstamo se crea con `due_date = tomorrow` y el reminder es `before_24h` (09:00, -1 día), la instancia solo se creará si es antes de las 09:00 de hoy.

---

**Fin del documento**
