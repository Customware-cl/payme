# Resumen Ejecutivo - Flujo de Carga Web desde WhatsApp

## Resumen Rápido

La aplicación web de SomosPayme funciona completamente **sin autenticación tradicional**, utilizando un sistema de **tokens temporales** generados por el bot de WhatsApp.

Cuando un usuario hace clic en un link desde WhatsApp, el flujo es:

```
Link WhatsApp → Validar Token → Cargar Menú → [Onboarding] → Crear Préstamo
```

---

## Datos Clave

| Aspecto | Valor |
|--------|-------|
| **Entry Point** | `/public/menu/index.html` |
| **Token Type** | URL query parameter `?token=...` |
| **Token Duration (Short)** | 1 hora |
| **Token Duration (LLT)** | 30 días |
| **Auth Method** | Token-based, stateless |
| **Storage** | Supabase (PostgreSQL + Storage) |
| **Frontend Validation** | Sí (email, teléfono, monto) |
| **API Validation** | Sí (token, datos, lógica) |
| **CORS** | Allow all origins (*) |

---

## Archivos Principales

### Frontend (Vanilla JavaScript)
```
/public/menu/
  ├── index.html          (HTML principal)
  └── app.js              (Inicialización y eventos)

/public/loan-form/
  ├── index.html          (Formulario de préstamo)
  └── app.js              (Estado y validaciones)
```

### Backend (Edge Functions - Deno/TypeScript)
```
/supabase/functions/
  ├── generate-menu-token/    (Generar token de menú)
  ├── menu-data/              (Obtener datos de usuario)
  ├── complete-onboarding/    (Completar perfil)
  ├── loan-web-form/          (Crear/listar préstamos)
  ├── create-received-loan/   (Préstamo recibido)
  └── generate-loan-web-link/ (Generar link de formulario)
```

---

## 14 Pasos Principales del Flujo

### Fase 1-4: Inicialización del Menú (2 min)

1. **Usuario hace clic en link WhatsApp**
   - URL: `https://somospayme.cl/menu?token=menu_[TENANT]_[CONTACT]_[TIMESTAMP]`
   - Archivo: Generado por `generate-menu-token` edge function

2. **Navegador carga `/public/menu/index.html`**
   - Renderiza estructura HTML vacía
   - Carga `app.js`

3. **app.js ejecuta `init()`**
   - Extrae token de URL query params
   - Llama a `validateSession()`

4. **Frontend valida token**
   - Llama: `GET /functions/v1/menu-data?token=...&type=user`
   - Si inválido/expirado: muestra "enlace expirado" y termina

### Fase 5-7: Carga de Usuario y Detección de Onboarding (1 min)

5. **Edge Function `menu-data` parsea token**
   - Soporta 2 formatos: `menu_[T]_[C]_[TS]` o `menu_llt_[T]_[C]_[UUID]_[TS]`
   - LLT: busca en `active_sessions`, verifica `revoked` y expiración
   - Short: calcula edad del token (máx 1 hora)
   - Si válido: retorna `{ success: true, name, requires_onboarding }`

6. **Frontend carga nombre y detecta onboarding**
   - Función: `loadUserName()`
   - Si `requires_onboarding=true`: mostrar formulario
   - Si `requires_onboarding=false`: mostrar menú principal

7. **[Si requiere onboarding] Usuario completa perfil**
   - Formulario: nombre, apellido, email
   - Validaciones en frontend:
     - Email: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
     - Nombres: solo letras + espacios + acentos
   - Envía: `POST /functions/v1/complete-onboarding { token, first_name, last_name, email }`

### Fase 8-9: Completar Onboarding (Backend)

8. **Edge Function `complete-onboarding` procesa**
   - Obtiene `tenant_contact` del usuario
   - Actualiza `contact_profile` con datos
   - Ejecuta RPC `ensure_user_tenant()` para crear tenant
   - Registra evento en tabla `events`
   - Retorna: `{ success: true, tenant_id }`

9. **Frontend recarga página (`window.location.reload()`)**
   - Vuelve a `init()` con mismo token
   - Ahora `requires_onboarding=false`
   - Muestra menú principal con 4 opciones

### Fase 10-11: Menú Principal

10. **`setupEventListeners()` configura botones**
    - Ver Perfil → `/menu/profile.html?token=[TOKEN]`
    - Datos bancarios → `/menu/bank-details.html?token=[TOKEN]`
    - Nuevo préstamo → `/loan-form?token=[TOKEN]`
    - Estado de préstamos → `/menu/loans.html?token=[TOKEN]`

11. **Usuario click "Nuevo préstamo"**
    - Redirige a `/loan-form?token=[TOKEN]`
    - Carga `loan-form/app.js`

### Fase 12-13: Formulario de Préstamo

12. **Formulario inicializa y valida sesión**
    - GET `/functions/v1/loan-web-form?token=...`
    - Obtiene lista de contactos del tenant
    - Configura 5 pantallas:
      1. Dirección (Yo presté / Me prestaron)
      2. Contacto (seleccionar o crear nuevo)
      3. Qué (tipo: dinero/objeto, monto/desc, concepto)
      4. Cuándo (fecha de devolución)
      5. Confirmar (resumen)

13. **Usuario completa y envía formulario**
    - Frontend valida en cada paso:
      - Monto: `[^\d]` (solo dígitos) y > 0
      - Descripción: >= 3 caracteres
      - Teléfono (si nuevo): `/^\+?56\d{9}$/`
      - Fecha: validar rango
    - POST `/functions/v1/loan-web-form` con payload
    - [Opcional] Sube imagen a Supabase Storage
    - PATCH `/functions/v1/loan-web-form` actualizar URL imagen

### Fase 14: Crear Préstamo (Backend)

14. **Edge Function `loan-web-form` procesa**
    - Parsea token (soporta 3 formatos: menu short, menu llt, loan web)
    - Valida datos de entrada
    - Prepara contexto según dirección:
      - `lent`: usa `LOAN_FORM_ENDPOINT`
      - `borrowed`: usa `RECEIVED_LOAN_ENDPOINT`
    - Llama `FlowHandler.handleNewLoanFlow()`
    - Crea agreement en tabla `agreements`
    - Registra evento en tabla `events`
    - Retorna: `{ success: true, agreement_id }`
    - Muestra pantalla de éxito

---

## Componentes Críticos

### 1. Token Parsing

**Función común**: `parseToken()` (ubicada en cada edge function)

```javascript
// Detecta formato automáticamente
token = "menu_llt_abc123_def456_uuid_1697000000" → tipo: LLT
token = "menu_abc123_def456_1697000000" → tipo: short
token = "loan_web_abc123_def456_1697000000" → tipo: loan web
```

**Validaciones**:
- **LLT**: busca en DB, verifica revoke y expiración
- **Short**: calcula edad del timestamp (máx 3600000ms = 1 hora)
- **Loan web**: calcula edad (máx 1 hora)

### 2. Validación de Datos

**Frontend**:
```javascript
// Monto (dinero)
parseFloat(value.replace(/[^\d]/g, '')) > 0

// Descripción (objeto)
value.trim().length >= 3

// Email
/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

// Teléfono (opcional)
/^\+?56\d{9}$/.test(phone)

// Nombres (onboarding)
/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{2,50}$/.test(name)
```

**Backend**: valida nuevamente + lógica de negocio

### 3. CORS

Todas las edge functions retornan:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, PATCH, OPTIONS',
};
```

Maneja requests OPTIONS automáticamente.

### 4. Interceptores Implícitos

**En frontend**:
```javascript
// Cada fetch() pasa token en URL
fetch(`${SUPABASE_URL}/functions/v1/...?token=${state.token}`)

// Si status 401 → token inválido/expirado
if (response.status === 401) {
    showExpiredScreen()
    return false
}
```

**En backend**:
```typescript
// Cada función valida token primero
const tokenData = await parseToken(token, supabase);
if (!tokenData) {
    return Response { status: 401 }
}
```

---

## Base de Datos - Tablas Usadas

| Tabla | Uso | Campos Relevantes |
|-------|-----|------------------|
| `tenants` | Workspace del usuario | `id`, `owner_contact_profile_id` |
| `tenant_contacts` | Contactos dentro de tenant | `id`, `tenant_id`, `contact_profile_id`, `name` |
| `contact_profiles` | Perfil compartido entre tenants | `id`, `phone_e164`, `first_name`, `last_name`, `email`, `bank_accounts` |
| `agreements` | Préstamos creados | `id`, `lender_tenant_contact_id`, `tenant_contact_id`, `amount`, `item_description`, `due_date`, `status`, `metadata` |
| `active_sessions` | Sesiones LLT | `id`, `token`, `tenant_id`, `contact_id`, `token_type`, `expires_at`, `revoked`, `last_used_at` |
| `events` | Audit trail | `id`, `tenant_id`, `contact_id`, `event_type`, `payload` |

---

## Errores Comunes y Resolución

| Error | Causa | Solución |
|-------|-------|----------|
| "Enlace expirado" | Token > 1 hora (short) o > 30 días (LLT) | Generar nuevo token |
| 401 en validación | Token no encontrado en DB (LLT) | Verificar que `active_sessions` tiene registro |
| "Token inválido" | Formato incorrecto o revoked=true | Regenerar desde WhatsApp bot |
| Onboarding infinito | `requires_onboarding=true` siempre | Verificar que `ensure_user_tenant()` crea tenant |
| Formulario vacío | Contactos = 0 | Crear contacto en menú anterior |
| "Error al crear préstamo" | Datos inválidos en payload | Ver logs de edge function |
| Imagen no sube | Archivo > 5MB o formato invalido | Validar en frontend primero |

---

## Flujos de Usuario - Escenarios

### Escenario A: Usuario Nuevo (con Onboarding)
```
Click link → Menú cargado → "Por favor completa tu perfil" 
→ Formulario onboarding → Crear tenant → Menú principal
```

### Escenario B: Usuario Existente (sin Onboarding)
```
Click link → Menú cargado → "¡Hola Juan!" → Menú principal
```

### Escenario C: Crear Préstamo (Dinero)
```
"Nuevo préstamo" → "Yo presté" → Seleccionar Juan 
→ "$50000" + "almuerzo" → Mañana 
→ Confirmar → Crear → Éxito
```

### Escenario D: Crear Préstamo (Objeto)
```
"Nuevo préstamo" → "Me prestaron" → Nuevo contacto (María) 
→ "Bicicleta" + [imagen] → Próximo viernes 
→ Confirmar → Crear → Éxito
```

### Escenario E: Token Expirado
```
Click link (antiguo) → "Este enlace ha expirado" 
→ "Contáctanos por WhatsApp" → FIN
```

---

## Puntos de Entrada Clave

### URLs Públicas
```
https://somospayme.cl/
  └─ Landing page (React - /src)

https://somospayme.cl/menu?token=...
  └─ Menú principal (Vanilla JS)

https://somospayme.cl/loan-form?token=...
  └─ Formulario de préstamo (Vanilla JS)

https://somospayme.cl/menu/profile.html?token=...
  └─ Perfil de usuario (Vanilla JS)

https://somospayme.cl/menu/bank-details.html?token=...
  └─ Datos bancarios (Vanilla JS)

https://somospayme.cl/menu/loans.html?token=...
  └─ Estado de préstamos (Vanilla JS)
```

### Edge Functions (API)
```
POST /functions/v1/generate-menu-token
GET  /functions/v1/menu-data?token=...&type=user|profile|bank|loans
POST /functions/v1/complete-onboarding
GET  /functions/v1/loan-web-form?token=...
POST /functions/v1/loan-web-form
PATCH /functions/v1/loan-web-form
GET  /functions/v1/create-received-loan
POST /functions/v1/create-received-loan
POST /functions/v1/generate-loan-web-link
```

---

## Configuración Requerida

### Supabase
```
SUPABASE_URL: https://qgjxkszfdoolaxmsupil.supabase.co
SUPABASE_SERVICE_ROLE_KEY: [SECRET]
```

### Netlify
```
NETLIFY_MENU_URL: https://somospayme.cl/menu
NETLIFY_LOAN_FORM_URL: https://somospayme.cl/loan-form
```

### Storage
```
Bucket: loan-images
Policies: permitir PUT con SUPABASE_ANON_KEY
Public URL: accessible via GET
```

---

## Conclusión

El sistema es **token-first**, **stateless**, y **sin sesiones tradicionales**.

Ventajas:
- Escalable horizontalmente
- No requiere cookies/storage del navegador
- Tokens pueden expirar automáticamente
- Fácil de revocar (para LLT)

Desventajas:
- URLs largas con tokens visibles en historial
- Requiere regenerar tokens frecuentemente (short)
- No hay "logout" tradicional

