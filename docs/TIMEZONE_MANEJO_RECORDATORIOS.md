# 📍 Manejo de Timezones en Sistema de Recordatorios

**Fecha**: 2025-10-13
**Importancia**: 🔴 **CRÍTICA**

---

## 📋 Resumen Ejecutivo

Este documento explica cómo el sistema maneja timezones para que los recordatorios se envíen a la hora correcta según el timezone del usuario (Chile, UTC-3), no del servidor (UTC).

**Principio clave**: La base de datos almacena fechas en formato DATE (sin timezone) y timestamps en TIMESTAMPTZ (con timezone convertido a UTC). Los recordatorios se programan usando el timezone del tenant.

---

## 🗄️ Estructura de Datos

### Tipos de Columnas en `agreements`

```sql
-- Verificado con query a information_schema.columns
start_date       → DATE                          (sin timezone)
due_date         → DATE                          (sin timezone)
next_due_date    → DATE                          (sin timezone)
created_at       → TIMESTAMP WITH TIME ZONE      (con timezone, almacenado en UTC)
updated_at       → TIMESTAMP WITH TIME ZONE      (con timezone, almacenado en UTC)
completed_at     → TIMESTAMP WITH TIME ZONE      (con timezone, almacenado en UTC)
```

### Tipos de Columnas en `reminder_instances`

```sql
scheduled_for    → TIMESTAMP WITH TIME ZONE      (con timezone, almacenado en UTC)
sent_at          → TIMESTAMP WITH TIME ZONE      (con timezone, almacenado en UTC)
created_at       → TIMESTAMP WITH TIME ZONE      (con timezone, almacenado en UTC)
updated_at       → TIMESTAMP WITH TIME ZONE      (con timezone, almacenado en UTC)
```

### Configuración del Tenant

```sql
SELECT id, name, timezone FROM tenants;
-- Resultado:
-- id: d4c43ab8-426f-4bb9-8736-dfe301459590
-- name: PrestaBot Chile
-- timezone: America/Santiago  (UTC-3)
```

---

## 🔄 Flujo de Creación de Recordatorios

### 1. Usuario Crea Préstamo

**Entrada del usuario** (via WhatsApp):
```
"Mañana" (13/10/2025)
```

**Sistema calcula `due_date`**:
```typescript
// En conversation-manager.ts (parseDate)
const localTime = new Date(); // Asume servidor en UTC, pero calcula hora Chile
// Timezone offset: -3 horas (Chile está UTC-3)
const tomorrow = new Date(localTime);
tomorrow.setDate(tomorrow.getDate() + 1);

// Guardado (ya corregido con formatDateLocal):
due_date = '2025-10-13'  // tipo DATE, sin timezone
```

### 2. Sistema Crea `reminders` (configuraciones)

**En `setupDefaultReminders()`**:
```typescript
const reminders = [
  {
    reminder_type: 'before_24h',
    days_offset: -1,
    time_of_day: '10:00',  // tipo TIME
  },
  {
    reminder_type: 'due_date',
    days_offset: 0,
    time_of_day: '09:00',  // tipo TIME
  },
  {
    reminder_type: 'overdue',
    days_offset: 1,
    time_of_day: '16:00',  // tipo TIME
  }
];
```

**Problema actual**: ❌ NO llama a `generate_reminder_instances()`

### 3. Sistema DEBE Crear `reminder_instances` (tareas ejecutables)

**Función: `generate_reminder_instances()`**

```sql
CREATE OR REPLACE FUNCTION generate_reminder_instances(
    p_reminder_id UUID,
    p_due_date DATE,
    p_timezone TEXT DEFAULT 'America/Mexico_City'  -- ⚠️ DEFAULT INCORRECTO
)
RETURNS INTEGER
AS $$
DECLARE
    reminder_record RECORD;
    scheduled_datetime TIMESTAMPTZ;
BEGIN
    -- Obtener reminder configurado
    SELECT * INTO reminder_record
    FROM reminders
    WHERE id = p_reminder_id AND is_active = true;

    -- Calcular scheduled_datetime en timezone del usuario
    scheduled_datetime := (
        p_due_date +
        reminder_record.days_offset * INTERVAL '1 day' +
        reminder_record.time_of_day
    ) AT TIME ZONE p_timezone;

    -- Insertar instancia si está en el futuro
    IF scheduled_datetime > NOW() THEN
        INSERT INTO reminder_instances (reminder_id, scheduled_for, status)
        VALUES (p_reminder_id, scheduled_datetime, 'pending');

        RETURN 1;
    END IF;

    RETURN 0;
END;
$$;
```

#### Ejemplo de Cálculo con Timezone Correcto

**Entrada**:
- `p_due_date = '2025-10-13'` (DATE)
- `days_offset = 0` (día del vencimiento)
- `time_of_day = '09:00:00'` (TIME)
- `p_timezone = 'America/Santiago'` ✅ (Chile UTC-3)

**Proceso**:
```sql
-- Paso 1: Sumar componentes
'2025-10-13' + 0 days + '09:00:00' = '2025-10-13 09:00:00' (sin timezone aún)

-- Paso 2: Aplicar timezone
'2025-10-13 09:00:00' AT TIME ZONE 'America/Santiago'

-- Resultado: TIMESTAMPTZ en formato local
'2025-10-13 09:00:00-03'  (09:00 Chile, UTC-3)
```

**Almacenamiento en PostgreSQL**:
PostgreSQL convierte automáticamente a UTC para almacenamiento interno:
```
'2025-10-13 09:00:00-03' se almacena como '2025-10-13 12:00:00+00' (UTC)
```

#### Ejemplo de Cálculo con Timezone Incorrecto

**Entrada** (si NO se pasa p_timezone):
- `p_due_date = '2025-10-13'` (DATE)
- `days_offset = 0`
- `time_of_day = '09:00:00'`
- `p_timezone = 'America/Mexico_City'` ❌ (México UTC-6, default incorrecto)

**Proceso**:
```sql
'2025-10-13 09:00:00' AT TIME ZONE 'America/Mexico_City'
= '2025-10-13 09:00:00-06'  (09:00 México, UTC-6)
```

**Almacenamiento**:
```
'2025-10-13 09:00:00-06' se almacena como '2025-10-13 15:00:00+00' (UTC)
```

**Diferencia**: 3 horas de error (15:00 UTC en vez de 12:00 UTC)

---

## ⏰ Ejecución del Cron Job

### Cron Job: `process_pending_reminders()`

```sql
-- Ejecutado cada hora (o minuto según configuración)
SELECT *
FROM reminder_instances
WHERE status = 'pending'
  AND scheduled_for <= NOW();  -- NOW() retorna hora UTC del servidor
```

**Cómo funciona la comparación**:
- `NOW()` retorna: `'2025-10-13 12:00:00+00'` (UTC)
- `scheduled_for` almacenado: `'2025-10-13 12:00:00+00'` (UTC)
- Comparación: `12:00 <= 12:00` → **TRUE** ✅

**Resultado**: El recordatorio se envía a las 09:00 hora Chile (12:00 UTC) ✅

---

## 🚨 Problemas Identificados

### Problema 1: `setupDefaultReminders()` NO Genera Instancias

**Ubicación**: `/supabase/functions/_shared/flow-handlers.ts:560`

```typescript
private async setupDefaultReminders(agreementId: string, tenantId: string): Promise<void> {
  // Crea reminders (configuraciones)
  await this.supabase
    .from('reminders')
    .insert(reminders);

  // ❌ FALTA: NO llama a generate_reminder_instances()
}
```

**Impacto**: **CRÍTICO**
- Reminders se crean pero reminder_instances NO
- Cron job no encuentra instancias pendientes
- 0 recordatorios enviados

### Problema 2: `regenerateReminders()` NO Pasa Timezone

**Ubicación**: `/supabase/functions/_shared/flow-handlers.ts:622`

```typescript
private async regenerateReminders(agreementId: string, newDueDate: string): Promise<void> {
  for (const reminder of reminders) {
    await this.supabase.rpc('generate_reminder_instances', {
      reminder_id: reminder.id,
      due_date: newDueDate
      // ❌ FALTA: timezone parámetro
    });
  }
}
```

**Impacto**: **ALTO**
- Usará default `'America/Mexico_City'` (México UTC-6)
- Tenant chileno (UTC-3) tendrá 3 horas de error
- Recordatorio programado para 15:00 UTC en vez de 12:00 UTC
- Usuario recibirá recordatorio a las 12:00 Chile en vez de 09:00 Chile

### Problema 3: Default Timezone Incorrecto

**Ubicación**: `/supabase/migrations/003_seed_data.sql:286`

```sql
CREATE OR REPLACE FUNCTION generate_reminder_instances(
    p_reminder_id UUID,
    p_due_date DATE,
    p_timezone TEXT DEFAULT 'America/Mexico_City'  -- ❌ DEFAULT MÉXICO
)
```

**Impacto**: **MEDIO-ALTO**
- Si se olvida pasar timezone, asume México
- Causa errores silenciosos difíciles de detectar
- Mejor práctica: hacer parámetro obligatorio o usar timezone del reminder

---

## ✅ Soluciones Propuestas

### Fix 1: Modificar `setupDefaultReminders()` para Generar Instancias

```typescript
private async setupDefaultReminders(
  agreementId: string,
  tenantId: string,
  dueDate: string  // ✅ AGREGAR parámetro
): Promise<void> {
  // 1. Obtener timezone del tenant
  const { data: tenant } = await this.supabase
    .from('tenants')
    .select('timezone')
    .eq('id', tenantId)
    .single();

  const timezone = tenant?.timezone || 'America/Santiago';  // Fallback Chile

  // 2. Crear reminders
  const reminders = [
    { reminder_type: 'before_24h', days_offset: -1, time_of_day: '10:00', ... },
    { reminder_type: 'due_date', days_offset: 0, time_of_day: '09:00', ... },
    { reminder_type: 'overdue', days_offset: 1, time_of_day: '16:00', ... }
  ];

  for (const reminder of reminders) {
    // 3. Insertar reminder y obtener ID
    const { data: insertedReminder, error } = await this.supabase
      .from('reminders')
      .insert({
        agreement_id: agreementId,
        reminder_type: reminder.reminder_type,
        days_offset: reminder.days_offset,
        time_of_day: reminder.time_of_day,
        ...
      })
      .select('id')
      .single();

    if (error || !insertedReminder) {
      console.error('Error creating reminder:', error);
      continue;
    }

    // ✅ 4. Generar reminder_instance con timezone correcto
    const { data: instanceResult, error: instanceError } = await this.supabase
      .rpc('generate_reminder_instances', {
        p_reminder_id: insertedReminder.id,
        p_due_date: dueDate,
        p_timezone: timezone  // ✅ Pasar timezone del tenant
      });

    if (instanceError) {
      console.error('Error generating reminder instance:', instanceError);
    } else {
      console.log(`Created ${instanceResult} instance(s) for ${reminder.reminder_type}`);
    }
  }
}
```

### Fix 2: Modificar `regenerateReminders()` para Pasar Timezone

```typescript
private async regenerateReminders(
  agreementId: string,
  newDueDate: string,
  tenantId: string  // ✅ AGREGAR parámetro
): Promise<void> {
  // 1. Obtener timezone del tenant
  const { data: tenant } = await this.supabase
    .from('tenants')
    .select('timezone')
    .eq('id', tenantId)
    .single();

  const timezone = tenant?.timezone || 'America/Santiago';

  // 2. Obtener recordatorios activos
  const { data: reminders } = await this.supabase
    .from('reminders')
    .select('*')
    .eq('agreement_id', agreementId)
    .eq('is_active', true);

  if (!reminders) return;

  // 3. Generar nuevas instancias con timezone correcto
  for (const reminder of reminders) {
    await this.supabase.rpc('generate_reminder_instances', {
      p_reminder_id: reminder.id,
      p_due_date: newDueDate,
      p_timezone: timezone  // ✅ Pasar timezone del tenant
    });
  }
}
```

### Fix 3: Actualizar Llamadas a `setupDefaultReminders()` y `regenerateReminders()`

```typescript
// En handleNewLoanFlow() - línea 242
await this.setupDefaultReminders(
  agreementId,
  tenantId,
  dueDate  // ✅ Pasar due_date
);

// En handleRescheduleFlow() - línea 348
await this.regenerateReminders(
  agreement.id,
  newDate,
  tenantId  // ✅ Pasar tenant_id
);
```

### Fix 4: Cambiar Default de `generate_reminder_instances()` (Opcional)

**Opción A**: Hacer timezone obligatorio (más seguro)
```sql
CREATE OR REPLACE FUNCTION generate_reminder_instances(
    p_reminder_id UUID,
    p_due_date DATE,
    p_timezone TEXT  -- ✅ Sin DEFAULT, obligatorio
)
```

**Opción B**: Cambiar default a Chile (más pragmático)
```sql
CREATE OR REPLACE FUNCTION generate_reminder_instances(
    p_reminder_id UUID,
    p_due_date DATE,
    p_timezone TEXT DEFAULT 'America/Santiago'  -- ✅ Chile por defecto
)
```

**Opción C**: Obtener timezone del reminder (más robusto)
```sql
CREATE OR REPLACE FUNCTION generate_reminder_instances(
    p_reminder_id UUID,
    p_due_date DATE,
    p_timezone TEXT DEFAULT NULL  -- NULL = auto-detectar
)
AS $$
DECLARE
    reminder_record RECORD;
    tenant_timezone TEXT;
    scheduled_datetime TIMESTAMPTZ;
BEGIN
    -- Obtener reminder y timezone del tenant
    SELECT r.*, t.timezone INTO reminder_record, tenant_timezone
    FROM reminders r
    JOIN agreements a ON a.id = r.agreement_id
    JOIN tenants t ON t.id = a.tenant_id
    WHERE r.id = p_reminder_id AND r.is_active = true;

    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    -- Usar timezone pasado por parámetro o timezone del tenant
    IF p_timezone IS NULL THEN
        p_timezone := tenant_timezone;
    END IF;

    -- Calcular scheduled_datetime
    scheduled_datetime := (
        p_due_date +
        reminder_record.days_offset * INTERVAL '1 day' +
        reminder_record.time_of_day
    ) AT TIME ZONE p_timezone;

    -- Solo crear si está en el futuro
    IF scheduled_datetime > NOW() THEN
        INSERT INTO reminder_instances (reminder_id, scheduled_for, status)
        VALUES (p_reminder_id, scheduled_datetime, 'pending');

        RETURN 1;
    END IF;

    RETURN 0;
END;
$$;
```

---

## 🧪 Caso de Prueba: Verificación de Timezone

### Escenario de Prueba

**Contexto**:
- Tenant: PrestaBot Chile (`timezone = 'America/Santiago'`, UTC-3)
- Fecha actual: 13/10/2025 02:00 AM (Chile) = 05:00 UTC
- Usuario crea préstamo con `due_date = '2025-10-13'` (hoy)

**Recordatorio "due_date"**:
- `days_offset = 0`
- `time_of_day = '09:00:00'`

**Cálculo esperado**:
```sql
scheduled_for = ('2025-10-13' + 0 days + '09:00:00') AT TIME ZONE 'America/Santiago'
              = '2025-10-13 09:00:00-03'  (09:00 Chile)
              = '2025-10-13 12:00:00+00'  (almacenado como 12:00 UTC)
```

**Verificación en cron (a las 12:00 UTC = 09:00 Chile)**:
```sql
SELECT * FROM reminder_instances
WHERE scheduled_for <= NOW()  -- NOW() = '2025-10-13 12:00:00+00'
  AND status = 'pending';

-- Resultado: reminder_instance encontrado ✅
```

**Usuario recibe mensaje**: 09:00 hora Chile ✅

---

## 📊 Checklist de Implementación

- [ ] Modificar `setupDefaultReminders()` para:
  - [ ] Recibir parámetro `dueDate`
  - [ ] Obtener `timezone` del tenant
  - [ ] Llamar `generate_reminder_instances()` con timezone correcto
  - [ ] Agregar logs para debugging

- [ ] Modificar `regenerateReminders()` para:
  - [ ] Recibir parámetro `tenantId`
  - [ ] Obtener `timezone` del tenant
  - [ ] Pasar timezone a `generate_reminder_instances()`

- [ ] Actualizar llamadas en `handleNewLoanFlow()` y `handleRescheduleFlow()`

- [ ] (Opcional) Mejorar función `generate_reminder_instances()`:
  - [ ] Auto-detectar timezone desde reminder → agreement → tenant
  - [ ] Cambiar default o hacer obligatorio

- [ ] Testing:
  - [ ] Crear préstamo nuevo y verificar instancias generadas
  - [ ] Verificar `scheduled_for` está en UTC correcto
  - [ ] Reprogramar préstamo y verificar nuevas instancias
  - [ ] Simular ejecución de cron en hora programada
  - [ ] Verificar mensaje WhatsApp enviado a hora correcta

- [ ] Deploy a producción
- [ ] Monitorear logs de timezone en primeras 24 horas

---

## 📚 Referencias

- PostgreSQL timezone docs: https://www.postgresql.org/docs/current/datatype-datetime.html
- Lista de timezones IANA: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
- Chile timezone: `America/Santiago` (UTC-3 en invierno, UTC-4 en verano con DST)
- Función DB: `generate_reminder_instances()` en `/supabase/migrations/003_seed_data.sql:283`
- Handler: `setupDefaultReminders()` en `/supabase/functions/_shared/flow-handlers.ts:560`

---

**Fin del documento**
