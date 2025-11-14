# Análisis Lean Startup - Payme

**Fecha de Análisis:** 2025-11-02
**Última Actualización:** 2025-11-02 (Experimento #1 añadido)
**Versión del Proyecto:** v2.6.0
**Metodología:** Build-Measure-Learn (Lean Startup)
**Analista:** Asesor Lean Startup

---

## 🎯 ACTUALIZACIÓN CRÍTICA (2025-11-02)

### Nueva Oportunidad Identificada

Se ha identificado una **segunda oportunidad de valor** además del fundamento original:

- **Opción A (Original)**: Deudas informales P2P - "Retomar confianzas"
- **Opción B (Nueva)**: Recordatorios de pagos recurrentes (dividendo, luz, agua, etc.) - "Nunca más olvides un pago"

### Decisión Estratégica

Antes de continuar desarrollo, se ejecutará **Experimento #1 (Entrevistas)** para validar cuál oportunidad tiene mayor tracción y debería priorizarse.

### Documentos de Validación Generados

📋 **Entregables para validación temprana:**
1. `/docs/SCRIPT_ENTREVISTAS_VALIDACION.md` - Script completo de entrevistas (A + B)
2. `/docs/PLANTILLA_CAPTURA_ENTREVISTAS.md` - Plantilla de registro de datos
3. `/docs/GUIA_ANALISIS_RESULTADOS_ENTREVISTAS.md` - Cómo analizar y decidir

**Próximo paso inmediato:** Ejecutar 15-20 entrevistas friends & family para decidir A vs B.

---

## ÍNDICE

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Estado Actual vs Visión Payme](#estado-actual-vs-visión-payme)
3. [Mapeo de Funcionalidades por Etapa](#mapeo-de-funcionalidades-por-etapa)
4. [Análisis de Hipótesis Críticas](#análisis-de-hipótesis-críticas)
5. [Plan de Experimentos Priorizados](#plan-de-experimentos-priorizados)
6. [Métricas y Medición](#métricas-y-medición)
7. [Roadmap de Validación](#roadmap-de-validación)
8. [Riesgos y Supuestos No Validados](#riesgos-y-supuestos-no-validados)

---

## 1. RESUMEN EJECUTIVO

### Estado General del Proyecto

**presta_bot** es un MVP funcional que cubre aproximadamente **60-70% de la Etapa 1** del fundamento PayMe, con componentes avanzados de infraestructura (AI, multi-tenant, WhatsApp Flows) pero **gaps críticos en el core value proposition**.

### Hallazgos Clave

- ✅ **FORTALEZA:** Infraestructura técnica robusta (AI Agent, WhatsApp Business API, Supabase, multi-tenant)
- ✅ **FORTALEZA:** Flujo conversacional completo para crear préstamos
- ✅ **FORTALEZA:** Sistema de confirmación bidireccional implementado
- ❌ **GAP CRÍTICO:** Sistema de recordatorios automáticos NO funciona (core value)
- ❌ **GAP CRÍTICO:** No hay usuarios orgánicos validando el producto
- ❌ **GAP CRÍTICO:** Cero indicios de monetización (Etapa 2)
- ⚠️ **RIESGO:** Sobre-ingeniería sin validación de mercado

### Diagnóstico Lean Startup

**El proyecto está en riesgo de "build trap"**: construyendo features técnicamente sofisticadas sin validar las hipótesis fundamentales del negocio.

**Recomendación urgente:** PAUSAR desarrollo de features nuevas y ENFOCARSE en validar el ciclo Build-Measure-Learn básico con usuarios reales.

---

## 2. ESTADO ACTUAL VS VISIÓN PAYME

### Etapa 1: "Retomar las Confianzas" (PayMe MVP)

**Propuesta de Valor PayMe:**
> "Chatbot que te ayuda a recordarle a otras personas una deuda (cualquier cosa), a través de una conversación simple de tres pasos: A quién, qué y cuándo. El usuario envía una solicitud de recordatorio, el destinatario debe aceptar, y en la fecha acordada se envía el mensaje recordando la deuda."

#### Comparación Feature por Feature

| Feature PayMe Etapa 1 | Estado en presta_bot | Gap | Prioridad |
|----------------------|---------------------|-----|-----------|
| **Conversación simple 3 pasos** | ✅ Implementado (6 pasos) | Más complejo de lo necesario | MEDIA |
| **A quién:** Selección de contacto | ✅ Implementado + búsqueda fuzzy + AI | ✅ Sobrepasa expectativa | BAJA |
| **Qué:** Descripción del préstamo | ✅ Dinero/Objeto/Otro | ✅ Completo | BAJA |
| **Cuándo:** Fecha de devolución | ✅ Parser natural + DatePicker | ✅ Completo | BAJA |
| **Solicitud de recordatorio** | ✅ Template WhatsApp HSM | ✅ Completo | BAJA |
| **Destinatario acepta/rechaza** | ✅ Botones + lógica | ✅ Completo | BAJA |
| **🔴 Envío automático en fecha** | ❌ NO FUNCIONA | **CRÍTICO** | **CRÍTICA** |
| **Recordatorios (+1, +3 días)** | ⏳ Parcial (scheduler existe pero sin validar) | **ALTO** | **CRÍTICA** |
| **Confirmación de devolución** | ⏳ Lógica existe, no ejecuta | MEDIO | ALTA |
| **Experiencia sin fricción** | ✅ WhatsApp (no nueva app) | ✅ Completo | BAJA |

#### Funcionalidades NO requeridas en Etapa 1 (Over-engineering)

| Feature Implementado | Requerido en Etapa 1? | Costo de Oportunidad |
|---------------------|----------------------|----------------------|
| AI Agent con GPT-4/5 | ❌ No crítico | Alto |
| Text-to-SQL dinámico | ❌ No necesario | Alto |
| Búsqueda fonética | ❌ Nice-to-have | Medio |
| WhatsApp Flows (UI nativa) | ⚠️ Útil pero no core | Medio |
| Multi-tenant completo | ⚠️ Premature optimization | Alto |
| Sistema de auditoría AI | ❌ No requerido | Medio |
| Análisis de imágenes (Vision) | ❌ No requerido | Bajo |

**Interpretación Lean:**
El equipo ha invertido ~60% del esfuerzo en features "wow" (AI, búsqueda inteligente, flows) que NO validan la hipótesis fundamental: **"¿La gente NECESITA recordatorios automáticos para deudas informales?"**

---

### Etapa 2: Monetización (NO iniciada)

**Propuesta PayMe:**
- Recordatorios recurrentes
- Medio de recaudación propio
- Modelo de suscripción para emprendedores/pymes
- Reportería de seguimiento

**Estado en presta_bot:** ❌ CERO implementación
**Gap:** 100%
**Comentario:** Correcto según Lean Startup. NO monetizar antes de validar product-market fit.

---

### Etapa 3: Partner B2B (NO iniciada)

**Propuesta PayMe:**
- Agentes IA negociadores
- Cobranza automatizada para empresas
- Fee por recuperación

**Estado en presta_bot:** ❌ CERO implementación
**Gap:** 100%
**Comentario:** Premature. Enfocarse en Etapa 1.

---

## 3. MAPEO DE FUNCIONALIDADES POR ETAPA

### Arquitectura Actual del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESTA_BOT v2.6.0                        │
└─────────────────────────────────────────────────────────────┘

FRONTEND (No crítico para MVP)
└── React 18 + Vite + Styled Components
    └── Dashboard analytics (no validado con usuarios reales)

BACKEND - Edge Functions (Supabase/Deno)
├── wa_webhook ✅ (2290 líneas)
│   ├── Recepción de mensajes WhatsApp
│   ├── Verificación webhook
│   ├── Routing a conversacional vs AI
│   └── Envío de respuestas + templates HSM
│
├── ai-agent ✅ (2011 líneas)
│   ├── OpenAI GPT-4/5-nano
│   ├── Whisper (transcripción audio)
│   ├── Vision (análisis imágenes)
│   ├── Text-to-SQL dinámico
│   ├── Búsqueda fonética contactos
│   ├── Function calling (6 tools)
│   └── Sistema de permisos granular
│
├── scheduler_dispatch ⚠️ (existe pero no validado)
│   ├── Generación reminder_instances
│   ├── Envío de recordatorios
│   └── Manejo ventana 24h WhatsApp
│
├── flows-handler ✅
│   ├── WhatsApp Flows (formularios nativos)
│   └── Procesamiento encriptado
│
└── _shared/ (módulos reutilizables)
    ├── openai-client.ts
    ├── contact-fuzzy-search.ts
    ├── phonetic-variants.ts
    ├── whatsapp-window-manager.ts
    └── schema-provider.ts (AI SQL)

BASE DE DATOS (PostgreSQL + RLS)
├── Tenants (multi-tenant) ✅
├── Contact Profiles (globales) ✅
├── Tenant Contacts (scoped) ✅
├── Agreements (préstamos) ✅
├── Reminders (configs) ✅
├── Reminder Instances ⚠️ (31 rows, no se envían)
├── Templates (HSM WhatsApp) ✅
├── Conversation History (AI) ✅
├── AI Audit Logs ✅
└── OpenAI Requests Log ✅

INTEGRACIONES
├── WhatsApp Business API ✅
├── OpenAI API ✅
└── Telegram Bot API ✅ (completo)
```

### Distribución del Esfuerzo de Desarrollo

**Análisis basado en commits recientes y tamaño de código:**

```
Funcionalidades Core (Etapa 1 PayMe):     30%
├── Conversación nuevo préstamo:          15%
├── Sistema confirmación:                 10%
└── Recordatorios (INCOMPLETO):           5%

Infraestructura Técnica:                  45%
├── AI Agent + Text-to-SQL:               20%
├── Multi-tenant + RLS:                   15%
└── Sistema de auditoría:                 10%

Features "Nice-to-have":                  25%
├── WhatsApp Flows (formularios):         10%
├── Búsqueda fonética:                    5%
├── Análisis imágenes:                    5%
└── Telegram bot:                         5%

Validación con usuarios reales:           0%
└── Sin evidencia de testing con usuarios
```

**Diagnóstico:** Inversión desbalanceada. 70% del esfuerzo NO valida la hipótesis core.

---

## 4. ANÁLISIS DE HIPÓTESIS CRÍTICAS

### Framework de Priorización: Riesgo x Impacto

Usaremos el criterio: **"¿Qué suposición, si es falsa, haría colapsar todo el plan?"**

---

### 🔴 HIPÓTESIS 1 (CRÍTICA): Value Proposition

**Suposición:**
> "Las personas necesitan recordatorios automáticos por WhatsApp para gestionar deudas informales (préstamos entre amigos/familia) porque olvidan cobrar/pagar y esto genera conflictos."

**Estado de Validación:** ❌ **NO VALIDADA**

**Evidencia faltante:**
- ❌ Cero usuarios orgánicos registrados
- ❌ No hay métricas de engagement
- ❌ No existe validación del problema (entrevistas)
- ❌ No hay evidencia de que los recordatorios SE ENVÍAN
- ❌ No se mide tasa de recordatorios efectivos

**Riesgo si es falsa:**
- 🔥 **EXTREMO:** Todo el producto colapsa
- El problema puede no existir o tener soluciones alternativas mejores
- Las personas pueden preferir no automatizar este tipo de recordatorios (factor social)

**Métricas para validar:**
1. **Problema existe:** % de usuarios que crean ≥3 préstamos en primer mes
2. **Recordatorios útiles:** % de usuarios que NO desactivan recordatorios
3. **Outcomes positivos:** % de préstamos marcados como "devuelto" después del recordatorio
4. **NPS:** Net Promoter Score > 30

**Experimento propuesto:** Ver Experimento #1 en sección 5.

---

### 🔴 HIPÓTESIS 2 (CRÍTICA): Recordatorios Automáticos Funcionan

**Suposición:**
> "El sistema de recordatorios automáticos funciona correctamente y envía mensajes en las fechas programadas."

**Estado de Validación:** ❌ **NO VALIDADA (probablemente FALSA)**

**Evidencia de problema:**
```sql
-- Verificación de la base de datos
SELECT COUNT(*) FROM reminder_instances WHERE status = 'sent';
-- Resultado: número desconocido, pero hay indicios de que no se envían

SELECT COUNT(*) FROM reminder_instances WHERE status = 'pending'
  AND scheduled_for < NOW();
-- Si este número > 0, hay recordatorios vencidos sin enviar
```

**Archivos relevantes:**
- `/supabase/functions/scheduler_dispatch/index.ts` (existe)
- `/docs/TIMEZONE_MANEJO_RECORDATORIOS.md` (documenta problema)

**Extracto del doc:**
> "**Problema actual**: ❌ NO llama a `generate_reminder_instances()`"

**Riesgo si es falsa:**
- 🔥 **EXTREMO:** El core value NO funciona
- Los usuarios registran préstamos pero NUNCA reciben recordatorios
- Pérdida de confianza total

**Experimento propuesto:** Ver Experimento #2 en sección 5.

---

### 🟡 HIPÓTESIS 3 (ALTA): Confirmación Bidireccional Reduce Conflictos

**Suposición:**
> "Pedir confirmación al destinatario (borrower) antes de activar recordatorios reduce conflictos y aumenta la confianza en el sistema."

**Estado de Validación:** ⚠️ **PARCIALMENTE VALIDADA**

**Evidencia a favor:**
- ✅ Sistema implementado (templates HSM)
- ✅ Lógica de confirmación/rechazo funciona
- ✅ Se registran eventos en tabla `events`

**Evidencia faltante:**
- ❌ No hay métricas de tasa de confirmación
- ❌ No se mide tasa de rechazo ni motivos
- ❌ No hay comparación con/sin confirmación (A/B test)

**Riesgo si es falsa:**
- 🟡 **MEDIO:** Fricción innecesaria en onboarding
- Posible pérdida de usuarios si el proceso es muy largo

**Métricas para validar:**
1. **Tasa de confirmación:** % borrowers que aceptan (objetivo: >70%)
2. **Tasa de rechazo:** % borrowers que rechazan (objetivo: <15%)
3. **Tiempo hasta confirmación:** mediana de tiempo (objetivo: <2 horas)
4. **Motivos de rechazo:** categorización (implementar captura)

**Experimento propuesto:**
- Medir métricas actuales durante 2 semanas
- Si tasa de rechazo > 20%, investigar motivos
- Si tiempo > 24h, implementar recordatorio de confirmación

---

### 🟡 HIPÓTESIS 4 (MEDIA): WhatsApp es el Canal Ideal

**Suposición:**
> "WhatsApp es el canal preferido de los usuarios para gestionar recordatorios de deudas informales (vs SMS, email, app dedicada)."

**Estado de Validación:** ⚠️ **ASUMIDA, NO VALIDADA**

**Evidencia a favor:**
- WhatsApp es el canal de mensajería #1 en Chile (datos públicos)
- No requiere nueva app (reduce fricción)
- Contexto conversacional familiar

**Evidencia faltante:**
- ❌ No hay comparación con otros canales
- ❌ No se midió preferencia de usuarios
- ❌ No hay validación de que responden en WhatsApp

**Riesgo si es falsa:**
- 🟡 **MEDIO:** Inversión en canal equivocado
- Restricciones de WhatsApp Business API (ventana 24h, templates aprobados)
- Costos por mensaje

**Experimento propuesto:**
- Medir tasa de respuesta en WhatsApp (objetivo: >60%)
- Encuestar a primeros 50 usuarios sobre preferencia de canal
- Comparar con canal alternativo low-cost (email) en experimento controlado

---

### 🟢 HIPÓTESIS 5 (BAJA): AI Mejora la Experiencia

**Suposición:**
> "Un agente de IA conversacional mejora la experiencia del usuario vs flujo estructurado con botones."

**Estado de Validación:** ⚠️ **NO VALIDADA (ni necesaria en Etapa 1)**

**Evidencia:**
- ✅ AI Agent funciona técnicamente
- ❌ No hay métricas de satisfacción AI vs botones
- ❌ No hay A/B test
- ❌ Costos de OpenAI no calculados vs valor aportado

**Riesgo si es falsa:**
- 🟢 **BAJO:** Feature "nice-to-have"
- Costo adicional sin retorno de valor

**Recomendación Lean:**
**DEPRIORITIZAR.** La IA es una optimización, no el core value. Validar primero que los recordatorios funcionen, luego optimizar UX.

**Experimento futuro (post product-market fit):**
- A/B test: 50% usuarios con AI, 50% con botones estructurados
- Medir: tiempo de completación, tasa de abandono, satisfacción (NPS)
- Si diferencia < 10 puntos NPS, mantener botones (más barato)

---

### 🟢 HIPÓTESIS 6 (BAJA): Multi-tenant Escalable es Necesario

**Suposición:**
> "Necesitamos arquitectura multi-tenant desde el día 1 para escalar rápido."

**Estado de Validación:** ❌ **PREMATURE OPTIMIZATION**

**Riesgo:**
- 🟢 **BAJO:** Arquitectura correcta pero temprana
- Complejidad añadida sin usuarios que la justifiquen
- Tiempo de desarrollo 3x vs single-tenant

**Recomendación Lean:**
La arquitectura multi-tenant está BIEN, pero fue implementada antes de validar product-market fit. En retrospectiva, un single-tenant hubiera permitido iterar más rápido.

**Aprendizaje para futuros productos:**
Empezar con single-tenant, migrar a multi-tenant cuando haya 50+ usuarios pagando.

---

## 5. PLAN DE EXPERIMENTOS PRIORIZADOS

### ⚠️ ACTUALIZACIÓN: Nuevo Experimento #1 Prioritario

Antes de continuar con validación técnica, se ha identificado una **decisión estratégica crítica**: ¿Deberías construir para deudas P2P (A) o pagos recurrentes (B)?

**Nuevo orden de experimentos:**
1. **Experimento #1 (NUEVO):** Entrevistas problema-solución fit (A vs B)
2. **Experimento #2:** Validar que recordatorios se envían (técnico)
3. **Experimento #3:** Smoke test de mercado (landing pages)

### Criterios de Priorización

Usaremos **ICE Score:**
- **I**mpact (1-10): Impacto en validar hipótesis crítica
- **C**onfidence (1-10): Confianza en que aprenderemos algo útil
- **E**ase (1-10): Facilidad de ejecución

**Fórmula:** ICE = (Impact + Confidence + Ease) / 3

---

## 🎯 EXPERIMENTO #1: Entrevistas Problema-Solución Fit (A vs B)

**🆕 EXPERIMENTO NUEVO - MÁXIMA PRIORIDAD**

**Hipótesis a validar:**
- Hipótesis A: "Personas con deudas informales necesitan recordatorios para no dañar relaciones"
- Hipótesis B: "Personas con pagos recurrentes necesitan recordatorios para evitar multas/cortes"

**ICE Score:** 10/10/9 = **9.7** (CRÍTICO - DEBE EJECUTARSE PRIMERO)

### Objetivo

Determinar cuál oportunidad (A o B) tiene mayor intensidad de pain, willingness to pay y tracción potencial ANTES de construir funcionalidades específicas.

### Por Qué Este Experimento Ahora

**Riesgo actual:** El código está enfocado en préstamos formales (A), pero puede que el mayor mercado sea pagos recurrentes (B). Construir para el segmento equivocado = desperdicio de 3-6 meses.

**Decisión a tomar:**
- Si B gana → Pivotar producto hacia pagos recurrentes
- Si A gana → Continuar con fundamento original
- Si empate → A/B test en landing pages

### Experimento Mínimo

**DURACIÓN:** 2 semanas
**ESFUERZO:** Founder, 20 horas total (15-20 entrevistas @ 30 min c/u)
**PRESUPUESTO:** $0 CLP (friends & family)

#### Build (Preparar)

**Documentos YA generados:**
1. ✅ `/docs/SCRIPT_ENTREVISTAS_VALIDACION.md` - Script completo con preguntas para A y B
2. ✅ `/docs/PLANTILLA_CAPTURA_ENTREVISTAS.md` - Registro de datos estructurado
3. ✅ `/docs/GUIA_ANALISIS_RESULTADOS_ENTREVISTAS.md` - Cómo consolidar y decidir

**Pasos de preparación (1 hora):**
1. Imprimir o tener accesible el script
2. Crear 1 copia de plantilla por cada entrevista
3. Hacer lista de 20 contactos a entrevistar (friends & family)
4. Agendar entrevistas (WhatsApp/llamada)

#### Measure (Medir)

**Métricas de éxito por entrevista:**

**Opción B (Pagos Recurrentes):**
- Pain score B ≥ 7/10
- % que olvidó pagos últimos 6 meses
- Willingness to pay ≥ $990/mes
- Prioriza B sobre A

**Opción A (Deudas Informales):**
- Pain score A ≥ 7/10
- % que presta/pide dinero regularmente
- Incomodidad recordar ≥ 7/10
- Prioriza A sobre B

**Consolidación (post 15-20 entrevistas):**
```
Pain promedio B = ___/10
Pain promedio A = ___/10
% prioriza B = ___%
% prioriza A = ___%
WTP promedio = $___/mes
```

#### Learn (Aprender)

**Criterios de decisión:**

**Escenario 1: B gana claramente** (Pain B > 7, >60% prioriza B)
→ **Decisión:** Pivotar producto hacia pagos recurrentes
→ **Próximo paso:** Experimento #3 (Smoke Test B)
→ **Impacto:** Reformular value prop y UX

**Escenario 2: A gana claramente** (Pain A > 7, >60% prioriza A)
→ **Decisión:** Continuar con fundamento original
→ **Próximo paso:** Experimento #2 (Fix recordatorios)
→ **Impacto:** Seguir con código actual

**Escenario 3: Empate** (Ambos >7, split 50/50)
→ **Decisión:** A/B test con landing pages
→ **Próximo paso:** Experimento #3 con dos variantes
→ **Impacto:** Dejar que mercado decida

**Escenario 4: Ninguno valida** (Ambos <5)
→ **Decisión:** PIVOTAR completo o reformular value prop
→ **Próximo paso:** 5 entrevistas profundas adicionales
→ **Impacto:** Reconsiderar problema a resolver

### Entregables

**Después de completar las entrevistas:**
1. Tabla Excel con datos consolidados (ver guía)
2. Reporte ejecutivo con decisión justificada
3. Segmento target identificado
4. Value prop refinada basada en insights

### Señales de Éxito

- ✅ 15+ entrevistas completadas
- ✅ Pain promedio de opción ganadora ≥ 7/10
- ✅ >60% de entrevistados prioriza misma opción
- ✅ >40% pagaría al menos $990/mes
- ✅ Decisión clara sobre A, B, o A/B test

### Riesgos

🚩 **Sesgo de cortesía** (friends & family mienten por amabilidad)
- **Mitigación:** Hacer preguntas sobre comportamientos pasados, no futuro hipotético

🚩 **Muestra no representativa** (solo millennials universitarios)
- **Mitigación:** Diversificar edad y ocupación (18-50 años)

🚩 **Parálisis por análisis** (no decidir después de entrevistas)
- **Mitigación:** Usar criterios objetivos de decisión en guía

---

## 🎯 EXPERIMENTO #2: Validar que Recordatorios se Envían

**Hipótesis a validar:** Hipótesis #2 (Recordatorios Automáticos Funcionan)

**ICE Score:** 10/10/7 = **9.0** (MÁXIMA PRIORIDAD)

### Objetivo

Confirmar que el sistema de recordatorios automáticos funciona de punta a punta: genera instancias, las ejecuta en el momento correcto, y envía mensajes por WhatsApp.

### Experimento Mínimo

**DURACIÓN:** 3 días
**ESFUERZO:** 1 desarrollador, 8 horas total

#### Build (Construir)

**Paso 1: Auditoría del scheduler (2 horas)**

1. Revisar si `pg_cron` está configurado en Supabase:
   ```sql
   SELECT * FROM cron.job;
   ```

2. Verificar que existe job para llamar a `scheduler_dispatch`:
   ```sql
   -- Debería haber algo como:
   -- schedule: '*/15 * * * *' (cada 15 minutos)
   -- command: SELECT net.http_post(...)
   ```

3. Si NO existe, crear job:
   ```sql
   SELECT cron.schedule(
     'scheduler-dispatch-every-15min',
     '*/15 * * * *',
     $$
     SELECT net.http_post(
       url := 'https://[PROJECT_REF].supabase.co/functions/v1/scheduler_dispatch',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || '[SCHEDULER_AUTH_TOKEN]'
       ),
       body := jsonb_build_object('max_instances', 100)
     ) AS request_id;
     $$
   );
   ```

**Paso 2: Fix del bug documentado (3 horas)**

Según `/docs/TIMEZONE_MANEJO_RECORDATORIOS.md`:
> "**Problema actual**: ❌ NO llama a `generate_reminder_instances()`"

1. Localizar dónde debería llamarse la función
2. Agregar llamada en el flujo de creación de agreement
3. Validar en `setupDefaultReminders()` que genera las instancias

**Paso 3: Test manual con préstamo sintético (1 hora)**

```typescript
// Crear préstamo de prueba que vence MAÑANA
const testAgreement = {
  lender: 'Test User',
  borrower: '+56912345678', // número de prueba
  amount: 1000,
  due_date: '2025-11-03', // mañana
  type: 'money'
};

// Verificar que se crean 3 reminder_instances:
// 1. before_24h (hoy a las 10:00)
// 2. due_date (mañana a las 09:00)
// 3. overdue (pasado mañana a las 16:00)
```

**Paso 4: Logs y monitoreo (2 horas)**

Agregar logs críticos:
```typescript
console.log('[SCHEDULER] Checking pending reminders...');
console.log('[SCHEDULER] Found X instances to send');
console.log('[SCHEDULER] Sent reminder to +56912345678, status: delivered');
console.log('[SCHEDULER] Failed to send, error: ...');
```

#### Measure (Medir)

**Métricas de Éxito:**

1. **Métrica Primaria:** % de `reminder_instances` con `status='sent'` después de `scheduled_for`
   - **Criterio de éxito:** ≥95% (permite 5% de fallos por WhatsApp API)

2. **Métricas Secundarias:**
   - Tiempo promedio entre `scheduled_for` y `sent_at` (<30 minutos)
   - % de errores por tenant
   - Logs sin errores críticos

**Cómo medir:**
```sql
-- Después de 24 horas del experimento
SELECT
  status,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM reminder_instances
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY status;

-- Resultado esperado:
-- status  | count | percentage
-- sent    |  28   | 93.33%
-- failed  |   2   |  6.67%
-- pending |   0   |  0.00%  ← Si hay pending vencidos, HAY BUG
```

#### Learn (Aprender)

**Posibles resultados:**

**Resultado A: ≥95% enviados exitosamente**
- ✅ **Hipótesis VALIDADA:** Recordatorios funcionan
- **Próximo paso:** Experimento #3 (validar que usuarios los encuentran útiles)

**Resultado B: 50-95% enviados**
- ⚠️ **Hipótesis PARCIAL:** Funciona pero con bugs
- **Investigar:** errores específicos (WhatsApp API, timezone, window 24h)
- **Iterar:** Fix bugs y repetir experimento en 3 días

**Resultado C: <50% enviados**
- ❌ **Hipótesis FALSA:** Sistema roto
- **Pivotar:** Reescribir scheduler con enfoque más simple
- **Aprendizaje:** La complejidad del sistema actual (timezone, multi-tenant, window manager) está impidiendo funcionalidad básica

---

## 🎯 EXPERIMENTO #3: Validar Problema con Usuarios Reales (Smoke Test)

**⚠️ EJECUTAR DESPUÉS de Experimento #1** (saber si es A o B)

**Hipótesis a validar:** Hipótesis #1 (Value Proposition) - variante A o B según resultado

**ICE Score:** 10/8/9 = **9.0** (ALTA PRIORIDAD)

### Objetivo

Validar que el problema existe y que las personas PAGARÍAN por una solución, ANTES de perfeccionar el producto.

### Experimento Mínimo (Smoke Test)

**DURACIÓN:** 7 días
**ESFUERZO:** 1 persona, 12 horas total
**PRESUPUESTO:** $30.000 CLP (Google Ads + Facebook Ads)

#### Build (Construir)

**Landing Page Ultra-Simple (4 horas)**

```html
<!-- Estructura básica -->
<html>
  <head>
    <title>PayMe - Nunca olvides cobrar ni pagar</title>
  </head>
  <body>
    <h1>¿Cansado de que te olviden pagar?</h1>
    <h2>PayMe te recuerda automáticamente por WhatsApp</h2>

    <p>✅ Registra préstamos a amigos/familia en 1 minuto</p>
    <p>✅ Recordatorios automáticos antes del vencimiento</p>
    <p>✅ Sin apps nuevas, todo por WhatsApp</p>

    <button>Quiero probarlo GRATIS por 30 días</button>
    <!-- Botón lleva a formulario Typeform/Google Forms -->

    <p>💳 Después de prueba: $2.990/mes</p>
  </body>
</html>
```

**Formulario de registro (Typeform/Google Forms):**
1. Nombre
2. Teléfono WhatsApp
3. "¿Cuántas veces al mes prestas plata/cosas a amigos/familia?"
4. "¿Cuál es tu mayor frustración con esto?"
5. "¿Pagarías $2.990/mes por recordatorios automáticos?" (Sí/No/Tal vez)

**CTA final:**
> "Gracias! Te contactaremos por WhatsApp cuando esté listo. Mientras tanto, ¿te gustaría probar la versión beta AHORA? (solo para primeros 20 usuarios)"

#### Measure (Medir)

**Funnel de Conversión:**

```
1000 visitas (ads)
  ↓ 5% CTR
50 clicks en botón
  ↓ 40% completan form
20 registros
  ↓ 50% dicen "Sí, pagaría"
10 dispuestos a pagar
  ↓ 70% aceptan beta
7 usuarios beta
```

**Métricas de Éxito:**

1. **Métrica Primaria:** % de visitantes que completan formulario
   - **Criterio de éxito:** ≥4% (20 de 500 visitas)
   - **Mínimo viable:** ≥2% (10 de 500 visitas)

2. **Métricas Secundarias:**
   - % que dicen "Sí, pagaría $2.990/mes" (objetivo: >40%)
   - % que acepta probar beta AHORA (objetivo: >60%)
   - Tasa de rebote en landing (<70%)

**Costos:**
- Google Ads: $0.30 USD/click x 250 clicks = $75 USD (~$20.000 CLP)
- Facebook Ads: $0.20 USD/click x 250 clicks = $50 USD (~$13.000 CLP)
- **Total:** ~$33.000 CLP para 500 visitas

**ROI esperado:**
Si conseguimos 10 usuarios beta y 5 se convierten en pagos ($2.990/mes):
- Inversión: $33.000 CLP
- Retorno mes 1: $14.950 CLP (5 usuarios x $2.990)
- Retorno mes 3: $44.850 CLP (payback en 2.2 meses)

#### Learn (Aprender)

**Posibles resultados:**

**Resultado A: ≥4% conversión + ≥40% pagaría**
- ✅ **Hipótesis VALIDADA:** Problema existe, hay willingness to pay
- **Próximo paso:**
  1. Onboardear a los 7-10 usuarios beta manualmente
  2. Validar que usan el producto (Experimento #3)
  3. Si retención > 60% al mes 1, invertir en marketing

**Resultado B: 2-4% conversión + 20-40% pagaría**
- ⚠️ **Hipótesis PARCIAL:** Problema existe pero pricing/positioning débil
- **Investigar:**
  - Entrevistar a 5 que dijeron "No pagaría", preguntar por qué
  - Testear precio más bajo ($1.490/mes)
  - Testear propuesta de valor alternativa (ej: "Evita conflictos con amigos")
- **Iterar:** Ajustar landing y repetir con $15.000 CLP más

**Resultado C: <2% conversión O <20% pagaría**
- ❌ **Hipótesis FALSA:** Problema NO es lo suficientemente doloroso
- **Pivotar:**
  - Entrevistar a 10 de los registrados para entender problema real
  - Posible pivote: Enfocarse en nicho específico (ej: solo emprendedores, solo familiares, solo montos >$50.000)
  - Considerar problema alternativo (ej: recordatorios de pagos recurrentes en vez de deudas one-time)

**Aprendizajes clave a capturar:**
- ¿Qué palabras usan para describir el problema?
- ¿Qué alternativas usan hoy? (Excel, notas, memoria, nada)
- ¿Cuál es el "dolor" específico? (olvido, vergüenza de cobrar, conflictos)

---

## 🎯 EXPERIMENTO #3: Validar Engagement con Beta Users

**Hipótesis a validar:** Hipótesis #1 (Value Proposition) - Parte 2

**ICE Score:** 10/9/6 = **8.3** (ALTA PRIORIDAD)

**PREREQUISITO:** Experimentos #1 y #2 completados con éxito

### Objetivo

Medir si los usuarios que registran préstamos REALMENTE usan el sistema semana tras semana (sticky product).

### Experimento Mínimo

**DURACIÓN:** 30 días
**ESFUERZO:** 1 desarrollador part-time (seguimiento)
**USUARIOS:** 10-20 beta users del Experimento #2

#### Build (Construir)

**NO construir nada nuevo.** Usar producto actual con onboarding manual.

**Onboarding manual (30 min por usuario):**

1. **Llamada/videollamada inicial:**
   - Explicar cómo funciona
   - Registrar primer préstamo juntos
   - Asegurar que entienden cómo confirma el borrower
   - Darles número de WhatsApp de soporte directo

2. **Seguimiento semanal:**
   - Mensaje WhatsApp: "Hola [Nombre], ¿cómo va tu experiencia con PayMe?"
   - Preguntar si tuvieron problemas
   - Anotar feedback en Notion/Spreadsheet

#### Measure (Medir)

**Métricas Pirate (AARRR):**

**1. Activation (Activación):**
- **Definición:** Usuario creó ≥1 préstamo en primeros 7 días
- **Criterio:** ≥80% de beta users (8 de 10)

**2. Engagement (Uso):**
- **Definición:** Usuario creó ≥1 préstamo en semanas 2, 3 o 4
- **Criterio:** ≥60% de activados (5 de 8)

**3. Retention (Retención):**
- **Definición:** Usuario sigue activo al día 30 (creó préstamo en últimos 14 días)
- **Criterio:** ≥50% de activados (4 de 8)

**4. Frecuencia de Uso:**
- **Definición:** Promedio de préstamos creados por usuario/semana
- **Criterio:** ≥1.5 préstamos/semana (señal de que el problema es recurrente)

**5. Satisfacción (NPS):**
- **Pregunta al día 30:** "Del 0 al 10, ¿qué tan probable es que recomiendes PayMe a un amigo?"
- **Criterio:** NPS > 30 (% promotores - % detractores)

**Query de medición:**
```sql
-- Activación
SELECT
  COUNT(DISTINCT contact_id) as activated_users
FROM agreements
WHERE created_at BETWEEN '[BETA_START]' AND '[BETA_START + 7 days]';

-- Engagement semana 2-4
SELECT
  COUNT(DISTINCT contact_id) as engaged_users
FROM agreements
WHERE created_at BETWEEN '[BETA_START + 7 days]' AND '[BETA_START + 30 days]';

-- Retención día 30
SELECT
  COUNT(DISTINCT contact_id) as retained_users
FROM agreements
WHERE contact_id IN (SELECT DISTINCT contact_id FROM agreements WHERE created_at <= '[BETA_START + 7 days]')
  AND created_at BETWEEN '[BETA_START + 16 days]' AND '[BETA_START + 30 days]';

-- Frecuencia
SELECT
  contact_id,
  COUNT(*) as total_loans,
  ROUND(COUNT(*) / 4.0, 2) as loans_per_week
FROM agreements
WHERE created_at BETWEEN '[BETA_START]' AND '[BETA_START + 30 days]'
GROUP BY contact_id
ORDER BY loans_per_week DESC;
```

#### Learn (Aprender)

**Posibles resultados:**

**Resultado A: Retención ≥50% + NPS >30**
- ✅ **Product-Market Fit alcanzado (early signal)**
- **Próximo paso:**
  1. Escalar adquisición (invertir $100.000 CLP/mes en ads)
  2. Implementar self-serve onboarding (tutorial en WhatsApp)
  3. Iniciar cobro después de 30 días gratis
  4. Objetivo: 100 usuarios pagos en 3 meses

**Resultado B: Retención 30-50% + NPS 0-30**
- ⚠️ **Hipótesis PARCIAL:** Producto funciona pero necesita mejoras
- **Investigar:** Entrevistas de churn
  - ¿Por qué dejaron de usar?
  - ¿Qué feature faltante los haría volver?
  - ¿El problema era menos frecuente de lo esperado?
- **Iterar:** Implementar top 3 features solicitados
- **Repetir experimento** con mejoras en 30 días más

**Resultado C: Retención <30% O NPS <0**
- ❌ **Hipótesis FALSA:** Problema no es lo suficientemente doloroso o solución no encaja
- **Aprendizajes de churn:**
  - "No presto plata tan seguido como pensaba" → Frecuencia del problema sobreestimada
  - "Me da vergüenza que le llegue recordatorio a mi amigo" → Barrera social
  - "Prefiero recordarlos yo manualmente" → Solución actual (memoria) suficiente
- **Decisión de pivotar:**
  - Opción A: Pivotar a nicho específico (solo emprendedores/pymes)
  - Opción B: Pivotar a problema relacionado (recordatorios recurrentes tipo suscripciones)
  - Opción C: Abandonar y validar idea completamente nueva

**Entrevistas de salida (exit interviews):**
Fundamental hablar con 100% de churned users:
- "Veo que dejaste de usar PayMe, ¿puedo preguntarte por qué?"
- "¿Qué hubiera tenido que pasar para que siguieras usándolo?"
- "¿Hay algún otro problema con préstamos que te frustra más?"

---

## 🎯 EXPERIMENTO #4: Validar Confirmación Bidireccional

**Hipótesis a validar:** Hipótesis #3 (Confirmación reduce conflictos)

**ICE Score:** 7/8/8 = **7.7** (MEDIA-ALTA PRIORIDAD)

**PREREQUISITO:** Experimento #3 en curso (necesita usuarios activos)

### Objetivo

Medir si pedir confirmación al borrower es realmente necesario o añade fricción innecesaria.

### Experimento Mínimo (A/B Test)

**DURACIÓN:** 14 días
**ESFUERZO:** 1 desarrollador, 6 horas
**USUARIOS:** 20 beta users (10 grupo A, 10 grupo B)

#### Build (Construir)

**Variante A (Control): CON confirmación** (producto actual)
- Lender crea préstamo → Borrower recibe template pidiendo confirmación
- Recordatorios solo se activan si borrower confirma
- Si rechaza, lender recibe notificación

**Variante B (Test): SIN confirmación**
- Lender crea préstamo → Borrower recibe notificación informativa
- Recordatorios se activan automáticamente (sin esperar confirmación)
- Borrower puede cancelar desde botón en mensaje

**Implementación:**
```typescript
// En agreement creation
const requiresConfirmation = user.experimentGroup === 'A'; // 50/50 split

if (requiresConfirmation) {
  // Flujo actual (con confirmación)
  await sendConfirmationRequest(borrower);
  agreement.status = 'pending_confirmation';
} else {
  // Flujo nuevo (sin confirmación)
  await sendLoanNotification(borrower); // solo informativo
  agreement.status = 'active';
  await activateReminders(agreement);
}
```

#### Measure (Medir)

**Métricas de Comparación:**

| Métrica | Grupo A (Con Confirm) | Grupo B (Sin Confirm) | Diff Esperada |
|---------|----------------------|----------------------|---------------|
| **Tasa de activación** | % que confirman | 100% (auto-activa) | B >> A |
| **Tiempo hasta activo** | Mediana horas | 0 horas | B < A |
| **Tasa de cancelación** | % que rechazan | % que cancelan después | B ≈ A |
| **Conflictos reportados** | # quejas | # quejas | A < B (hipótesis) |
| **NPS del borrower** | Score 0-10 | Score 0-10 | A > B (hipótesis) |

**Criterio de éxito para MANTENER confirmación:**
- Tasa de rechazo grupo A < 10% (confirmación útil para detectar errores)
- NPS borrowers grupo A ≥ 5 puntos mayor que B
- Quejas grupo B ≥ 2x grupo A

**Criterio de éxito para ELIMINAR confirmación:**
- Tasa de rechazo grupo A < 5% (casi nadie la usa)
- NPS borrowers A y B similar (±2 puntos)
- Quejas similares en ambos grupos

#### Learn (Aprender)

**Resultado esperado (hipótesis):**
- Confirmación es útil pero añade fricción
- Tasa de rechazo ~5-10%
- Borrowers prefieren confirmación (mayor NPS)
- **Decisión:** MANTENER confirmación

**Resultado alternativo (posible):**
- Tasa de rechazo <5%
- NPS similar en ambos grupos
- Sin diferencia en quejas
- **Decisión:** ELIMINAR confirmación, reduce fricción innecesariamente

**Pivote potencial:**
Si tasa de rechazo >15%, investigar por qué:
- ¿Lenders crean préstamos incorrectos?
- ¿Borrowers no entienden el sistema?
- ¿Hay uso malicioso (spam)?

---

## 🎯 EXPERIMENTO #5: Validar Willingness to Pay (Pre-monetización)

**Hipótesis a validar:** "Usuarios pagarían $2.990/mes después del trial gratuito"

**ICE Score:** 9/6/7 = **7.3** (MEDIA PRIORIDAD)

**PREREQUISITO:** Experimento #3 completado con retención >50%

### Objetivo

Medir cuántos usuarios de beta REALMENTE pagarían al finalizar trial de 30 días.

### Experimento Mínimo

**DURACIÓN:** 45 días (30 trial + 15 cobro)
**ESFUERZO:** 1 persona, 8 horas total

#### Build (Construir)

**NO implementar pasarela de pago aún.** Validar con método manual.

**Comunicación a usuarios beta:**

**Día 1 (inicio trial):**
```
¡Bienvenido a PayMe Beta! 🎉

Tienes 30 días GRATIS para probar todas las funciones.

Después del trial:
💳 $2.990/mes (sin contrato)
✅ Recordatorios ilimitados
✅ Soporte prioritario

¿Preguntas? Escríbeme acá 👋
```

**Día 23 (7 días antes de vencer trial):**
```
Hola [Nombre]! 👋

Tu trial de PayMe vence en 7 días (01/12).

Para seguir usando PayMe después:
💳 Transferencia mensual: $2.990
📊 Banco Santander, Cuenta Corriente 123456789

¿Quieres continuar? Responde SÍ y te envío los datos 📩
```

**Día 30 (vencimiento trial):**
```
[Si NO pagó]
Hola [Nombre], tu trial ha finalizado 😢

Tus datos están guardados por 90 días.

¿Cambió algo? ¿Precio muy alto? ¿Algo no funcionó?
Me encantaría saber tu feedback 🙏

[Si SÍ pagó]
¡Gracias por confiar en PayMe! 🎉
Ya verificamos tu pago. Sigues activo ✅
```

#### Measure (Medir)

**Funnel de Conversión Trial → Pago:**

```
10 beta users (trial 30 días)
  ↓
8 activos al día 30 (retención 80%)
  ↓
? dicen "SÍ quiero continuar"
  ↓
? hacen transferencia efectiva
```

**Métricas de Éxito:**

1. **Métrica Primaria:** % de usuarios activos que PAGAN
   - **Criterio de éxito:** ≥40% (4 de 10)
   - **Benchmark SaaS B2C:** 30-50% trial-to-paid

2. **Métricas Secundarias:**
   - % que dicen "Sí" pero no pagan (intención vs acción)
   - Tiempo promedio entre "Sí" y pago efectivo
   - % que pide descuento o plan más barato

**Cálculo de Viabilidad:**

Si ≥40% paga:
- 10 usuarios → 4 pagan → $11.960 MRR
- CAC (del Experimento #2): $3.300/usuario (ads + tiempo onboarding)
- LTV (si retención 50% mensual): $2.990 / 0.5 = ~$6.000
- **Ratio LTV:CAC = 1.8 (MALO, necesita optimización)**

Necesitamos:
- Reducir CAC (self-serve onboarding)
- O aumentar precio/retención
- O lograr viral growth (referrals)

#### Learn (Aprender)

**Resultado A: ≥40% paga**
- ✅ **Willingness to pay VALIDADA**
- **Próximo paso:**
  1. Implementar pasarela de pago (Stripe/Flow)
  2. Plan de crecimiento para llegar a 100 usuarios pagos
  3. Optimizar CAC (reducir costo onboarding)

**Resultado B: 20-40% paga**
- ⚠️ **Willingness to pay PARCIAL**
- **Investigar:** Entrevistas a los que NO pagaron
  - "¿Precio muy alto?" → Testear $1.490/mes
  - "¿No lo uso tanto?" → Problema de frecuencia, no de precio
  - "¿Puedo pagar cuando lo necesite?" → Modelo pay-per-use
- **Iterar:** Testear pricing alternativo

**Resultado C: <20% paga**
- ❌ **Willingness to pay FALSA**
- **Aprendizajes:**
  - Problema no es lo suficientemente valioso para pagar
  - O pricing muy alto para el valor percibido
  - O existe alternativa gratuita suficientemente buena
- **Decisión:**
  - Opción A: Pivote a freemium (gratis para uso básico, pago para premium)
  - Opción B: Pivote a B2B (vender a empresas, no personas)
  - Opción C: Abandonar monetización, buscar modelo alternativo (ads, comisiones)

**Entrevistas clave:**
Hablar con 100% de los que NO pagaron:
- "Veo que no continuaste con PayMe después del trial. ¿Puedo preguntarte por qué?"
- "¿El precio es un problema? ¿Cuánto estarías dispuesto a pagar?"
- "¿O es que el producto no resolvió tu problema como esperabas?"

---

## 6. MÉTRICAS Y MEDICIÓN

### Framework: Pirate Metrics (AARRR)

**Adaptado a PayMe Etapa 1:**

```
┌────────────────────────────────────────────────────────────┐
│                   PIRATE METRICS - PAYME                   │
└────────────────────────────────────────────────────────────┘

1. ACQUISITION (Adquisición)
   ├── Visitantes landing page
   ├── Registros (formulario)
   └── Primeros mensajes WhatsApp
   │
   ▼ Métrica: CAC (Costo de Adquisición por Cliente)

2. ACTIVATION (Activación)
   ├── Usuario crea PRIMER préstamo
   ├── Borrower confirma préstamo
   └── Primer recordatorio enviado
   │
   ▼ Métrica: % de registros que crean ≥1 préstamo en 7 días

3. RETENTION (Retención)
   ├── Día 7: Usuario crea 2do préstamo
   ├── Día 14: Usuario sigue activo
   ├── Día 30: Usuario crea préstamo en últimos 14 días
   └── Mes 2-3: Usuario continúa activo
   │
   ▼ Métricas: Retention cohorts (D7, D14, D30, M1, M2, M3)

4. REFERRAL (Referencias)
   ├── Usuario invita a amigo/familiar
   ├── Viral loop: Borrower se convierte en Lender
   └── Compartidos en redes sociales
   │
   ▼ Métrica: K-factor (viralidad)

5. REVENUE (Ingresos)
   ├── Trial → Paid conversión
   ├── Churn rate
   └── MRR (Monthly Recurring Revenue)
   │
   ▼ Métricas: MRR, ARPU, LTV, Churn Rate
```

---

### Métricas por Fase del Producto

#### FASE ACTUAL: Validación de Problema (Experimentos #1-3)

**Métricas Críticas (medir semanalmente):**

| Métrica | Fórmula | Target | Actual | Herramienta |
|---------|---------|--------|--------|-------------|
| **Recordatorios enviados** | `COUNT(reminder_instances WHERE status='sent')` | 100% de programados | ❓ | Query SQL |
| **Activation rate** | `Users con ≥1 préstamo / Total registros` | ≥70% | ❓ | Query SQL |
| **D7 Retention** | `Users activos día 7 / Users activados` | ≥60% | ❓ | Query SQL |
| **D30 Retention** | `Users activos día 30 / Users activados` | ≥40% | ❓ | Query SQL |
| **Préstamos/usuario/semana** | `AVG(loans per user per week)` | ≥1.5 | ❓ | Query SQL |
| **NPS** | `% Promoters - % Detractors` | ≥30 | ❓ | Survey |

**Queries de Medición:**

```sql
-- Dashboard de métricas (ejecutar semanalmente)

-- 1. Recordatorios enviados vs programados
SELECT
  COUNT(*) FILTER (WHERE status = 'sent') as sent,
  COUNT(*) FILTER (WHERE status = 'pending' AND scheduled_for < NOW()) as overdue,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'sent') / COUNT(*), 2) as sent_rate
FROM reminder_instances
WHERE created_at >= NOW() - INTERVAL '7 days';

-- 2. Activation rate (últimos 30 días)
WITH registrations AS (
  SELECT DISTINCT contact_id, MIN(created_at) as registered_at
  FROM conversation_history
  GROUP BY contact_id
  HAVING MIN(created_at) >= NOW() - INTERVAL '30 days'
),
activations AS (
  SELECT DISTINCT lender_contact_id as contact_id
  FROM agreements
  WHERE created_at >= NOW() - INTERVAL '30 days'
)
SELECT
  COUNT(DISTINCT r.contact_id) as total_registered,
  COUNT(DISTINCT a.contact_id) as activated,
  ROUND(100.0 * COUNT(DISTINCT a.contact_id) / COUNT(DISTINCT r.contact_id), 2) as activation_rate
FROM registrations r
LEFT JOIN activations a ON r.contact_id = a.contact_id;

-- 3. Retention cohorts
WITH cohorts AS (
  SELECT
    contact_id,
    MIN(DATE_TRUNC('week', created_at)) as cohort_week
  FROM agreements
  GROUP BY contact_id
)
SELECT
  cohort_week,
  COUNT(DISTINCT c.contact_id) as cohort_size,
  COUNT(DISTINCT CASE WHEN a.created_at BETWEEN c.cohort_week + INTERVAL '7 days' AND c.cohort_week + INTERVAL '14 days' THEN a.lender_contact_id END) as d7_retained,
  COUNT(DISTINCT CASE WHEN a.created_at BETWEEN c.cohort_week + INTERVAL '30 days' AND c.cohort_week + INTERVAL '37 days' THEN a.lender_contact_id END) as d30_retained
FROM cohorts c
LEFT JOIN agreements a ON c.contact_id = a.lender_contact_id
GROUP BY cohort_week
ORDER BY cohort_week DESC;

-- 4. Frecuencia de uso
SELECT
  lender_contact_id,
  COUNT(*) as total_loans,
  MIN(created_at) as first_loan,
  MAX(created_at) as last_loan,
  EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) / 604800 as weeks_active,
  ROUND(COUNT(*) / GREATEST(EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) / 604800, 1), 2) as loans_per_week
FROM agreements
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY lender_contact_id
HAVING COUNT(*) >= 2
ORDER BY loans_per_week DESC;
```

---

#### FASE SIGUIENTE: Crecimiento (Post Product-Market Fit)

**Métricas adicionales:**

| Métrica | Fórmula | Target | Herramienta |
|---------|---------|--------|-------------|
| **CAC** | `Marketing spend / New users` | <$5.000 CLP | Google Analytics |
| **LTV** | `ARPU / Churn rate` | >$15.000 CLP | SQL + Excel |
| **LTV:CAC Ratio** | `LTV / CAC` | ≥3.0 | Calculado |
| **Payback period** | `CAC / ARPU` | <6 meses | Calculado |
| **K-factor** | `Invites sent x Conversion rate` | ≥1.0 (viral) | SQL |
| **Churn rate mensual** | `Users lost / Total users` | <10% | SQL |

---

### Dashboard de Métricas (propuesta)

**Herramienta recomendada:** Metabase (open-source) + PostgreSQL

**Queries a automatizar:**

1. **Overview semanal:**
   - Nuevos registros (7 días)
   - Activation rate
   - Préstamos creados
   - Recordatorios enviados
   - Usuarios activos

2. **Retention cohorts:**
   - Tabla de cohortes semanales
   - Gráfico de retención D1, D7, D14, D30

3. **Engagement:**
   - Distribución de préstamos por usuario
   - Power users (top 10%)
   - Usuarios en riesgo de churn (sin actividad >14 días)

4. **Funnel de conversión:**
   - Registro → Primer préstamo → Confirmación → Recordatorio enviado

5. **Health score:**
   - % recordatorios enviados exitosamente
   - % borrowers que confirman
   - Tiempo promedio de confirmación
   - Tasa de error en WhatsApp API

---

## 7. ROADMAP DE VALIDACIÓN

### Próximos 90 Días (Enfoque: Validar Core Value)

```
┌─────────────────────────────────────────────────────────────┐
│                    ROADMAP LEAN STARTUP                     │
│                      PAYME - Q4 2025                        │
└─────────────────────────────────────────────────────────────┘

SEMANA 1-2: Fix Crítico + Smoke Test
├── Día 1-3: Experimento #1 (Fix recordatorios) [CRÍTICO]
├── Día 4-5: Setup landing page + ads
├── Día 6-14: Experimento #2 (Smoke test) en paralelo
└── Entregable: 10 beta users listos para onboarding

SEMANA 3-6: Validación con Beta Users
├── Día 15: Onboarding manual de 10 beta users
├── Día 15-45: Experimento #3 (Engagement) + seguimiento semanal
├── Día 30: Primera medición de retención D14
├── Día 45: Medición final de retención D30 + NPS
└── Entregable: Reporte de retention + decision point

SEMANA 7-8: Análisis y Decisión
├── Día 46-50: Análisis de resultados Exp #3
├── Día 51-52: Entrevistas de churn (si aplica)
├── Día 53-56: Decisión: ESCALAR / ITERAR / PIVOTAR
└── Entregable: Plan de acción para siguientes 90 días

CONDICIONAL - Si Retention ≥50% y NPS >30:
├── SEMANA 9-10: Implementar self-serve onboarding
├── SEMANA 11-12: Escalar ads ($100k/mes), objetivo 50 users
└── SEMANA 13: Experimento #5 (Willingness to pay)
```

---

### Criterios de Go/No-Go

**DECISION POINT 1: Día 3 (Post Experimento #1)**

```
SI recordatorios funcionan (≥95% enviados):
  ✅ Continuar con Experimento #2 (smoke test)

SI recordatorios fallan (50-95% enviados):
  ⚠️ Iterar fix 3 días más
  ⚠️ Si persiste, evaluar reescritura del scheduler

SI recordatorios fallan completamente (<50%):
  ❌ PAUSAR experimentos de mercado
  ❌ Dedicar 2 semanas a reescribir sistema de recordatorios
  ❌ No tiene sentido validar mercado con producto roto
```

**DECISION POINT 2: Día 14 (Post Experimento #2)**

```
SI conversión ≥4% y ≥40% pagaría:
  ✅ Onboardear beta users y proceder con Experimento #3

SI conversión 2-4% O 20-40% pagaría:
  ⚠️ Iterar landing/pricing
  ⚠️ Invertir $15k más en ads mejorados
  ⚠️ Entrevistar a 5 no-converters

SI conversión <2% O <20% pagaría:
  ❌ PAUSAR desarrollo
  ❌ Realizar 10 entrevistas de problema
  ❌ Considerar pivote o abandono
```

**DECISION POINT 3: Día 45 (Post Experimento #3)**

```
SI retention ≥50% y NPS >30:
  ✅ PRODUCT-MARKET FIT alcanzado (early signal)
  ✅ Proceder a escalar adquisición
  ✅ Implementar monetización (Exp #5)
  ✅ Roadmap: Etapa 2 (recurrencia + reportería)

SI retention 30-50% O NPS 0-30:
  ⚠️ Realizar mejoras basadas en feedback
  ⚠️ Repetir Experimento #3 con 10 nuevos usuarios
  ⚠️ Timeline: +30 días de iteración

SI retention <30% O NPS <0:
  ❌ PIVOTAR o ABANDONAR
  ❌ Realizar entrevistas de churn (100% de churned)
  ❌ Evaluar pivotes:
      - Nicho específico (solo emprendedores)
      - Problema relacionado (recordatorios recurrentes)
      - B2B en vez de B2C
```

---

### Anti-Roadmap (Qué NO hacer en próximos 90 días)

**PROHIBIDO desarrollar hasta validar PMF:**

- ❌ Sistema de reportería avanzado
- ❌ Más features de IA (mejoras al agente)
- ❌ Dashboard analytics del frontend
- ❌ Integraciones con otros servicios
- ❌ App móvil nativa
- ❌ Sistema de referidos automatizado
- ❌ Gamificación / badges
- ❌ Soporte multi-idioma
- ❌ Mejoras cosméticas de UI
- ❌ Optimizaciones de performance prematuras

**Regla de oro:**
> "Si no valida una de las 6 hipótesis críticas, NO se construye en los próximos 90 días."

---

## 8. RIESGOS Y SUPUESTOS NO VALIDADOS

### Mapa de Riesgos

```
┌─────────────────────────────────────────────────────────────┐
│              MATRIZ IMPACTO x PROBABILIDAD                  │
└─────────────────────────────────────────────────────────────┘

ALTO IMPACTO
│
│  🔴 R1: Recordatorios       🔴 R2: Problema no es
│      no funcionan                doloroso suficiente
│      (Prob: ALTA)               (Prob: MEDIA)
│
│                              🟡 R4: WhatsApp policies
│  🟡 R5: Costos OpenAI            cambian
│      insostenibles              (Prob: BAJA)
│      (Prob: MEDIA)
│
│                              🟢 R6: Competencia
│                                  (Prob: BAJA)
│
BAJO IMPACTO
    ├────────────────────────────────────────────────┤
    BAJA PROB              ALTA PROB
```

---

### Riesgo #1: Recordatorios NO funcionan [🔴 CRÍTICO]

**Descripción:**
El sistema de recordatorios automáticos está roto y no envía mensajes en las fechas programadas.

**Evidencia:**
- Documentación indica: "NO llama a `generate_reminder_instances()`"
- 31 `reminder_instances` en BD pero sin evidencia de envíos masivos
- Scheduler existe pero no está validado end-to-end

**Impacto si se confirma:**
- 🔥 El core value NO existe
- Pérdida total de confianza de usuarios
- Producto inútil

**Probabilidad:** ALTA (70%)

**Mitigación:**
- ✅ Experimento #1 (día 1-3) lo valida INMEDIATAMENTE
- Si falla, dedicar 100% del equipo a arreglarlo
- No continuar con experimentos de mercado hasta que funcione

---

### Riesgo #2: Problema NO es doloroso suficiente [🔴 CRÍTICO]

**Descripción:**
Asunción: "Las personas tienen un problema real con olvidar cobrar/pagar deudas informales."

Realidad posible: El problema es infrecuente, de baja prioridad, o tienen soluciones suficientemente buenas (Excel, memoria, WhatsApp manual).

**Evidencia faltante:**
- Cero usuarios orgánicos
- No hay entrevistas de problema
- No se ha validado frecuencia del problema

**Impacto si se confirma:**
- 🔥 Mercado no existe o es muy pequeño
- Imposible monetizar
- Producto muere

**Probabilidad:** MEDIA (40%)

**Mitigación:**
- ✅ Experimento #2 (smoke test) lo valida en día 7-14
- ✅ Experimento #3 (engagement) mide frecuencia real de uso
- Si frecuencia <1 préstamo/mes por usuario, mercado muy pequeño
- Plan B: Pivotar a nicho más específico (emprendedores, pymes)

---

### Riesgo #3: WhatsApp Window 24h es Show-Stopper [🟡 ALTO IMPACTO]

**Descripción:**
WhatsApp Business API solo permite enviar mensajes gratuitos dentro de 24 horas de la última interacción del usuario. Después, se requieren templates HSM aprobados por Meta (proceso lento, restrictivo).

**Impacto:**
- No se pueden enviar recordatorios espontáneos si usuario no ha hablado en >24h
- Templates HSM tienen limitaciones (botones, formato)
- Dependencia de aprobaciones de Meta (pueden rechazar templates)

**Probabilidad:** MEDIA (50% que cause problemas significativos)

**Mitigación actual:**
- ✅ Sistema de templates HSM ya implementado
- ✅ WhatsAppWindowManager maneja lógica de ventana 24h
- ✅ Message queue para diferir envíos fuera de ventana

**Mitigación adicional:**
- Crear templates genéricos que sirvan para múltiples escenarios
- Tener 2-3 templates de respaldo pre-aprobados
- Monitorear tasa de rechazo de templates
- Plan B: Migrar a canal alternativo si WhatsApp se vuelve inviable (Telegram, SMS)

---

### Riesgo #4: Costos de OpenAI Insostenibles [🟡 MEDIO IMPACTO]

**Descripción:**
El sistema usa GPT-4/5-nano, Whisper, y Vision. Costos pueden escalar rápidamente con más usuarios.

**Costos estimados actuales:**
- GPT-5-nano: ~$0.10 USD / 1M tokens input, $0.40 / 1M output
- Whisper: ~$0.006 / minuto de audio
- GPT-4 Vision: ~$0.01 / imagen

**Escenario pesimista:**
100 usuarios activos x 10 interacciones/día x 30 días = 30.000 interacciones/mes
- 50% texto (GPT-5): 15k x 1k tokens x $0.10 = ~$1.50 USD
- 30% audio (Whisper): 9k x 30 seg x $0.006/60 = ~$27 USD
- 20% imágenes (Vision): 6k x $0.01 = ~$60 USD
- **Total: ~$88 USD/mes (~$73.000 CLP)**

Con 100 usuarios pagando $2.990/mes:
- Ingresos: $299.000 CLP
- Costos IA: $73.000 CLP
- **Margen bruto: 76%** (ACEPTABLE)

**Probabilidad de problema:** MEDIA (30%)

**Mitigación:**
- ✅ Usar GPT-5-nano (más barato que GPT-4)
- ✅ Caché de respuestas frecuentes ya implementado
- ⚠️ Considerar deprecar Vision (no es core value)
- ⚠️ Considerar deprecar Whisper, usar solo texto
- ⚠️ Implementar rate limiting más agresivo

**Plan B si costos >40% de ingresos:**
- Eliminar IA para usuarios freemium
- IA solo para plan premium ($4.990/mes)
- Migrar a modelo más barato (GPT-3.5-turbo)

---

### Riesgo #5: Barrera Social (Vergüenza de Cobrar) [🟡 MEDIO IMPACTO]

**Descripción:**
Asunción implícita: "Los usuarios QUIEREN que se envíen recordatorios automáticos a sus amigos/familia."

Realidad posible: Enviar recordatorios automáticos puede percibirse como "frío", "insensible", o "tacaño". Las personas pueden preferir recordar manualmente para mantener el control del tono y timing.

**Evidencia de este problema en otros productos:**
- Apps de "split bills" tienen baja adopción para uso entre amigos cercanos
- Las personas prefieren WhatsApp manual para mantener calidez

**Impacto si se confirma:**
- 🟡 Usuarios crean préstamos pero desactivan recordatorios
- Tasa de opt-out alta
- NPS bajo entre borrowers

**Probabilidad:** MEDIA (35%)

**Señales de alerta:**
- Tasa de desactivación de recordatorios >20%
- NPS borrowers <0
- Feedback: "prefiero recordarle yo personalmente"

**Mitigación:**
- ✅ Sistema de confirmación bidireccional (reduce sorpresa)
- ⚠️ Personalizar tono de recordatorios (amigable, no demandante)
- ⚠️ Dar control al lender: "¿Quieres que le recuerde automáticamente?"
- ⚠️ Permitir editar mensaje de recordatorio antes de enviar

**Experimento de validación:**
- Medir % de usuarios que DESACTIVAN recordatorios después de crear préstamo
- Si >15%, implementar más controles de personalización
- Entrevistas: "¿Te sentiste cómodo con el recordatorio automático?"

---

### Riesgo #6: Competencia (Fintech/Apps de Préstamos) [🟢 BAJO IMPACTO]

**Descripción:**
Existen apps de fintech, bancos digitales, y plataformas de préstamos P2P que podrían lanzar feature similar.

**Competidores potenciales:**
- Mach, Tenpo, Mercado Pago (Chile)
- Apps de "split bills" (Splitwise, Settle Up)
- Bancos tradicionales con apps

**Ventaja competitiva de PayMe:**
- ✅ Especialización en préstamos informales (no P2P formal)
- ✅ No requiere app nueva (WhatsApp)
- ✅ Simplicidad extrema (3 pasos)

**Probabilidad de competencia seria:** BAJA (20%)

**Razón:** Mercado muy nicho, bajos márgenes para fintechs grandes.

**Mitigación:**
- Ejecutar rápido (first-mover advantage)
- Construir moat con network effects (viral loop)
- Enfocarse en UX superior y simplicidad

---

### Supuestos No Validados (Backlog)

**Lista de supuestos que NO están en hipótesis críticas pero deberían monitorearse:**

| Supuesto | Riesgo si es falso | Cómo validar |
|----------|-------------------|--------------|
| "Usuarios tienen contactos en su agenda" | Fricción alta si deben agregar manualmente | Medir % de préstamos a contactos nuevos vs existentes |
| "Borrowers responden en WhatsApp" | Recordatorios no llegan a destinatario | Medir tasa de lectura de mensajes (read receipts) |
| "Usuarios entienden el flujo sin tutorial" | Abandono alto en onboarding | Medir tasa de abandono por paso del flujo |
| "Fechas naturales funcionan (mañana, fin de mes)" | Errores de interpretación | Medir % de reprogramaciones por error de fecha |
| "Usuarios quieren confirmar devolución" | Feature innecesario | Medir tasa de uso de botón "Ya me devolvió" |
| "Sistema multi-tenant no tiene bugs de permisos" | Leak de datos entre tenants | Auditoría de seguridad + penetration testing |

---

## CONCLUSIONES Y RECOMENDACIONES FINALES

### Diagnóstico

**presta_bot es un MVP técnicamente impresionante pero con validación de mercado CERO.**

El equipo ha construido:
- ✅ Infraestructura de calidad enterprise (multi-tenant, RLS, AI avanzado)
- ✅ Features sofisticadas (text-to-SQL, búsqueda fonética, WhatsApp Flows)
- ❌ Sin evidencia de que resuelve un problema real para usuarios reales
- ❌ Core value (recordatorios) posiblemente roto
- ❌ Cero tracción orgánica

**Esto es un caso clásico de "build trap"**: optimizar el producto sin validar el mercado.

---

### Recomendaciones Urgentes (Próximas 2 Semanas)

**🔴 CRÍTICO #1: Fix de Recordatorios (Día 1-3)**

No tiene sentido ningún otro experimento si los recordatorios no funcionan.

**Acción:**
1. Asignar 1 desarrollador full-time
2. Completar Experimento #1
3. No avanzar a marketing hasta confirmar que funciona al 95%

**🔴 CRÍTICO #2: Smoke Test de Mercado (Día 4-14)**

Validar demanda ANTES de pulir el producto.

**Acción:**
1. Crear landing page ultra-simple (4 horas)
2. Invertir $33.000 CLP en ads
3. Objetivo: 10-20 registros dispuestos a probar beta

**🔴 CRÍTICO #3: Pausar Nuevas Features**

Congelar desarrollo de todo lo que NO valide hipótesis críticas.

**Acción:**
1. Mover IA, WhatsApp Flows, Telegram a backlog
2. Enfoque 100% en validación de mercado (Experimentos #1-3)
3. Revisión semanal de métricas de experimentos

---

### Recomendaciones Estratégicas (90 Días)

**1. Adoptar mentalidad de "validación rápida sobre perfección"**

El producto actual tiene calidad de Etapa 3 (B2B enterprise) pero está en Etapa 0 (pre-PMF).

**Cambio cultural necesario:**
- ❌ "¿Cómo hacemos esto escalable para 1M de usuarios?"
- ✅ "¿Cómo validamos esto con 10 usuarios en 7 días?"

**2. Medir religiosamente**

Implementar dashboard de métricas (Metabase) con queries automatizados.

**Revisión semanal de:**
- Recordatorios enviados/programados (health check)
- Activation, Retention D7/D30
- Feedback cualitativo de beta users

**3. Hablar con usuarios todas las semanas**

El código no miente, pero los usuarios te dicen POR QUÉ.

**Acción:**
- Onboarding manual de beta users (call 1-on-1)
- Seguimiento semanal vía WhatsApp
- Exit interviews con 100% de churned users

**4. Tomar decisiones basadas en datos, no intuición**

Definir criterios de go/no-go ANTES de cada experimento.

**Ejemplo:**
- "Si retention D30 <30%, pivotamos o abandonamos"
- "Si <2% conversión en smoke test, pausamos y re-entrevistamos"

**5. Estar preparados para pivotar**

Lean Startup no es solo "iterar rápido", es también "pivotar cuando los datos lo dicen".

**Posibles pivotes si validación falla:**
- Nicho específico (solo emprendedores/pymes)
- Problema relacionado (recordatorios recurrentes tipo suscripciones)
- Canal diferente (email en vez de WhatsApp)
- Modelo B2B (vender a empresas de cobranza)

---

### Visión de Éxito (12 Meses)

**Si ejecutamos este plan correctamente, en 12 meses deberíamos tener:**

```
MES 1-3: VALIDACIÓN
├── Recordatorios funcionan al 99%
├── 50 beta users activos
├── Retention D30 ≥50%
├── NPS >30
└── Product-Market Fit confirmado

MES 4-6: CRECIMIENTO TEMPRANO
├── 200 usuarios activos (100 pagos)
├── MRR: $299.000 CLP
├── CAC optimizado <$3.000/usuario
├── Viral loop funcionando (K-factor >0.5)
└── Self-serve onboarding implementado

MES 7-9: MONETIZACIÓN
├── 500 usuarios activos (300 pagos)
├── MRR: $897.000 CLP
├── Churn rate <10%/mes
├── LTV:CAC ratio ≥3.0
└── Etapa 2 iniciada (recurrencia + reportería)

MES 10-12: ESCALAMIENTO
├── 1000 usuarios activos (600 pagos)
├── MRR: $1.794.000 CLP (~$2.200 USD)
├── Breakeven alcanzado
├── Primeros pilotos B2B (Etapa 3)
└── Ronda de inversión seed preparada
```

**Métricas de éxito para considerar inversión:**
- MRR >$1.5M CLP creciendo 20%/mes
- Churn <10%
- LTV:CAC >3.0
- NPS >40
- Payback period <6 meses

---

### Última Reflexión

PayMe tiene potencial, pero está en **riesgo crítico de fallar por over-engineering sin validación**.

El equipo ha demostrado capacidad técnica excepcional. Ahora necesita **disciplina lean** para no desperdiciar ese talento construyendo lo incorrecto.

**La pregunta más importante NO es:**
- "¿Cómo hacemos que la IA sea más inteligente?"
- "¿Cómo soportamos 100k usuarios?"

**La pregunta más importante ES:**
- "¿Hay 10 personas dispuestas a pagar $2.990/mes por esto?"

Si la respuesta es NO, todo lo demás es irrelevante.

---

**Próximo paso:** Ejecutar Experimento #1 (Fix recordatorios) MAÑANA.

**Fecha límite decisión crítica:** 14 días (post Experimento #2)

**Build-Measure-Learn. Repeat. 🔄**
