# Integración de IA al Bot de WhatsApp

## Descripción General

El bot de WhatsApp ahora cuenta con un agente de IA potenciado por OpenAI con **control robusto de permisos y auditoría completa** que puede:

- 🗣️ **Procesar texto**: Interpretar mensajes en lenguaje natural y detectar intenciones
- 🎤 **Transcribir audio**: Convertir mensajes de voz a texto usando Whisper
- 📷 **Analizar imágenes**: Entender comprobantes, transferencias y fotos usando GPT-4 Vision
- 🧠 **Memoria conversacional**: Mantener contexto completo de conversaciones
- 🎯 **Búsqueda inteligente**: Encontrar contactos aunque se escriban nombres aproximados
- 🔐 **Sistema de permisos**: Control granular de qué acciones puede ejecutar la IA
- 📊 **Auditoría completa**: Registro detallado de todas las acciones ejecutadas
- ⚡ **Rate limiting**: Prevención de abuso con límites por usuario

## Arquitectura

```
Usuario WhatsApp
      ↓
wa_webhook (recibe mensaje)
      ↓
¿Tipo de mensaje?
      ├─ TEXT → ai-agent (GPT-4)
      ├─ AUDIO → Whisper → ai-agent
      ├─ IMAGE → GPT-4 Vision → ai-agent
      └─ ...otros tipos...
      ↓
ai-agent (orquestador)
      ├─ OpenAI API (GPT-4, Whisper, Vision)
      ├─ ConversationMemory (historial)
      ├─ ContactFuzzySearch (búsqueda)
      └─ Function Calling (acciones)
      ↓
Respuesta al usuario
```

## Componentes

### 1. Edge Function: `ai-agent`

**Ubicación**: `supabase/functions/ai-agent/index.ts`

**Responsabilidades**:
- Recibir mensajes procesados (texto, transcripciones, análisis de imágenes)
- Mantener contexto conversacional completo
- Llamar a OpenAI con function calling para detectar intenciones
- Ejecutar acciones según autonomía configurada
- Registrar casos de incertidumbre para analytics

**API**:
```typescript
POST /functions/v1/ai-agent

Body:
{
  tenant_id: string,
  contact_id: string,
  message: string,
  message_type: 'text' | 'audio_transcription' | 'image_analysis',
  metadata?: {
    audio_id?: string,
    image_id?: string,
    analysis?: string,
    ...
  }
}

Response:
{
  success: boolean,
  response: string,
  actions: Array<{
    function_name: string,
    result: any,
    needs_confirmation: boolean
  }>,
  tokens_used: number
}
```

### 2. Módulo: `openai-client.ts`

**Ubicación**: `supabase/functions/_shared/openai-client.ts`

**Funcionalidades**:
- Cliente unificado para OpenAI API
- `chatCompletion()`: GPT-4 para texto y visión
- `transcribeAudio()`: Whisper para audio
- `analyzeImage()`: GPT-4 Vision para imágenes
- `createTools()`: Definición de funciones disponibles
- `createSystemMessage()`: Generación de prompts de sistema

**Funciones (Tools) disponibles**:
1. `create_loan`: Crear préstamo (lent/borrowed)
2. `query_loans`: Consultar préstamos
3. `mark_loan_returned`: Marcar como devuelto
4. `reschedule_loan`: Reprogramar fecha
5. `search_contacts`: Buscar contactos
6. `show_uncertainty`: Registrar incertidumbre

### 3. Módulo: `conversation-memory.ts`

**Ubicación**: `supabase/functions/_shared/conversation-memory.ts`

**Responsabilidades**:
- Guardar y recuperar historial de conversaciones
- Convertir historial a formato OpenAI
- Limpiar historial antiguo (retention policy)
- Generar estadísticas de uso

**Tabla BD**: `conversation_history`
```sql
- id (UUID)
- tenant_id, contact_id
- role: 'user' | 'assistant' | 'system'
- content: TEXT
- metadata: JSONB (audio_url, image_url, intent, confidence)
- created_at
```

### 4. Módulo: `contact-fuzzy-search.ts`

**Ubicación**: `supabase/functions/_shared/contact-fuzzy-search.ts`

**Funcionalidades**:
- Búsqueda fuzzy usando distancia de Levenshtein
- Normalización de texto (sin acentos, minúsculas)
- Scoring de similaridad (0-1)
- Tipos de match: exact, partial, fuzzy

**Ejemplo**:
```typescript
// Usuario escribe: "le presté 50 lucas a erick"
const result = await findContactByName(supabase, tenantId, 'erick', 0.6);

// Encuentra:
// - "Erick Rodríguez" (similarity: 0.95)
// - "Eric Silva" (similarity: 0.75)
```

### 5. Módulo: `whatsapp-media-download.ts`

**Ubicación**: `supabase/functions/_shared/whatsapp-media-download.ts`

**Funcionalidades**:
- Descargar archivos de media desde WhatsApp Cloud API
- Convertir Blob a File para OpenAI
- Manejo de errores de descarga

**Flujo**:
1. GET `/{media_id}` → obtener URL
2. GET URL con token → descargar Blob
3. Convertir a File si es necesario

## Procesamiento por Tipo de Mensaje

### Mensajes de Texto

**Flujo**:
```
Usuario: "le presté 50 lucas a erick para fin de mes"
↓
wa_webhook detecta: message.type === 'text'
↓
¿Hay flujo activo? NO
↓
Delegar a ai-agent
↓
ai-agent:
  1. Obtener historial conversacional (últimos 20 mensajes)
  2. Obtener contexto del usuario (préstamos, contactos)
  3. Crear mensaje de sistema con contexto
  4. Llamar GPT-4 con function calling
  5. GPT-4 detecta: create_loan
     - loan_type: 'lent'
     - contact_name: 'erick'
     - amount: 50000
     - due_date: '2025-11-30'
  6. Buscar contacto "erick" → encontrar "Erick Rodríguez"
  7. Solicitar confirmación
↓
Respuesta: "¿Confirmas préstamo otorgado a Erick Rodríguez por $50,000
           con vencimiento 2025-11-30?"
           [Botones: ✅ Confirmar | ❌ Cancelar]
```

### Mensajes de Audio

**Flujo**:
```
Usuario: [audio] "le presté 50 lucas a erick"
↓
wa_webhook detecta: message.type === 'audio'
↓
1. Descargar audio desde WhatsApp (media_id)
2. Transcribir con Whisper API
   - language: 'es'
   - prompt: "Transcripción sobre préstamos..."
3. Obtener transcripción: "le presté 50 lucas a erick"
↓
Delegar transcripción a ai-agent (como mensaje de texto)
↓
[Mismo proceso que texto]
↓
Respuesta: "🎤 Audio recibido: 'le presté 50 lucas a erick'

¿Confirmas préstamo otorgado a Erick Rodríguez por $50,000?"
```

### Mensajes de Imagen

**Flujo**:
```
Usuario: [imagen de transferencia] + caption: "pagué a juan"
↓
wa_webhook detecta: message.type === 'image'
↓
1. Descargar imagen desde WhatsApp
2. Convertir a base64 (data URL)
3. Analizar con GPT-4 Vision
   Prompt: "Analiza esta imagen de una app de préstamos.
            Usuario dice: 'pagué a juan'
            Determina: tipo, monto, destinatario, acción"
4. Análisis: "Comprobante de transferencia bancaria.
              Monto: $50,000
              Destinatario: Juan Pérez
              Fecha: 23-10-2025
              Acción probable: confirmar pago de préstamo"
↓
Delegar a ai-agent con análisis
↓
ai-agent procesa con contexto completo
↓
Respuesta: "📷 Imagen analizada:
Comprobante de transferencia por $50,000 a Juan Pérez.

¿Confirmas marcar como pagado el préstamo a Juan Pérez?"
[Botones: ✅ Confirmar | ❌ Cancelar]
```

## Sistema de Autonomía

Configuración: **Mixta** (según tipo de acción)

### Sin confirmación (ejecuta directo):
- Consultas: estado de préstamos, saldos, listados
- Mostrar información del usuario
- Responder preguntas frecuentes
- Búsqueda de contactos

### Con confirmación:
- **Crear** préstamos
- **Modificar** fechas o montos
- **Marcar** como devuelto/pagado
- **Eliminar** registros
- Cualquier acción que modifique datos

### Confirmación con botones:
```typescript
{
  type: 'button',
  body: { text: "¿Confirmas acción X?" },
  action: {
    buttons: [
      { type: 'reply', reply: { id: 'confirm_yes', title: '✅ Confirmar' } },
      { type: 'reply', reply: { id: 'confirm_no', title: '❌ Cancelar' } }
    ]
  }
}
```

## Fallback ante Incertidumbre

**Threshold**: Confianza < 70%

**Acciones**:
1. Registrar en `ai_uncertainty_log` (para analytics)
2. Mostrar opciones al usuario
3. Usuario elige → retroalimentar sistema

**Ejemplo**:
```
Usuario: "préstamo de juan"
↓
IA detecta:
  - Posibilidad 1: ¿Crear préstamo recibido de Juan? (45%)
  - Posibilidad 2: ¿Consultar préstamo con Juan? (40%)
  - Posibilidad 3: ¿Marcar préstamo de Juan como pagado? (15%)
↓
Respuesta: "No estoy seguro de lo que necesitas. ¿Quieres:

1. Crear nuevo préstamo recibido de Juan
2. Ver el estado del préstamo con Juan
3. Marcar el préstamo de Juan como pagado"

[Se muestra menú de opciones]
```

## Búsqueda Inteligente de Contactos

**Algoritmo**: Levenshtein distance + normalización

**Ejemplo**:
```javascript
Usuario: "le presté a eRiCk" (con mayúsculas mezcladas)
↓
Normalizar: "erick"
↓
Buscar en contactos:
  - "Erick Rodríguez" → similarity: 0.95 (partial match)
  - "Eric Silva" → similarity: 0.75 (fuzzy match)
  - "Federico" → similarity: 0.30 (descartado, < 0.6)
↓
¿Múltiples matches con alta similaridad?
  SÍ → Mostrar opciones
  NO → Usar el mejor match
```

## Base de Datos

### Tabla: `conversation_history`
```sql
CREATE TABLE conversation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  contact_id UUID NOT NULL REFERENCES tenant_contacts(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Índices**:
- `(tenant_id, contact_id, created_at DESC)` - Búsqueda de historial
- `(created_at DESC)` - Limpieza de datos antiguos

**RLS**: Permisivo para service role, restringido por tenant para usuarios

### Tabla: `ai_uncertainty_log`
```sql
CREATE TABLE ai_uncertainty_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  contact_id UUID NOT NULL,
  user_message TEXT NOT NULL,
  detected_intents JSONB DEFAULT '[]',
  confidence_scores JSONB DEFAULT '{}',
  chosen_action TEXT,
  user_feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Uso**: Analytics para mejorar el sistema

### Tabla: `ai_response_cache`
```sql
CREATE TABLE ai_response_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  cache_key TEXT NOT NULL,
  response JSONB NOT NULL,
  hit_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, cache_key)
);
```

**Uso**: Optimización de costos (cachear respuestas frecuentes)

## Configuración

### Variables de Entorno Requeridas

```bash
# OpenAI API Key (REQUERIDO)
npx supabase secrets set OPENAI_API_KEY=sk-proj-...

# Ya existentes (no modificar)
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### Deployment

```bash
# Desplegar edge function ai-agent
npx supabase functions deploy ai-agent

# Nota: wa_webhook ya está desplegado, se actualiza automáticamente
npx supabase functions deploy wa_webhook --no-verify-jwt
```

### Verificación

```bash
# Ver logs en tiempo real
npx supabase functions logs ai-agent --tail

# Ver logs de webhook
npx supabase functions logs wa_webhook --tail
```

## Costos Estimados (OpenAI)

**Modelo Actual: GPT-5 nano** 🎉

**Para 1000 usuarios activos/mes**:

| Servicio | Uso estimado | Costo mensual |
|----------|--------------|---------------|
| GPT-5 nano (texto) | ~500K tokens | **$4-8** ⚡ |
| Whisper (audio) | ~500 minutos | $10-20 |
| GPT-5 nano Vision (imágenes) | ~1000 imágenes | **$2-4** ⚡ |
| **TOTAL** | | **$16-32/mes** 💰 |

**Comparación con GPT-4:**
- GPT-4o: ~$80-160/mes
- GPT-5 nano: ~$16-32/mes
- **Ahorro: 80% (~$120/mes)** 🚀

**Parámetros GPT-5 configurados**:
- `verbosity: 'medium'` - Respuestas balanceadas (texto)
- `verbosity: 'low'` - Respuestas concisas (imágenes)
- `reasoning_effort: 'low'` - Razonamiento ligero para velocidad

**Optimizaciones adicionales**:
1. Cachear respuestas frecuentes en `ai_response_cache`
2. Limitar tokens en historial conversacional
3. Comprimir imágenes antes de enviar a Vision

## Ejemplos de Uso

### Ejemplo 1: Crear préstamo con lenguaje natural

```
Usuario: "le presté 100 lucas a María para el viernes"

IA:
1. Detecta: create_loan
2. Extrae:
   - loan_type: 'lent'
   - contact_name: 'María'
   - amount: 100000
   - due_date: '2025-10-25' (próximo viernes)
3. Busca contacto: "María González" (similarity: 1.0)
4. Responde: "¿Confirmas préstamo otorgado a María González por
             $100,000 con vencimiento 25-10-2025?"
```

### Ejemplo 2: Audio transcrito

```
Usuario: [audio 15 seg] "oye erick me debe 50 lucas, me las pagará mañana"

IA:
1. Whisper transcribe: "oye erick me debe 50 lucas me las pagará mañana"
2. Detecta: query_loans (menciona deuda existente)
3. Busca "erick": Erick Rodríguez
4. Consulta BD: Erick debe $50,000, vence mañana
5. Responde: "🎤 Audio recibido

Sí, Erick Rodríguez te debe $50,000 con vencimiento mañana (24-10-2025).

¿Quieres actualizar la fecha de pago?"
```

### Ejemplo 3: Imagen analizada

```
Usuario: [Foto de comprobante]

IA:
1. Vision analiza: "Comprobante Banco Estado
                    Transferencia: $75,000
                    Destinatario: Pedro López
                    Fecha: 23-10-2025"
2. Busca "Pedro López" en contactos
3. Verifica préstamos activos con Pedro
4. Detecta: mark_loan_returned
5. Responde: "📷 Imagen analizada:
   Transferencia de $75,000 a Pedro López.

   ¿Confirmas marcar como pagado el préstamo a Pedro López por $75,000?"
```

## Troubleshooting

### Error: "OPENAI_API_KEY no configurada"

**Solución**:
```bash
npx supabase secrets set OPENAI_API_KEY=sk-proj-tu-key-aqui
```

### Error: "Error calling OpenAI API"

**Causas posibles**:
1. API key inválida o sin créditos
2. Rate limit excedido
3. Modelo no disponible

**Verificación**:
```bash
# Ver logs detallados
npx supabase functions logs ai-agent --tail

# Buscar líneas con [OpenAI] Error
```

### Los mensajes no se procesan con IA

**Verificar**:
1. ¿Hay flujo conversacional activo? (la IA solo procesa sin flujo activo)
2. ¿Es un comando simple? (hola, ayuda, menú → no usa IA)
3. ¿Está desplegado ai-agent?

```bash
npx supabase functions list | grep ai-agent
```

### IA no encuentra contactos

**Causa**: Threshold de similaridad muy alto

**Solución**: Ajustar en `contact-fuzzy-search.ts`:
```typescript
const result = await findContactByName(supabase, tenantId, name, 0.5); // Bajar de 0.6 a 0.5
```

## Sistema de Control de Seguridad (v2.1.0)

### Filosofía: Deny by Default

**Principio fundamental**: La IA NO puede hacer nada que no esté explícitamente permitido.

### 1. Sistema de Permisos (`_shared/ai-permissions.ts`)

**Niveles de Riesgo**:
```typescript
- READONLY: Solo lectura, sin modificaciones (ej: query_loans, search_contacts)
- LOW: Modificaciones menores, reversibles (ej: create_contact)
- MEDIUM: Modificaciones importantes (ej: update_contact, reschedule_loan)
- HIGH: Modificaciones críticas con dinero (ej: create_loan, mark_loan_returned)
- CRITICAL: Operaciones destructivas (ej: delete_loan, delete_contact)
```

**Configuración por Función**:
```typescript
{
  create_loan: {
    risk: 'high',
    requiresConfirmation: 'always',
    validations: {
      maxAmount: 100000000,  // 100M CLP
      maxPerDay: 10          // Máx 10 préstamos por día
    },
    enabled: true
  },

  delete_loan: {
    risk: 'critical',
    requiresConfirmation: 'always',
    validations: {
      maxPerDay: 3
    },
    enabled: false  // DESHABILITADO por defecto
  }
}
```

**Funciones Disponibles**:

✅ **Habilitadas**:
- `query_loans` - Consultar préstamos (READONLY)
- `search_contacts` - Buscar contactos (READONLY)
- `create_loan` - Crear préstamo (HIGH, confirmación siempre)
- `mark_loan_returned` - Marcar como pagado (HIGH, confirmación siempre)
- `reschedule_loan` - Reprogramar fecha (MEDIUM, confirmación siempre)
- `create_contact` - Crear contacto (LOW, confirmación condicional)
- `update_contact` - Actualizar contacto (MEDIUM, confirmación siempre)
- `show_uncertainty` - Registrar incertidumbre (READONLY)

❌ **Deshabilitadas** (requieren implementación adicional):
- `delete_loan` - Eliminar préstamo (CRITICAL)
- `delete_contact` - Eliminar contacto (CRITICAL)
- `update_loan_amount` - Modificar monto (HIGH)
- `merge_contacts` - Fusionar contactos (HIGH)

### 2. Rate Limiting

**Prevención de abuso** con límites por usuario:

```typescript
{
  maxPerHour: 30,  // Máx 30 operaciones por hora
  maxPerDay: 10     // Máx 10 operaciones por día
}
```

**Ejemplos**:
- `query_loans`: 30 consultas/hora (anti-spam)
- `create_loan`: 10 creaciones/día
- `mark_loan_returned`: 20 marcas/día
- `delete_loan`: 3 eliminaciones/día (si estuviera habilitado)

### 3. Auditoría Completa (`ai_actions_audit`)

**Tabla de auditoría** que registra TODAS las acciones:

```sql
CREATE TABLE ai_actions_audit (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  contact_id UUID NOT NULL,
  function_name TEXT NOT NULL,
  arguments JSONB NOT NULL,
  result JSONB,
  status TEXT,  -- success, error, cancelled, pending_confirmation
  error_message TEXT,
  risk_level TEXT,
  required_confirmation BOOLEAN,
  was_confirmed BOOLEAN,
  execution_time_ms INTEGER,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ,
  metadata JSONB
);
```

**Qué se registra**:
- ✅ Función ejecutada y argumentos
- ✅ Resultado completo
- ✅ Tiempo de ejecución
- ✅ Tokens de OpenAI usados
- ✅ Si requirió confirmación
- ✅ Si el usuario confirmó o rechazó
- ✅ Errores y razones de bloqueo
- ✅ Metadata adicional (rate limit info, etc.)

**Retention Policy**:
- Registros exitosos: 90 días
- Registros con error: 180 días (para debugging)

**Vista de Analytics**:
```sql
CREATE VIEW ai_actions_summary AS
SELECT
  function_name,
  COUNT(*) as total_executions,
  COUNT(*) FILTER (WHERE status = 'success') as successful,
  COUNT(*) FILTER (WHERE status = 'error') as failed,
  AVG(execution_time_ms) as avg_time,
  SUM(tokens_used) as total_tokens
FROM ai_actions_audit
GROUP BY function_name;
```

### 4. Guardrails en System Prompt

**Reglas críticas** inyectadas en el prompt del AI Agent:

```
REGLAS DE SEGURIDAD - CRÍTICO:
1. NUNCA ejecutes operaciones de escritura sin confirmación explícita
2. Las funciones de LECTURA pueden ejecutarse directamente
3. Las funciones de ESCRITURA SIEMPRE requieren confirmación
4. Si el usuario dice "confirmo" → verifica que haya acción pendiente
5. NO inventes ni asumas información crítica (montos, fechas, nombres)
6. NO ejecutes múltiples operaciones de escritura sin confirmación individual
```

### 5. Validaciones Pre-ejecución

**Flujo de validación** en `ai-agent/index.ts`:

```typescript
async function executeFunction(functionName, args) {
  // 1. Verificar permisos
  const permissionCheck = checkFunctionPermission(functionName, args);
  if (!permissionCheck.allowed) {
    logAuditAction(..., status: 'error');
    return { error: permissionCheck.reason };
  }

  // 2. Verificar rate limiting
  const rateLimitCheck = await checkRateLimit(supabase, tenantId, contactId, functionName);
  if (!rateLimitCheck.allowed) {
    logAuditAction(..., status: 'error');
    return { error: rateLimitCheck.reason };
  }

  // 3. Ejecutar función
  const result = await actualFunction(args);

  // 4. Registrar en auditoría
  await logAuditAction(supabase, {
    function_name: functionName,
    arguments: args,
    result: result,
    status: result.success ? 'success' : 'error',
    risk_level: permissionCheck.riskLevel,
    execution_time_ms: endTime - startTime
  });

  return result;
}
```

### 6. Casos de Uso - Control de Seguridad

#### ✅ Caso 1: Consulta (permitido sin confirmación)
```
Usuario: "¿cuánto me debe juan?"
→ query_loans() → risk: READONLY → ejecuta directamente ✅
→ Audit: status=success, required_confirmation=false
```

#### ✅ Caso 2: Crear préstamo (requiere confirmación)
```
Usuario: "le presté 50 lucas a maría"
→ create_loan() → risk: HIGH → pide confirmación
→ Audit: status=pending_confirmation, required_confirmation=true

Usuario: "confirmo"
→ Ejecuta creación ✅
→ Audit: status=success, was_confirmed=true
```

#### ❌ Caso 3: Rate limit excedido
```
Usuario: crea 11° préstamo del día
→ create_loan() → checkRateLimit() → maxPerDay=10 excedido
→ Audit: status=error, error_message="Límite de 10 operaciones por día excedido"
→ Respuesta: "⚠️ Límite de 10 operaciones por día excedido. Por favor intenta más tarde."
```

#### ❌ Caso 4: Función deshabilitada
```
Usuario: "elimina el préstamo de juan"
→ delete_loan() → enabled=false
→ Audit: status=error, error_message="Función delete_loan está deshabilitada"
→ Respuesta: "Lo siento, no puedo eliminar préstamos. Por favor contacta a soporte."
```

#### ❌ Caso 5: Monto excede límite
```
Usuario: "le presté 200 millones a pedro"
→ create_loan(amount=200000000) → maxAmount=100000000
→ Audit: status=error, error_message="Monto excede el máximo permitido"
→ Respuesta: "El monto $200,000,000 excede el máximo permitido ($100,000,000)."
```

### 7. Monitoreo y Alertas

**Métricas clave** a monitorear:

1. **Tasa de errores** por función
2. **Operaciones bloqueadas** por rate limit
3. **Intentos de funciones deshabilitadas**
4. **Tiempo promedio de ejecución**
5. **Tokens consumidos** por tenant

**Queries útiles**:

```sql
-- Top funciones más usadas
SELECT function_name, COUNT(*) as total
FROM ai_actions_audit
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY function_name
ORDER BY total DESC;

-- Errores recientes
SELECT function_name, error_message, COUNT(*) as occurrences
FROM ai_actions_audit
WHERE status = 'error'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY function_name, error_message
ORDER BY occurrences DESC;

-- Rate limits más excedidos
SELECT contact_id, function_name, COUNT(*) as blocked_attempts
FROM ai_actions_audit
WHERE error_message LIKE '%Límite%excedido%'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY contact_id, function_name
ORDER BY blocked_attempts DESC;
```

### 8. Cómo Habilitar una Función Deshabilitada

**Ejemplo: Habilitar `delete_loan`**

1. **Evaluar riesgos**: ¿Es seguro permitir eliminaciones?
2. **Implementar validaciones adicionales** en la función
3. **Actualizar permisos** en `_shared/ai-permissions.ts`:
```typescript
delete_loan: {
  risk: RiskLevel.CRITICAL,
  requiresConfirmation: ConfirmationRequired.ALWAYS,
  validations: {
    requiresExistingRecord: true,
    maxPerDay: 3,
    // Validación extra: solo préstamos creados en últimas 24h
    onlyRecentRecords: true
  },
  enabled: true  // ← Cambiar a true
}
```
4. **Actualizar guardrails** en system prompt
5. **Desplegar** y monitorear uso

### 9. Seguridad - Mejores Prácticas

✅ **DO**:
- Usa `checkFunctionPermission()` antes de ejecutar
- Registra TODAS las acciones en `ai_actions_audit`
- Pide confirmación para operaciones de escritura
- Valida montos, fechas y datos críticos
- Implementa rate limiting para prevenir abuso

❌ **DON'T**:
- No ejecutes operaciones de escritura sin confirmación
- No asumas información del usuario
- No habilites funciones CRITICAL sin validaciones extra
- No ignores errores de rate limiting
- No omitas el registro de auditoría

## Roadmap / Mejoras Futuras

1. **Implementación de acciones reales**:
   - Actualmente `createLoan`, `queryLoans`, etc. son stubs
   - Conectar con la BD real de `loan_agreements`

2. **Cache inteligente**:
   - Implementar uso de `ai_response_cache`
   - Cachear respuestas a preguntas frecuentes

3. **Analytics dashboard**:
   - Panel para visualizar `ai_uncertainty_log`
   - Identificar patrones de confusión
   - Mejorar prompts según casos reales

4. **Modelos adaptativos**:
   - Usar `gpt-4o-mini` para consultas simples
   - Reservar `gpt-4o` para casos complejos
   - Ahorrar hasta 80% en costos

5. **Soporte multiidioma**:
   - Detectar idioma del usuario automáticamente
   - Responder en el mismo idioma

6. **Integración con flujos existentes**:
   - Permitir que IA inicie flujos conversacionales
   - Transición suave entre IA y flujos estructurados

## Referencias

- [OpenAI API Docs](https://platform.openai.com/docs)
- [Whisper API](https://platform.openai.com/docs/guides/speech-to-text)
- [GPT-4 Vision](https://platform.openai.com/docs/guides/vision)
- [Function Calling](https://platform.openai.com/docs/guides/function-calling)
