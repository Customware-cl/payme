# Diagrama de Flujo - Carga de Aplicación Web desde WhatsApp

## Diagrama General del Flujo Completo

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    USUARIO HACE CLICK EN LINK WHATSAPP                       │
│  https://somospayme.cl/menu?token=menu_[tenant]_[contact]_[timestamp]        │
└──────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
                     ┌─────────────────────────────┐
                     │   Navegador carga HTML      │
                     │  /public/menu/index.html    │
                     └─────────────────────────────┘
                                     │
                                     ▼
                     ┌─────────────────────────────┐
                     │  Script carga app.js        │
                     │  DOMContentLoaded event     │
                     └─────────────────────────────┘
                                     │
                                     ▼
                     ┌─────────────────────────────┐
                     │ init() extrae token de URL  │
                     │  state.token = urlParams    │
                     └─────────────────────────────┘
                                     │
                                     ▼
                     ┌─────────────────────────────┐
                     │  validateSession()          │
                     │  GET /menu-data?token=...   │
                     │  &type=user                 │
                     └─────────────────────────────┘
                                     │
                ┌────────────────────┴────────────────────┐
                │                                        │
         ¿Token válido?                            ¿Token válido?
                │ SÍ                                     │ NO
                ▼                                        ▼
     ┌─────────────────────────┐        ┌──────────────────────────┐
     │ Parsear token en BD     │        │  showExpiredScreen()     │
     │ Verificar expiración    │        │  Mostrar mensaje error   │
     │ Actualizar last_used_at │        │  y salir                 │
     └─────────────────────────┘        └──────────────────────────┘
                │
                ▼
     ┌─────────────────────────┐
     │  loadUserName()         │
     │  GET /menu-data?        │
     │  token=...&type=user    │
     └─────────────────────────┘
                │
                ▼
     ┌─────────────────────────────────┐
     │ Detectar onboarding requerido    │
     │ ¿Tiene tenant propio?            │
     └─────────────────────────────────┘
          │                    │
    SÍ (requiere)         NO (completo)
          │                    │
          ▼                    ▼
  ┌──────────────────┐  ┌──────────────────┐
  │ showOnboarding   │  │ setupEvent       │
  │ Screen()         │  │ Listeners()      │
  │                  │  │ Mostrar menú     │
  │ Mostrar          │  │ principal        │
  │ formulario       │  │                  │
  │ (nombre,         │  │ ┌─────────────┐  │
  │  apellido,       │  │ │ Ver Perfil  │  │
  │  email)          │  │ │ Datos banco  │  │
  │                  │  │ │ Nuevo loan  │  │
  │ Actualizar       │  │ │ Est. loans  │  │
  │ saludo           │  │ └─────────────┘  │
  └──────────────────┘  └──────────────────┘
          │
          ▼
  ┌──────────────────────┐
  │  handleOnboarding    │
  │  Submit()            │
  │                      │
  │  POST /complete-     │
  │  onboarding          │
  │  { token,            │
  │    first_name,       │
  │    last_name,        │
  │    email }           │
  └──────────────────────┘
          │
          ▼
  ┌──────────────────────┐
  │ Edge Function        │
  │ complete-onboarding  │
  │                      │
  │ 1. Obtener tenant_c  │
  │ 2. Verificar tenant  │
  │ 3. Actualizar prof   │
  │ 4. Crear tenant      │
  │ 5. Registrar evento  │
  └──────────────────────┘
          │
          ▼
  ┌──────────────────────┐
  │ window.location.     │
  │ reload()             │
  │ Reinicia menú        │
  └──────────────────────┘
```

---

## Diagrama del Flujo de Préstamo (Loan Form)

```
                  USUARIO CLICK "NUEVO PRÉSTAMO"
                            │
                            ▼
                ┌──────────────────────────────┐
                │ handleNewLoanClick()         │
                │ Redirige a:                  │
                │ /loan-form?token=[TOKEN]     │
                └──────────────────────────────┘
                            │
                            ▼
                ┌──────────────────────────────┐
                │ Carga app.js del formulario  │
                │ init() ejecuta               │
                └──────────────────────────────┘
                            │
                            ▼
                ┌──────────────────────────────┐
                │ validateSession()            │
                │ GET /loan-web-form?token=... │
                │ Obtiene contactos del tenant │
                └──────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
          ¿Token válido?           ¿Token válido?
                │ SÍ                    │ NO
                ▼                       ▼
     ┌──────────────────┐    ┌──────────────────┐
     │ renderContacts() │    │ showExpiredScreen│
     │ Listar contactos │    │ Mostrar error    │
     └──────────────────┘    └──────────────────┘
                │
                ▼
     ┌──────────────────────────────────┐
     │  setupEventListeners()           │
     │  Configurar navegación entre     │
     │  pantallas del formulario        │
     └──────────────────────────────────┘
                │
                ▼
     ┌──────────────────────────────────┐
     │ PANTALLA 0: ¿Direction?          │
     │                                  │
     │  🔘 Yo presté                    │
     │  🔘 Me prestaron                 │
     └──────────────────────────────────┘
                │
                ├─ "Yo presté" ──────────┐
                │                        ▼
                │              state.loanDirection = 'lent'
                │              updateTexts() - actualiza labels
                │
                ├─ "Me prestaron" ──────┐
                │                        ▼
                │              state.loanDirection = 'borrowed'
                │              updateTexts() - actualiza labels
                │
                └─────────────────────┬──────────────────────┘
                                      ▼
                            ┌──────────────────────┐
                            │ PANTALLA 1: ¿Quién?  │
                            │                      │
                            │ [Juan Pérez]         │
                            │ [Carlos López]       │
                            │ [➕ Nuevo contacto]  │
                            └──────────────────────┘
                                      │
                ┌─────────────────────┴─────────────────────┐
                │                                           │
         Click en contacto                    Click "➕ Nuevo"
                │                                   │
                ▼                                   ▼
     ┌──────────────────┐             ┌──────────────────────┐
     │ Guardar datos:   │             │ Modal nuevo contacto │
     │ contactId        │             │ - Nombre completo    │
     │ contactName      │             │ - Teléfono (opt)     │
     │ contactPhone     │             │ - Guardar            │
     │ newContact=false │             └──────────────────────┘
     └──────────────────┘                       │
                │                               │ Enviar
                │                               ▼
                │                    ┌──────────────────────┐
                │                    │ Guardar datos:       │
                │                    │ contactName = nombre │
                │                    │ contactPhone = phone │
                │                    │ newContact = true    │
                └────────────┬────────┘
                             ▼
                ┌──────────────────────────────┐
                │ PANTALLA 2: ¿Qué?            │
                │                              │
                │  ┌─────────────────────────┐ │
                │  │   💰  Dinero            │ │
                │  │  Monto: [$50000]        │ │
                │  │  Concepto: [almuerzo]   │ │
                │  └─────────────────────────┘ │
                │                              │
                │  ┌─────────────────────────┐ │
                │  │  📦  Objeto             │ │
                │  │  Descripción: [bici]    │ │
                │  │  Imagen: [opcional]     │ │
                │  └─────────────────────────┘ │
                └──────────────────────────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
            "Dinero"                   "Objeto"
                │                         │
                ▼                         ▼
         state.loanType='money'   state.loanType='object'
         Validar monto > 0        Validar desc >= 3 chars
         Mostrar concepto         Sin concepto
                │                         │
                └────────────┬────────────┘
                             ▼
                ┌──────────────────────────────┐
                │ PANTALLA 3: ¿Cuándo?         │
                │                              │
                │  🕐 Mañana                   │
                │  📅 En una semana            │
                │  📆 A fin de mes             │
                │  🗓️ Fecha específica         │
                │     [calendario]             │
                └──────────────────────────────┘
                             │
                             ▼
                ┌──────────────────────────────┐
                │ Calcular fecha               │
                │ calculateDate(option)        │
                │ Guardar en formData          │
                └──────────────────────────────┘
                             │
                             ▼
                ┌──────────────────────────────┐
                │ PANTALLA 4: Confirmar        │
                │                              │
                │  Para: Juan Pérez            │
                │  Préstamo: $50000            │
                │  Concepto: almuerzo          │
                │  Devolución: 25 Oct 2024     │
                │                              │
                │  [Crear préstamo]            │
                │  [Editar]                    │
                └──────────────────────────────┘
                             │
                             ▼
                ┌──────────────────────────────┐
                │ createLoan()                 │
                │                              │
                │ showLoader(true)             │
                │ Preparar payload según       │
                │ dirección (lent/borrowed)    │
                │                              │
                │ POST /loan-web-form          │
                └──────────────────────────────┘
                             │
                             ▼
                ┌──────────────────────────────┐
                │ Edge Function:               │
                │ loan-web-form                │
                │                              │
                │ 1. Parsear token            │
                │ 2. Validar datos            │
                │ 3. Preparar contexto        │
                │ 4. Llamar FlowHandler       │
                │ 5. Crear agreement          │
                │ 6. Registrar evento         │
                └──────────────────────────────┘
                             │
         ┌───────────────────┴────────────────────┐
         │                                         │
    ¿Hay imagen?                            ¿Hay imagen?
         │ SÍ                                   │ NO
         ▼                                       ▼
    uploadImageToStorage()          Saltarse subida
         │                           de imagen
         │                                   │
         ▼                                   │
    PATCH /loan-web-form             │
    Actualizar metadata                 │
         │                                   │
         └──────────┬───────────────────────┘
                    ▼
          ┌─────────────────────┐
          │ PANTALLA 5: Éxito   │
          │                     │
          │     ✓               │
          │ ¡Préstamo creado!   │
          │                     │
          │ [Crear otro]        │
          │ [Volver al menú]    │
          └─────────────────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
    "Crear otro"      "Volver al menú"
         │                     │
         ▼                     ▼
    Reset form         /menu?token=[TOKEN]
    Volver a        Redireccionar a menú
    pantalla 0      principal
```

---

## Diagrama de Token Parsing - menu-data

```
┌─────────────────────────────────────────────────────────────┐
│ parseToken(token, supabase) → menu-data/index.ts línea 14   │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
                ┌────────────────────┐
                │ token.split('_')   │
                │ Analizar estructura│
                └────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          │                             │
    ¿Formato "llt"?              ¿Formato "short"?
          │ SÍ                         │ SÍ
          ▼                            ▼
  ┌──────────────────────┐  ┌──────────────────────┐
  │ LLT FORMAT:          │  │ SHORT FORMAT:        │
  │ menu_llt_[T]_[C]_[U]_[TS]  │ menu_[T]_[C]_[TS]        │
  │                      │  │                      │
  │ Validaciones:        │  │ Validaciones:        │
  │ 1. 6 parts           │  │ 1. 4 parts           │
  │ 2. Buscar en DB      │  │ 2. Calcular edad     │
  │    active_sessions   │  │    Age = now - TS    │
  │ 3. Verificar         │  │ 3. Si > 1 hora       │
  │    revoked=false     │  │    → return null     │
  │ 4. Verificar exp     │  │ 4. Return data       │
  │    expires_at        │  │                      │
  │ 5. Update            │  │                      │
  │    last_used_at      │  │                      │
  └──────────────────────┘  └──────────────────────┘
          │                            │
          └──────────────┬─────────────┘
                         ▼
        ┌────────────────────────────┐
        │ return {                   │
        │   tenant_id,               │
        │   contact_id,              │
        │   timestamp,               │
        │   token_type               │
        │ }                          │
        └────────────────────────────┘
```

---

## Diagrama de Estado Global - Formulario de Préstamo

```
┌───────────────────────────────────────────────────────────────────────┐
│ STATE OBJECT - loan-form/app.js líneas 1-19                          │
└───────────────────────────────────────────────────────────────────────┘

const state = {
    ┌─ token (string | null)
    │   URL param token extraído
    │   Usado en todas las llamadas API
    │
    ├─ contacts (array)
    │   Contactos del tenant
    │   Cargados desde GET /loan-web-form?token=...
    │   Estructura: { id, name, phone }
    │
    ├─ loanDirection (string | null)
    │   'lent' = Yo presté
    │   'borrowed' = Me prestaron
    │   Usado para:
    │     - updateTexts() cambiar labels
    │     - determinar endpoint POST
    │
    └─ formData (object)
        ├─ contactId (string | null)
        │  ID del contacto en tenant
        │  null si new_contact=true
        │
        ├─ contactName (string | null)
        │  Nombre completo del contacto
        │  Visible en resumen y éxito
        │
        ├─ contactPhone (string | null)
        │  Teléfono del contacto
        │  Formato: +56912345678
        │
        ├─ newContact (boolean)
        │  true = Contacto creado en formulario
        │  false = Contacto existente
        │
        ├─ loanType (string | null)
        │  'money' = Préstamo en efectivo
        │  'object' = Préstamo de objeto
        │  Determina validaciones y campos
        │
        ├─ loanDetail (string | null)
        │  Si loanType='money': monto (ej: "50000")
        │  Si loanType='object': descripción (ej: "bici")
        │
        ├─ loanConcept (string | null)
        │  Solo para money
        │  Concepto del préstamo (ej: "almuerzo")
        │  Puede ser null
        │
        ├─ dateOption (string | null)
        │  'tomorrow' | 'week' | 'month-end' | 'custom'
        │
        ├─ customDate (string | null)
        │  Formato: YYYY-MM-DD
        │  Solo si dateOption='custom'
        │
        ├─ imageFile (File | null)
        │  Archivo seleccionado del input file
        │
        └─ imageUrl (string | null)
           URL pública de imagen en Supabase Storage
           Retornada después de uploadImageToStorage()
```

---

## Flujo de Validación de Datos

```
┌────────────────────────────────────────────────────────────┐
│ VALIDACIONES EN FRONTEND - loan-form/app.js               │
└────────────────────────────────────────────────────────────┘

MONTO (tipo 'money'):
  Input event listener (línea 478)
  ┌──────────────────────────────────┐
  │ 1. Extract números: [^\d]/g      │
  │ 2. Si vacío:                     │
  │    - Ocultar botón Continuar     │
  │ 3. Si hay dígitos:               │
  │    - parseInt() → numericValue   │
  │    - Validar > 0                 │
  │    - Formatear con separadores   │
  │    - Mostrar botón Continuar     │
  │    - Guardar raw en formData     │
  └──────────────────────────────────┘

DESCRIPCIÓN (tipo 'object'):
  Input event listener (línea 478)
  ┌──────────────────────────────────┐
  │ 1. trim()                        │
  │ 2. Validar >= 3 caracteres       │
  │ 3. Si válido:                    │
  │    - Mostrar botón Continuar     │
  │    - Guardar en formData         │
  └──────────────────────────────────┘

CONCEPTO (opcional para 'money'):
  Input change listener (línea 518)
  ┌──────────────────────────────────┐
  │ 1. Obtener valor                 │
  │ 2. trim()                        │
  │ 3. Si vacío:                     │
  │    - formData.loanConcept = null │
  │ 4. Si tiene valor:               │
  │    - Guardar en formData         │
  └──────────────────────────────────┘

FECHA:
  Date chip click (línea 532)
  ┌──────────────────────────────────┐
  │ 1. Si 'custom':                  │
  │    - Mostrar input date          │
  │    - Ocultar botón Continuar     │
  │    - Focus en input              │
  │ 2. Si otra opción:               │
  │    - Ocultar custom date input   │
  │    - Mostrar botón Continuar     │
  │                                  │
  │ Change event en custom date:     │
  │    - Guardar en formData         │
  │    - Mostrar botón Continuar     │
  └──────────────────────────────────┘

TELÉFONO (frontend validation):
  validatePhone() función (línea 160)
  ┌──────────────────────────────────┐
  │ 1. Si vacío:                     │
  │    - return true (opcional)      │
  │ 2. Limpiar caracteres especiales │
  │ 3. Regex: /^\+?56\d{9}$/        │
  │    Formato: +56912345678         │
  │ 4. Si válido: true               │
  └──────────────────────────────────┘

EMAIL (frontend validation):
  handleOnboardingSubmit() (línea 152)
  ┌──────────────────────────────────┐
  │ Regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ │
  │ Ejemplos válidos:                │
  │   - user@example.com             │
  │   - test.email@domain.co         │
  └──────────────────────────────────┘

NOMBRES (frontend validation):
  handleOnboardingSubmit() (línea 159)
  ┌──────────────────────────────────┐
  │ Regex: /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$ │
  │ - Solo letras y espacios         │
  │ - Soporta acentos               │
  │ - Soporta ñ/Ñ                   │
  └──────────────────────────────────┘
```

---

## Diagrama de CORS y Headers

```
┌──────────────────────────────────────────────────────────────┐
│ CORS HEADERS - Todos los endpoints Edge Functions           │
└──────────────────────────────────────────────────────────────┘

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  ┌─ Permite requests desde cualquier dominio
  │
  'Access-Control-Allow-Headers': 
    'authorization, x-client-info, apikey, content-type',
  ┌─ Headers permitidas en requests
  │
  'Access-Control-Allow-Methods': 'POST, GET, PATCH, OPTIONS'
  ┌─ Métodos HTTP permitidos
  │
}

OPTIONS request (CORS preflight):
┌────────────────────────────────────────┐
│ Browser envía automáticamente antes    │
│ de PUT, PATCH, DELETE requests         │
│                                        │
│ Server responde con:                   │
│   status: 200                          │
│   headers: corsHeaders                 │
│   body: 'ok'                           │
└────────────────────────────────────────┘
```

