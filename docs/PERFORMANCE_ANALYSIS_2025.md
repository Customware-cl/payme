# 📊 Análisis de Rendimiento UX - PayMe 2025

**Fecha:** 20 de Octubre, 2025
**Realizado por:** Claude Code Agent
**Versión:** 1.0

---

## 🎯 Resumen Ejecutivo

Este análisis exhaustivo del rendimiento UX de PayMe revela **múltiples oportunidades críticas de optimización** que pueden mejorar significativamente la experiencia del usuario.

### Ganancias Estimadas de Rendimiento

| Área | Mejora Estimada | Impacto |
|------|----------------|---------|
| **Tiempo de respuesta backend** | 3-5x más rápido | 🔴 Crítico |
| **Queries a base de datos** | 70-80% reducción | 🔴 Crítico |
| **Bundle size frontend** | 40-60% más pequeño | 🟡 Alto |
| **Time to Interactive** | 50% más rápido | 🟡 Alto |

---

## 🔴 Cuellos de Botella Críticos

### 1. WhatsApp Window Manager - N+1 Query Pattern ⚠️ CRÍTICO

**Ubicación:** `supabase/functions/_shared/whatsapp-window-manager.ts:521-562`

**Problema:**
```typescript
// ❌ PROBLEMA: 1000 contactos = 1000 queries a la BD
for (const contact of contacts) {
  const windowStatus = await this.getWindowStatus(tenantId, contact.id);
  // Cada llamada a getWindowStatus hace una query individual
}
```

**Impacto:**
- Para 1000 contactos: 1000 queries individuales
- Tiempo estimado: 500-1000ms adicionales por operación
- Afecta a: `scheduler_dispatch`, `message_processor`, webhooks

**Solución:**
```typescript
// ✅ SOLUCIÓN: Batch query - 1000 contactos = 1 query
const lastMessages = await this.supabase
  .from('whatsapp_messages')
  .select('tenant_contact_id, created_at')
  .eq('tenant_id', tenantId)
  .in('tenant_contact_id', contactIds)
  .eq('direction', 'inbound')
  .order('created_at', { ascending: false });

// Procesar resultados en memoria
const windowStatusMap = new Map();
for (const msg of lastMessages) {
  if (!windowStatusMap.has(msg.tenant_contact_id)) {
    windowStatusMap.set(msg.tenant_contact_id, msg.created_at);
  }
}
```

**Ganancia esperada:** 99% reducción en queries, 80% más rápido

---

### 2. Scheduler Dispatch - N+1 en Loop de Recordatorios ⚠️ CRÍTICO

**Ubicación:** `supabase/functions/scheduler_dispatch/index.ts:228-276`

**Problema:**
```typescript
// ❌ PROBLEMA: 100 acuerdos × 5 recordatorios = 500+ queries
for (const agreement of agreements) {
  for (const reminder of agreement.reminders) {
    // Query 1: Verificar si existe
    const { data: existingInstance } = await supabase
      .from('reminder_instances')
      .select('id')
      .eq('reminder_id', reminder.id)
      .eq('due_date', targetDate)
      .maybeSingle();

    if (!existingInstance) {
      // Query 2: Insertar nuevo
      await supabase
        .from('reminder_instances')
        .insert({ reminder_id: reminder.id, due_date: targetDate });
    }
  }
}
```

**Impacto:**
- 500+ queries por ejecución del scheduler
- Tiempo estimado: 2-5 segundos por ejecución
- Bloquea el procesamiento de recordatorios

**Solución:**
```typescript
// ✅ SOLUCIÓN: Batch insert con ON CONFLICT
const allReminderInstances = agreements.flatMap(agreement =>
  agreement.reminders.map(reminder => ({
    reminder_id: reminder.id,
    agreement_id: agreement.id,
    due_date: targetDate,
    status: 'pending'
  }))
);

// Una sola query con manejo automático de duplicados
await supabase
  .from('reminder_instances')
  .insert(allReminderInstances)
  .onConflict('reminder_id,due_date')
  .ignore();
```

**Requisito previo:**
```sql
-- Agregar constraint único en la tabla
ALTER TABLE reminder_instances
  ADD CONSTRAINT unique_reminder_due_date
  UNIQUE (reminder_id, due_date);
```

**Ganancia esperada:** De 500 queries a 1 query, 95% más rápido

---

### 3. WA Webhook - Tenant Routing Secuencial ⚠️ CRÍTICO

**Ubicación:** `supabase/functions/wa_webhook/index.ts:164-195`

**Problema:**
```typescript
// ❌ PROBLEMA: 3-4 queries secuenciales para encontrar el tenant
// Query 1: Buscar contact profile
const { data: senderProfile } = await supabase
  .from('contact_profiles')
  .select('id')
  .eq('phone_e164', formattedPhone)
  .maybeSingle();

// Query 2: Buscar tenant por profile
if (senderProfile) {
  const { data: userTenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('owner_contact_profile_id', senderProfile.id)
    .maybeSingle();
}

// Query 3: Fallback por phone_number_id
if (!tenant) {
  const { data: legacyTenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('whatsapp_phone_number_id', phoneNumberId)
    .maybeSingle();
}
```

**Impacto:**
- 3-4 queries por webhook recibido
- 150-300ms de latencia adicional
- Afecta la velocidad de respuesta a WhatsApp

**Solución:**
```sql
-- ✅ SOLUCIÓN: RPC Function optimizada
CREATE OR REPLACE FUNCTION find_tenant_by_webhook(
  p_phone TEXT,
  p_phone_number_id TEXT
) RETURNS TABLE(
  tenant_id UUID,
  tenant_name TEXT,
  whatsapp_access_token TEXT,
  whatsapp_phone_number_id TEXT
) AS $$
BEGIN
  -- Intento 1: Por contact profile
  RETURN QUERY
  SELECT t.id, t.name, t.whatsapp_access_token, t.whatsapp_phone_number_id
  FROM tenants t
  INNER JOIN contact_profiles cp ON t.owner_contact_profile_id = cp.id
  WHERE cp.phone_e164 = p_phone
  LIMIT 1;

  -- Intento 2: Por phone_number_id (fallback)
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT t.id, t.name, t.whatsapp_access_token, t.whatsapp_phone_number_id
    FROM tenants t
    WHERE t.whatsapp_phone_number_id = p_phone_number_id
    LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;
```

```typescript
// Uso simplificado en el webhook
const { data: tenant } = await supabase
  .rpc('find_tenant_by_webhook', {
    p_phone: formattedPhone,
    p_phone_number_id: phoneNumberId
  })
  .single();
```

**Ganancia esperada:** De 3-4 queries a 1 query, 60% más rápido

---

### 4. Telegram State Management - JSONB Ineficiente ⚠️ ALTO

**Ubicación:** `supabase/functions/tg_webhook_simple/index.ts:41-96`

**Problema:**
```typescript
// ❌ PROBLEMA: Lee/escribe registro completo solo para metadata
// Query 1: Leer todo el metadata
const { data: tenantContact } = await supabase
  .from('tenant_contacts')
  .select('metadata')
  .eq('id', tenantContactId)
  .single();

// Query 2: Actualizar todo el metadata (merge en memoria)
const newMetadata = {
  ...tenantContact?.metadata || {},
  conversation_state: { ...state, expires_at: expiresAt }
};

await supabase
  .from('tenant_contacts')
  .update({ metadata: newMetadata })
  .eq('id', tenantContactId);
```

**Impacto:**
- 2 queries por cambio de estado
- Imposible indexar conversation state efectivamente
- Dificulta limpieza de estados expirados

**Solución:**
```sql
-- ✅ SOLUCIÓN: Tabla dedicada con índices
CREATE TABLE conversation_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES tenant_contacts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('whatsapp', 'telegram')),
  state JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_active_conversation UNIQUE (contact_id, platform)
);

-- Índices para queries comunes
CREATE INDEX idx_conversation_states_active
  ON conversation_states(tenant_id, contact_id, expires_at)
  WHERE expires_at > NOW();

-- Auto-limpieza de estados expirados
CREATE INDEX idx_conversation_states_expired
  ON conversation_states(expires_at)
  WHERE expires_at <= NOW();
```

```typescript
// Uso simplificado
async saveConversationState(contactId: string, state: any) {
  await supabase.from('conversation_states').upsert({
    contact_id: contactId,
    tenant_id: state.tenantId,
    platform: 'telegram',
    state: state,
    expires_at: new Date(Date.now() + 30 * 60 * 1000)
  }, { onConflict: 'contact_id,platform' });
}

async getConversationState(contactId: string) {
  const { data } = await supabase
    .from('conversation_states')
    .select('state')
    .eq('contact_id', contactId)
    .eq('platform', 'telegram')
    .gt('expires_at', new Date().toISOString())
    .single();
  return data?.state;
}
```

**Ganancia esperada:** 50% más rápido, mejor indexación, auto-limpieza

---

### 5. Menu-Data - Queries Secuenciales para Préstamos ⚠️ ALTO

**Ubicación:** `supabase/functions/menu-data/index.ts:181-239`

**Problema:**
```typescript
// ❌ PROBLEMA: 4+ queries para cargar préstamos del usuario
// Query 1: Obtener contact info
const { data: userContact } = await supabase
  .from('tenant_contacts')
  .select('contact_profile_id')
  .eq('id', tokenData.contact_id)
  .single();

// Query 2: Préstamos otorgados
const { data: lentAgreements } = await supabase
  .from('agreements')
  .select('*, borrower:tenant_contacts!tenant_contact_id(name)')
  .eq('lender_tenant_contact_id', tokenData.contact_id)
  .in('status', ['active', 'pending_confirmation']);

// Query 3: Todos los contactos del usuario
const { data: allUserContacts } = await supabase
  .from('tenant_contacts')
  .select('id')
  .eq('contact_profile_id', userProfileId);

// Query 4: Préstamos recibidos (cross-tenant)
const { data: borrowedAgreements } = await supabase
  .from('agreements')
  .select('*, lender:tenant_contacts!lender_tenant_contact_id(*)')
  .in('tenant_contact_id', contactIds)
  .in('status', ['active', 'pending_confirmation']);
```

**Impacto:**
- 4+ queries secuenciales por carga de menú
- 300-600ms de latencia
- Complica lógica cross-tenant

**Solución:**
```sql
-- ✅ SOLUCIÓN: Vista materializada o RPC function
CREATE OR REPLACE FUNCTION get_user_all_agreements(
  p_contact_id UUID
) RETURNS TABLE(
  agreement_id UUID,
  type TEXT,
  amount NUMERIC,
  counterparty_name TEXT,
  due_date DATE,
  status TEXT,
  is_lender BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  -- Préstamos otorgados
  SELECT
    a.id,
    a.type,
    a.amount,
    tc.name,
    a.due_date,
    a.status,
    TRUE as is_lender
  FROM agreements a
  INNER JOIN tenant_contacts tc ON a.tenant_contact_id = tc.id
  WHERE a.lender_tenant_contact_id = p_contact_id
    AND a.status IN ('active', 'pending_confirmation')

  UNION ALL

  -- Préstamos recibidos (cross-tenant)
  SELECT
    a.id,
    a.type,
    a.amount,
    lender_tc.name,
    a.due_date,
    a.status,
    FALSE as is_lender
  FROM agreements a
  INNER JOIN tenant_contacts tc ON a.tenant_contact_id = tc.id
  INNER JOIN contact_profiles cp ON tc.contact_profile_id = cp.id
  INNER JOIN tenant_contacts lender_tc ON a.lender_tenant_contact_id = lender_tc.id
  WHERE cp.id = (
    SELECT contact_profile_id
    FROM tenant_contacts
    WHERE id = p_contact_id
  )
  AND a.status IN ('active', 'pending_confirmation')

  ORDER BY due_date ASC;
END;
$$ LANGUAGE plpgsql STABLE;
```

```typescript
// Uso simplificado
const { data: agreements } = await supabase
  .rpc('get_user_all_agreements', { p_contact_id: tokenData.contact_id });
```

**Ganancia esperada:** De 4+ queries a 1 query, 70% más rápido

---

### 6. Message Processor - N+1 en Window Status ⚠️ ALTO

**Ubicación:** `supabase/functions/message_processor/index.ts:188-293`

**Problema:**
```typescript
// ❌ PROBLEMA: Cada mensaje procesa window status individualmente
for (const message of messages) {
  // Dentro de sendMessage() se llama a getWindowStatus()
  // que hace 3-4 queries adicionales por mensaje
  sendResult = await windowManager.sendMessage(
    message.tenant_id,
    message.contact_id,
    messageText,
    { priority: message.priority }
  );
}
```

**Impacto:**
- 100 mensajes en cola = 300-400 queries adicionales
- Procesamiento lento del queue

**Solución:**
```typescript
// ✅ SOLUCIÓN: Pre-cargar todos los window status
const contactIds = messages.map(m => m.contact_id);
const windowStatusMap = await windowManager.batchGetWindowStatus(
  messages[0].tenant_id,
  contactIds
);

for (const message of messages) {
  const windowStatus = windowStatusMap.get(message.contact_id);
  // Usar status pre-cargado sin queries adicionales
}
```

**Ganancia esperada:** 90% reducción en queries durante procesamiento

---

## 🟡 Optimizaciones Frontend

### 7. Code Splitting - Lazy Loading de Rutas

**Ubicación:** `src/App.jsx:5-9`

**Problema:**
```javascript
// ❌ PROBLEMA: Todo se carga en bundle inicial
import Home from './pages/Home'
import Payment from './pages/Payment'
import Dashboard from './pages/Dashboard'
import TermsOfService from './pages/TermsOfService'
import PrivacyPolicy from './pages/PrivacyPolicy'
```

**Impacto:**
- Bundle inicial: ~250KB
- Home.jsx solo: 590 líneas
- Usuario carga código que puede no usar

**Solución:**
```javascript
// ✅ SOLUCIÓN: Lazy loading
import { lazy, Suspense } from 'react'

const Home = lazy(() => import('./pages/Home'))
const Payment = lazy(() => import('./pages/Payment'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const TermsOfService = lazy(() => import('./pages/TermsOfService'))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'))

function App() {
  return (
    <Router>
      <AppContainer>
        <Header />
        <MainContent>
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/payment" element={<Payment />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
            </Routes>
          </Suspense>
        </MainContent>
      </AppContainer>
    </Router>
  )
}
```

**Ganancia esperada:** 40-50% reducción en bundle inicial

---

### 8. React Query - Caché y Stale Time

**Ubicación:** `src/main.jsx`

**Problema:**
```javascript
// ❌ PROBLEMA: No hay configuración de caché
import { QueryClient, QueryClientProvider } from 'react-query'

const queryClient = new QueryClient()
```

**Impacto:**
- Cada navegación hace nuevas requests
- No hay caché entre páginas
- Experiencia lenta en navegación

**Solución:**
```javascript
// ✅ SOLUCIÓN: Configurar caché inteligente
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos
      cacheTime: 10 * 60 * 1000, // 10 minutos
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})
```

**Ganancia esperada:** 60% reducción en requests API repetidas

---

### 9. Dashboard Conectado a API Real

**Ubicación:** `src/pages/Dashboard.jsx:149-190`

**Problema:**
```javascript
// ❌ PROBLEMA: Datos mock estáticos
const stats = [
  { label: 'Ingresos Total', value: '$124,532', ... }
]
```

**Solución:**
```javascript
// ✅ SOLUCIÓN: Conectar a menu-data
import { useQuery } from 'react-query'
import { dashboardService } from '../services/api'

function Dashboard() {
  const { data, isLoading, error } = useQuery(
    'dashboard-stats',
    () => dashboardService.getStats(),
    { staleTime: 2 * 60 * 1000 }
  )

  if (isLoading) return <SkeletonLoader />
  if (error) return <ErrorMessage error={error} />

  return <DashboardContainer>...</DashboardContainer>
}
```

---

### 10. Optimización de Re-renders

**Ubicación:** `src/pages/Home.jsx`

**Problema:**
- Componentes grandes sin memoización
- Arrays recreados en cada render

**Solución:**
```javascript
// ✅ Memoizar datos estáticos
const features = useMemo(() => [
  { icon: <Smartphone />, title: 'Registro en Segundos', ... }
], []);

// ✅ Memoizar componentes pesados
const FeatureCard = memo(({ feature }) => (
  <FeatureCard>
    <FeatureIcon>{feature.icon}</FeatureIcon>
    <FeatureTitle>{feature.title}</FeatureTitle>
    <FeatureDescription>{feature.description}</FeatureDescription>
  </FeatureCard>
));
```

---

## 🗄️ Índices de Base de Datos Faltantes

```sql
-- 1. Window Manager - Queries de ventana de 24 horas (CRÍTICO)
CREATE INDEX idx_whatsapp_messages_window_check
  ON whatsapp_messages(tenant_id, tenant_contact_id, direction, created_at DESC)
  WHERE direction = 'inbound';

-- 2. Conversation States - Lookups activos
CREATE INDEX idx_conversation_states_active
  ON conversation_states(tenant_id, contact_id, platform, expires_at)
  WHERE expires_at > NOW();

-- 3. Agreements - Queries por status y contacto
CREATE INDEX idx_agreements_active_by_lender
  ON agreements(lender_tenant_contact_id, status, created_at DESC)
  WHERE status IN ('active', 'pending_confirmation');

CREATE INDEX idx_agreements_active_by_borrower
  ON agreements(tenant_contact_id, status, created_at DESC)
  WHERE status IN ('active', 'pending_confirmation');

-- 4. Contact Search - Búsquedas por nombre (ILIKE)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_tenant_contacts_name_trgm
  ON tenant_contacts USING gin(name gin_trgm_ops);

-- 5. Message Queue - Procesamiento pendiente
CREATE INDEX idx_message_queue_pending
  ON message_queue(tenant_id, status, priority DESC, created_at ASC)
  WHERE status = 'pending';

-- 6. Reminder Instances - Scheduler queries
CREATE INDEX idx_reminder_instances_due
  ON reminder_instances(status, due_date, tenant_id)
  WHERE status IN ('pending', 'failed');

-- 7. Tenant Routing - Webhook lookups
CREATE INDEX idx_contact_profiles_phone
  ON contact_profiles(phone_e164)
  WHERE phone_e164 IS NOT NULL;

CREATE INDEX idx_tenants_whatsapp_phone
  ON tenants(whatsapp_phone_number_id)
  WHERE whatsapp_phone_number_id IS NOT NULL;
```

---

## 📋 Plan de Implementación Priorizado

### **Fase 1: Quick Wins** (1-2 días) 🚀

**Esfuerzo:** Bajo | **Impacto:** Alto | **Riesgo:** Mínimo

1. **Agregar índices de base de datos** (30 min)
   - Ejecutar script SQL de índices
   - Validar con `EXPLAIN ANALYZE`
   - **Ganancia:** 10-20x más rápido en queries indexadas

2. **Implementar lazy loading de rutas** (1 hora)
   - Modificar `src/App.jsx`
   - Agregar Suspense boundaries
   - **Ganancia:** 40-50% bundle inicial más pequeño

3. **Configurar React Query cache** (30 min)
   - Modificar `src/main.jsx`
   - Configurar staleTime y cacheTime
   - **Ganancia:** 60% menos requests repetidas

4. **Remover logs en producción** (30 min)
   - Eliminar `JSON.stringify()` en edge functions
   - Agregar conditional logging
   - **Ganancia:** 5-10% más rápido

**Total Fase 1:** 2.5 horas de desarrollo
**Ganancia acumulada:** 40-50% mejora general

---

### **Fase 2: Optimizaciones Backend Críticas** (3-5 días) 🔥

**Esfuerzo:** Medio-Alto | **Impacto:** Muy Alto | **Riesgo:** Medio

1. **RPC Function para Tenant Routing** (2 horas)
   - Archivo: `supabase/migrations/028_tenant_routing_rpc.sql`
   - Modificar: `supabase/functions/wa_webhook/index.ts`
   - **Testing:** Scripts de prueba para verificar routing
   - **Ganancia:** 60% más rápido en webhook processing

2. **Batch Queries en Window Manager** (4 horas)
   - Archivo: `supabase/functions/_shared/whatsapp-window-manager.ts`
   - Agregar método `batchGetWindowStatus()`
   - Modificar `getOpenWindowsCount()`
   - **Testing:** Test con 1000 contactos
   - **Ganancia:** 99% reducción en queries

3. **INSERT ON CONFLICT en Scheduler** (3 horas)
   - Migración: Agregar constraint único
   - Archivo: `supabase/functions/scheduler_dispatch/index.ts`
   - Refactorizar loop de reminder instances
   - **Testing:** Verificar no duplicados
   - **Ganancia:** 95% más rápido

4. **Tabla conversation_states** (4 horas)
   - Migración: `supabase/migrations/029_conversation_states_table.sql`
   - Migrar datos existentes de metadata
   - Modificar: `supabase/functions/tg_webhook_simple/index.ts`
   - Agregar job de limpieza automática
   - **Testing:** Verificar migración de estados
   - **Ganancia:** 50% más rápido + mejor mantenimiento

5. **RPC Function para Menu Data** (4 horas)
   - Archivo: `supabase/migrations/030_user_agreements_rpc.sql`
   - Modificar: `supabase/functions/menu-data/index.ts`
   - **Testing:** Verificar cross-tenant correctamente
   - **Ganancia:** 70% más rápido

6. **Batch Window Status en Message Processor** (3 horas)
   - Archivo: `supabase/functions/message_processor/index.ts`
   - Pre-cargar window status
   - **Testing:** Procesar 100 mensajes
   - **Ganancia:** 90% reducción en queries

**Total Fase 2:** 20 horas de desarrollo
**Ganancia acumulada:** 3-4x mejora en backend

---

### **Fase 3: Refactorización Frontend** (1 semana) 💪

**Esfuerzo:** Medio | **Impacto:** Medio | **Riesgo:** Bajo

1. **Conectar Dashboard a API real** (1 día)
   - Modificar: `src/pages/Dashboard.jsx`
   - Crear endpoint en `menu-data` o nuevo endpoint
   - Agregar skeleton loaders
   - **Testing:** Verificar datos reales

2. **Agregar Skeleton Loaders** (1 día)
   - Crear componentes: `src/components/SkeletonLoader.jsx`
   - Aplicar en todas las páginas
   - **UX:** Mejora percepción de velocidad

3. **Error Boundaries** (1 día)
   - Crear: `src/components/ErrorBoundary.jsx`
   - Envolver rutas principales
   - **UX:** Mejor manejo de errores

4. **Optimizar Re-renders** (2 días)
   - Aplicar `React.memo()` a componentes
   - Usar `useMemo()` y `useCallback()`
   - **Testing:** Verificar con React DevTools Profiler

5. **Considerar CSS Modules** (2 días - opcional)
   - Migrar styled-components a CSS Modules
   - **Ganancia:** 20-30% más rápido First Paint
   - **Riesgo:** Alto - cambio grande

**Total Fase 3:** 5-7 días de desarrollo
**Ganancia acumulada:** 30-40% mejora en UX percibida

---

## 📊 Métricas de Éxito

### Antes (Estado Actual Estimado)

| Métrica | Valor Actual | Componente Afectado |
|---------|--------------|---------------------|
| Webhook response time | 800-1500ms | wa_webhook, tg_webhook |
| Scheduler execution | 2-5s | scheduler_dispatch |
| Queries por scheduler | 500+ | reminder_instances |
| Menu data load time | 400-800ms | menu-data |
| Bundle size inicial | ~250KB | Frontend |
| Time to Interactive | 2-3s | Frontend |
| Window status check | 100ms × N contactos | window-manager |

### Después (Objetivos Post-Optimización)

| Métrica | Valor Objetivo | Mejora | Prioridad |
|---------|---------------|--------|-----------|
| Webhook response time | 200-400ms | **66% más rápido** | 🔴 Alta |
| Scheduler execution | 300-800ms | **85% más rápido** | 🔴 Alta |
| Queries por scheduler | 10-20 | **96% reducción** | 🔴 Alta |
| Menu data load time | 100-200ms | **75% más rápido** | 🔴 Alta |
| Bundle size inicial | ~150KB | **40% más pequeño** | 🟡 Media |
| Time to Interactive | 1-1.5s | **50% más rápido** | 🟡 Media |
| Window status check | 50ms (batch) | **95% más rápido** | 🔴 Alta |

### Herramientas de Monitoreo

```bash
# Backend - Analizar queries lentas
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 20;

# Frontend - Lighthouse CI
npm run build
npx lighthouse https://somospayme.cl --view

# Bundle Analysis
npm run build
npx vite-bundle-visualizer
```

---

## 🛠️ Scripts de Testing

### Test Window Manager Batch Performance

```typescript
// scripts/test-window-manager-batch.ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!)

async function testBatchPerformance() {
  const tenantId = 'test-tenant-id'
  const contactIds = Array.from({ length: 1000 }, (_, i) => `contact-${i}`)

  console.time('❌ OLD: Individual queries')
  for (const contactId of contactIds.slice(0, 100)) {
    await supabase
      .from('whatsapp_messages')
      .select('created_at')
      .eq('tenant_id', tenantId)
      .eq('tenant_contact_id', contactId)
      .eq('direction', 'inbound')
      .order('created_at', { ascending: false })
      .limit(1)
  }
  console.timeEnd('❌ OLD: Individual queries')

  console.time('✅ NEW: Batch query')
  await supabase
    .from('whatsapp_messages')
    .select('tenant_contact_id, created_at')
    .eq('tenant_id', tenantId)
    .in('tenant_contact_id', contactIds)
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
  console.timeEnd('✅ NEW: Batch query')
}

testBatchPerformance()
```

### Test Scheduler Performance

```typescript
// scripts/test-scheduler-batch.ts
async function testSchedulerPerformance() {
  const testReminders = Array.from({ length: 500 }, (_, i) => ({
    reminder_id: `reminder-${i}`,
    agreement_id: `agreement-${i % 100}`,
    due_date: '2025-10-21',
    status: 'pending'
  }))

  console.time('❌ OLD: Loop with checks')
  for (const reminder of testReminders.slice(0, 50)) {
    const { data } = await supabase
      .from('reminder_instances')
      .select('id')
      .eq('reminder_id', reminder.reminder_id)
      .maybeSingle()

    if (!data) {
      await supabase.from('reminder_instances').insert(reminder)
    }
  }
  console.timeEnd('❌ OLD: Loop with checks')

  console.time('✅ NEW: Batch insert with ON CONFLICT')
  await supabase
    .from('reminder_instances')
    .insert(testReminders)
    .onConflict('reminder_id,due_date')
    .ignore()
  console.timeEnd('✅ NEW: Batch insert with ON CONFLICT')
}
```

---

## 🚨 Consideraciones de Riesgo

### Riesgos Técnicos

| Optimización | Riesgo | Mitigación |
|--------------|--------|------------|
| Batch queries | Límite de parámetros SQL | Dividir en lotes de 1000 |
| Conversation states migration | Pérdida de datos en metadata | Backup + migración gradual |
| RPC functions | Cambios en lógica de negocio | Tests exhaustivos + rollback plan |
| Lazy loading | Initial loading blank screen | Suspense fallback + skeleton |
| React Query cache | Datos stale/desactualizados | Configurar refetch apropiado |

### Plan de Rollback

```sql
-- Si algo falla con conversation_states
-- 1. Deshabilitar nuevo código (feature flag)
-- 2. Restaurar queries a metadata
-- 3. Drop table si es necesario
DROP TABLE IF EXISTS conversation_states;

-- Si índices causan problemas
DROP INDEX IF EXISTS idx_whatsapp_messages_window_check;
```

---

## 📚 Referencias y Recursos

### Documentación Relevante

- [Supabase Performance Tips](https://supabase.com/docs/guides/database/postgres/performance)
- [React Query Performance](https://tanstack.com/query/latest/docs/react/guides/performance)
- [Vite Code Splitting](https://vitejs.dev/guide/features.html#async-chunk-loading-optimization)
- [PostgreSQL Indexing Best Practices](https://www.postgresql.org/docs/current/indexes.html)

### Herramientas de Análisis

- **Backend:** pg_stat_statements, EXPLAIN ANALYZE
- **Frontend:** Lighthouse, Bundle Analyzer, React DevTools Profiler
- **Network:** Chrome DevTools Network tab
- **Database:** pgAdmin, Supabase Dashboard

---

## ✅ Checklist de Implementación

### Pre-implementación
- [ ] Backup completo de base de datos
- [ ] Crear branch de desarrollo: `feature/performance-optimization`
- [ ] Configurar métricas baseline (antes)
- [ ] Notificar al equipo del plan

### Fase 1
- [ ] Ejecutar script de índices
- [ ] Implementar lazy loading
- [ ] Configurar React Query cache
- [ ] Remover logs en producción
- [ ] Medir mejoras vs baseline
- [ ] Deploy a staging
- [ ] Validar en producción

### Fase 2
- [ ] Implementar RPC tenant routing
- [ ] Batch queries Window Manager
- [ ] INSERT ON CONFLICT scheduler
- [ ] Migrar conversation_states
- [ ] RPC menu data
- [ ] Batch message processor
- [ ] Testing exhaustivo
- [ ] Deploy gradual (canary)

### Fase 3
- [ ] Conectar Dashboard API
- [ ] Skeleton loaders
- [ ] Error boundaries
- [ ] Optimizar re-renders
- [ ] Testing UX
- [ ] Deploy final

### Post-implementación
- [ ] Monitorear métricas por 1 semana
- [ ] Documentar lecciones aprendidas
- [ ] Actualizar documentación técnica
- [ ] Capacitar equipo en nuevos patterns

---

## 🎓 Lecciones Aprendidas y Mejores Prácticas

### Patterns a Aplicar en el Futuro

1. **Siempre usar batch queries cuando se procesa múltiples registros**
   - N+1 queries es el anti-pattern más común y costoso

2. **Diseñar índices antes de escribir queries**
   - Índices compuestos con columnas en orden de selectividad

3. **Usar RPC functions para lógica compleja**
   - Reduce round-trips y aprovecha el motor de PostgreSQL

4. **Implementar caché inteligente desde el inicio**
   - React Query, Redis, o caché en-memory según caso

5. **Code splitting por defecto**
   - Lazy loading debería ser el estándar, no la excepción

6. **Monitorear performance desde día 1**
   - Instrumentar antes de que haya problemas

---

## 👥 Equipo y Responsables

- **Backend Optimization:** [Asignar desarrollador backend]
- **Frontend Optimization:** [Asignar desarrollador frontend]
- **Database Migrations:** [Asignar DBA o backend senior]
- **Testing & QA:** [Asignar QA engineer]
- **DevOps/Deploy:** [Asignar DevOps]

---

## 📅 Timeline Propuesto

```
Semana 1:
  Lunes-Martes: Fase 1 (Quick Wins)
  Miércoles: Testing + Deploy Fase 1
  Jueves-Viernes: Inicio Fase 2

Semana 2:
  Lunes-Miércoles: Continuar Fase 2
  Jueves: Testing exhaustivo Fase 2
  Viernes: Deploy gradual Fase 2

Semana 3:
  Lunes-Miércoles: Fase 3 (Frontend)
  Jueves: Testing UX Fase 3
  Viernes: Deploy final + monitoreo

Semana 4:
  Lunes-Viernes: Monitoreo + ajustes finos
```

---

## 📞 Contacto y Soporte

Para preguntas sobre este análisis o durante la implementación:

- **Documentación:** `/docs/PERFORMANCE_ANALYSIS_2025.md`
- **Issue GitHub:** #[número del issue]
- **Slack Channel:** #performance-optimization (si existe)

---

**Última actualización:** 2025-10-20
**Próxima revisión:** Post-implementación Fase 2
