# Flujo Completo de Carga de la Aplicación Web desde Link de WhatsApp

## Descripción General
Cuando un usuario hace clic en un link de WhatsApp hacia la aplicación web de SomosPayme, se ejecuta un flujo complejo que incluye:
1. Generación de tokens temporales
2. Validación de sesión
3. Carga de datos del usuario
4. Detección de onboarding pendiente
5. Inicialización de componentes principales
6. Manejo de errores y expiración

---

## FASE 1: GENERACIÓN DEL LINK DE WHATSAPP

### Punto de Origen
El link es generado por el bot de WhatsApp cuando el usuario responde en la conversación.

### Estructura del Token
Hay dos tipos de tokens:
1. **Short Token**: `menu_[tenant_id]_[contact_id]_[timestamp]` (válido 1 hora)
2. **Long-Lived Token (LLT)**: `menu_llt_[tenant_id]_[contact_id]_[uuid]_[timestamp]` (válido 30 días)

### Edge Function: generate-menu-token
**Archivo**: `/data2/presta_bot/supabase/functions/generate-menu-token/index.ts`

**Responsabilidades**:
- Validar que tenant y contact existen
- Generar token según tipo (short o LLT)
- Guardar token en tabla `active_sessions` (para LLT)
- Registrar evento de generación
- Retornar URL: `https://somospayme.cl/menu?token=[TOKEN]`

**Validaciones** (líneas 48-81):
```typescript
// Validar tenant
const { data: tenant } = await supabase
  .from('tenants')
  .select('id')
  .eq('id', tenant_id)
  .single();

// Validar contact
const { data: contact } = await supabase
  .from('tenant_contacts')
  .select('id')
  .eq('id', contact_id)
  .eq('tenant_id', tenant_id)
  .single();
```

**Almacenamiento de Token** (líneas 97-105):
```typescript
// Para LLT, guardar en active_sessions
await supabase
  .from('active_sessions')
  .insert({
    tenant_id: tenant_id,
    contact_id: contact_id,
    token: token,
    token_type: 'llt',
    expires_at: expiresAt.toISOString()
  });
```

---

## FASE 2: CARGA DEL MENÚ - ENTRY POINT

### Archivo HTML Principal
**Archivo**: `/data2/presta_bot/public/menu/index.html`

**Elementos principales** (líneas 1-156):
- DIV raíz: `<div id="root"></div>`
- Script que carga app.js
- Pantallas condicionales:
  - `#expired-screen`: Mostrada si el token es inválido/expirado
  - `#onboarding-screen`: Mostrada si el usuario requiere completar perfil
  - `#welcome-section`: Saludo con nombre del usuario
  - `#main-menu`: Menú de opciones

**Cargas iniciales de JavaScript**:
```html
<script src="app.js"></script>
```

---

## FASE 3: INICIALIZACIÓN DEL APP.JS - MENU

### Archivo: `/data2/presta_bot/public/menu/app.js`

### Estado Global
```javascript
const state = {
    token: null
};
```

### Función init() (líneas 13-35)
**Execución**: Se ejecuta cuando el DOM está listo (DOMContentLoaded)

```javascript
async function init() {
    // 1. Obtener token de URL
    const urlParams = new URLSearchParams(window.location.search);
    state.token = urlParams.get('token');
    
    console.log('Menu initialized', { hasToken: !!state.token });
    
    // 2. Validar sesión
    const isValid = await validateSession();
    
    if (!isValid) {
        showExpiredScreen();
        return;
    }
    
    // 3. Cargar nombre de usuario
    if (state.token) {
        await loadUserName();
    }
    
    // 4. Setup event listeners
    setupEventListeners();
}
```

**Línea de ejecución** (líneas 290-294):
```javascript
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
```

### Paso 1: Extracción de Parámetros
**Función**: `init()` línea 15-16

```javascript
const urlParams = new URLSearchParams(window.location.search);
state.token = urlParams.get('token');
```

URL esperada: `https://somospayme.cl/menu?token=menu_[tenant]_[contact]_[timestamp]`

### Paso 2: Validación de Sesión
**Función**: `validateSession()` (líneas 38-69)

**Endpoint llamado**: 
```javascript
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/menu-data?token=${state.token}&type=user`
);
```

**Validaciones** (líneas 45-68):
- Si no hay token: retorna `false`
- Si status === 401: token inválido o expirado
- Si `data.success === false`: sesión inválida

**Configuración** (línea 7):
```javascript
const SUPABASE_URL = 'https://qgjxkszfdoolaxmsupil.supabase.co';
```

### Paso 3: Manejo de Sesión Inválida
**Función**: `showExpiredScreen()` (líneas 72-82)

```javascript
function showExpiredScreen() {
    const expiredScreen = $('#expired-screen');
    const welcomeSection = $('#welcome-section');
    const mainMenu = $('#main-menu');
    
    // Mostrar pantalla de expiración
    if (expiredScreen) expiredScreen.style.display = 'block';
    // Ocultar resto de contenido
    if (welcomeSection) welcomeSection.style.display = 'none';
    if (mainMenu) mainMenu.style.display = 'none';
}
```

---

## FASE 4: EDGE FUNCTION - MENU-DATA

### Archivo: `/data2/presta_bot/supabase/functions/menu-data/index.ts`

### GET Request para obtener datos de usuario

**Parámetros**:
- `token`: Token del menú (short o LLT)
- `type=user`: Solicitar datos de usuario

**Función**: `parseToken()` (líneas 14-85)

**Soporta dos tipos de token**:

#### Long-Lived Token (LLT)
Formato: `menu_llt_[tenant]_[contact]_[uuid]_[timestamp]`

Validaciones (líneas 19-57):
```typescript
// Validar contra active_sessions
const { data: session, error } = await supabase
  .from('active_sessions')
  .select('*')
  .eq('token', token)
  .eq('revoked', false)
  .single();

// Verificar expiración
const expiresAt = new Date(session.expires_at);
if (expiresAt < new Date()) {
  return null;
}

// Actualizar last_used_at
await supabase
  .from('active_sessions')
  .update({ last_used_at: new Date().toISOString() })
  .eq('id', session.id);
```

#### Short Token
Formato: `menu_[tenant_id]_[contact_id]_[timestamp]`

Validación (líneas 59-75):
```typescript
// Verificar expiración (1 hora)
const now = Date.now();
const tokenAge = now - timestamp;
const oneHour = 60 * 60 * 1000;

if (tokenAge > oneHour) {
  return null;
}
```

### Carga de Datos de Usuario (líneas 123-178)

**Query a database**:
```typescript
const { data: contact } = await supabase
  .from('tenant_contacts')
  .select('name, contact_profile_id')
  .eq('id', tokenData.contact_id)
  .single();
```

**Detección de Onboarding** (líneas 131-143):
```typescript
let requiresOnboarding = false;

if (contact?.contact_profile_id) {
  // Verificar si tiene tenant propio
  const { data: userTenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('owner_contact_profile_id', contact.contact_profile_id)
    .maybeSingle();

  requiresOnboarding = !userTenant;
}
```

**Respuesta** (líneas 169-177):
```typescript
return new Response(JSON.stringify({
  success: true,
  contact_id: tokenData.contact_id,
  name: userName,
  requires_onboarding: requiresOnboarding,
  has_profile_data: hasProfileData
}), {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
});
```

---

## FASE 5: CARGA DE NOMBRE DE USUARIO

### Función: `loadUserName()` (líneas 85-110)

```javascript
async function loadUserName() {
    try {
        const response = await fetch(
            `${SUPABASE_URL}/functions/v1/menu-data?token=${state.token}&type=user`
        );
        const data = await response.json();

        if (data.success) {
            // Detectar si requiere onboarding
            if (data.requires_onboarding) {
                showOnboardingScreen();
                return;
            }

            // Actualizar saludo con nombre
            if (data.name) {
                const greeting = $('#user-greeting');
                if (greeting) {
                    greeting.textContent = `¡Hola ${data.name}! 👋`;
                }
            }
        }
    } catch (error) {
        console.error('Error loading user name:', error);
    }
}
```

---

## FASE 6: DETECCIÓN DE ONBOARDING

Si `data.requires_onboarding === true`:

### Función: `showOnboardingScreen()` (líneas 113-129)

```javascript
function showOnboardingScreen() {
    const onboardingScreen = $('#onboarding-screen');
    const welcomeSection = $('#welcome-section');
    const mainMenu = $('#main-menu');

    if (onboardingScreen) onboardingScreen.style.display = 'block';
    if (welcomeSection) welcomeSection.style.display = 'none';
    if (mainMenu) mainMenu.style.display = 'none';

    // Setup form listener
    const form = $('#onboarding-form');
    if (form) {
        form.addEventListener('submit', handleOnboardingSubmit);
    }
}
```

### Formulario de Onboarding
HTML (líneas 42-95 en index.html):
- Input: `first_name` - Nombre
- Input: `last_name` - Apellido
- Input: `email` - Correo electrónico
- Button: `#btn-complete-onboarding` - Enviar

### Envío de Onboarding
**Función**: `handleOnboardingSubmit()` (líneas 132-203)

**Validaciones**:
1. Campos no vacíos (línea 146-149)
2. Email válido (línea 151-156)
3. Nombres solo letras (línea 158-163)

**Llamada a API**:
```javascript
const response = await fetch(
    `${SUPABASE_URL}/functions/v1/complete-onboarding`,
    {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            token: state.token,
            first_name: firstName,
            last_name: lastName,
            email: email
        })
    }
);
```

---

## FASE 7: EDGE FUNCTION - COMPLETE-ONBOARDING

### Archivo: `/data2/presta_bot/supabase/functions/complete-onboarding/index.ts`

### Flujo de Onboarding (líneas 133-231)

**Paso 1: Obtener tenant_contact** (líneas 136-150):
```typescript
const { data: tenantContact } = await supabase
  .from('tenant_contacts')
  .select('contact_profile_id, name')
  .eq('id', tokenData.contact_id)
  .single();
```

**Paso 2: Verificar si ya tiene tenant** (líneas 156-172):
```typescript
const { data: existingTenant } = await supabase
  .from('tenants')
  .select('id')
  .eq('owner_contact_profile_id', contactProfileId)
  .maybeSingle();

if (existingTenant) {
  return { success: true, already_exists: true };
}
```

**Paso 3: Actualizar contact_profile** (líneas 175-193):
```typescript
const { error: updateError } = await supabase
  .from('contact_profiles')
  .update({
    first_name,
    last_name,
    email
  })
  .eq('id', contactProfileId);
```

**Paso 4: Crear tenant del usuario** (líneas 198-210):
```typescript
const { data: tenantResult } = await supabase
  .rpc('ensure_user_tenant', { 
    p_contact_profile_id: contactProfileId 
  });
```

**Paso 5: Registrar evento** (líneas 216-229):
```typescript
await supabase
  .from('events')
  .insert({
    tenant_id: newTenantId,
    contact_id: tokenData.contact_id,
    event_type: 'onboarding_completed',
    payload: { first_name, last_name, email }
  });
```

---

## FASE 8: CONFIGURACIÓN DE EVENT LISTENERS

### Función: `setupEventListeners()` (líneas 218-242)

**Botones del menú**:

1. **Ver Perfil** (línea 220-223):
```javascript
$('#btn-profile').addEventListener('click', () => {
    handleProfileClick();
});
```

2. **Datos bancarios** (línea 226-229):
```javascript
$('#btn-bank').addEventListener('click', () => {
    handleBankDetailsClick();
});
```

3. **Nuevo préstamo** (línea 232-235):
```javascript
$('#btn-loan').addEventListener('click', () => {
    handleNewLoanClick();
});
```

4. **Estado de préstamos** (línea 238-241):
```javascript
$('#btn-loans-status').addEventListener('click', () => {
    handleLoansStatusClick();
});
```

### Handlers - Redirecciones

**Nuevo Préstamo** (líneas 267-276):
```javascript
function handleNewLoanClick() {
    const loanFormUrl = state.token
        ? `/loan-form?token=${state.token}`
        : '/loan-form';
    window.location.href = loanFormUrl;
}
```

---

## FASE 9: CARGA DEL FORMULARIO DE PRÉSTAMO

### Archivo HTML: `/data2/presta_bot/public/loan-form/index.html`

**Pantallas** (líneas 30-268):
1. **screen-direction**: Seleccionar si presté o me prestaron
2. **screen-who**: Seleccionar contacto
3. **screen-what**: Tipo y monto/descripción del préstamo
4. **screen-when**: Fecha de devolución
5. **screen-confirm**: Confirmación de datos
6. **screen-success**: Pantalla de éxito

### Archivo JavaScript: `/data2/presta_bot/public/loan-form/app.js`

### Estado Global (líneas 1-19):
```javascript
const state = {
    token: null,
    contacts: [],
    loanDirection: null,  // 'lent' o 'borrowed'
    formData: {
        contactId: null,
        contactName: null,
        contactPhone: null,
        newContact: false,
        loanType: null,
        loanDetail: null,
        loanConcept: null,
        dateOption: null,
        customDate: null,
        imageFile: null,
        imageUrl: null
    }
};
```

### Inicialización (líneas 303-324):

```javascript
async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    state.token = urlParams.get('token');

    showLoader(true);

    // Validar sesión
    const isValid = await validateSession();
    showLoader(false);

    if (!isValid) {
        showExpiredScreen();
        return;
    }

    renderContacts();
    setupEventListeners();
}
```

### Validación de Sesión (líneas 257-291):

**Endpoint**: `GET /functions/v1/loan-web-form?token=[TOKEN]`

```javascript
async function validateSession() {
    if (!state.token) {
        return false;
    }

    try {
        const response = await fetch(
            `${SUPABASE_URL}/functions/v1/loan-web-form?token=${state.token}`
        );

        if (response.status === 401) {
            return false;
        }

        const data = await response.json();

        if (!data.success) {
            return false;
        }

        // Guardar contactos cargados
        state.contacts = data.contacts || [];

        return true;
    } catch (error) {
        console.error('Error validating session:', error);
        return false;
    }
}
```

---

## FASE 10: EDGE FUNCTION - LOAN-WEB-FORM

### Archivo: `/data2/presta_bot/supabase/functions/loan-web-form/index.ts`

### GET Request - Obtener Contactos (líneas 197-279)

**Validaciones**:
```typescript
const tokenData = await parseToken(token, supabase);
if (!tokenData) {
    return new Response({ success: false, error: 'Token inválido o expirado' }, 
        { status: 401 }
    );
}
```

**Obtener contactos**:
```typescript
const { data: contacts } = await supabase
  .from('tenant_contacts')
  .select('id, name, contact_profiles(phone_e164)')
  .eq('tenant_id', tokenData.tenantId)
  .neq('id', tokenData.lenderContactId)
  .order('name', { ascending: true })
  .limit(50);
```

**Respuesta**:
```typescript
{
  success: true,
  contacts: [
    { id: '...', name: 'Juan', phone: '+56912345678' }
  ]
}
```

### POST Request - Crear Préstamo (líneas 282-452)

**Payload esperado**:
```javascript
{
    token: state.token,
    contact_id: contactId,  // opcional si new_contact=true
    contact_name: name,
    contact_phone: phone,
    new_contact: boolean,
    loan_type: 'money' | 'object',
    loan_detail: monto | descripción,
    loan_concept: concepto,  // opcional
    date_option: 'tomorrow' | 'week' | 'month-end' | 'custom',
    custom_date: fecha // si date_option='custom'
}
```

**Validación de token** (línea 288):
```typescript
const tokenData = await parseToken(body.token, supabase);
```

**Procesamiento de datos**:

1. Monto (líneas 315-339):
```typescript
if (body.loan_type === 'money') {
  const cleaned = body.loan_detail.replace(/[.,\s]/g, '');
  const parsedAmount = parseInt(cleaned);
  amount = parsedAmount;
  
  itemDescription = body.loan_concept?.trim() 
    ? body.loan_concept.trim()
    : 'Préstamo en efectivo';
}
```

2. Fecha (línea 356):
```typescript
const dueDate = body.custom_date || calculateDate(body.date_option);
```

3. Contexto preparado (líneas 359-394):
```typescript
const context: any = {
  loan_type: body.loan_type,
  due_date: dueDate,
  lender_contact_id: lenderContactId,
  item_description: itemDescription,
  amount: amount
};
```

4. Llamada a FlowHandler (líneas 399-405):
```typescript
const flowHandlers = new FlowHandlers(supabaseUrl, supabaseServiceKey);
const result = await flowHandlers.handleNewLoanFlow(
  tenantId,
  lenderContactId,
  context
);
```

---

## FASE 11: FLUJO DE CREACIÓN DE PRÉSTAMO

### Función: `createLoan()` en app.js (líneas 713-803)

**Payload para Préstamo Otorgado (lent)**:
```javascript
{
    token: state.token,
    contact_id: contactId,
    contact_name: contactName,
    contact_phone: contactPhone,
    new_contact: newContact,
    loan_type: loanType,
    loan_detail: loanDetail,
    loan_concept: loanConcept,
    date_option: dateOption,
    custom_date: calculatedDate
}
```

**Payload para Préstamo Recibido (borrowed)**:
```javascript
{
    token: state.token,
    lender: {
        contact_id: contactId,  // O
        name: contactName,
        phone: contactPhone,
        email: null
    },
    loan: {
        amount: parseInt(loanDetail),
        currency: 'CLP',
        due_date: calculatedDate,
        title: loanConcept || loanDetail,
        description: loanDetail
    }
}
```

### Subida de Imagen Opcional (líneas 772-794)

```javascript
if (imageFile && data.agreement_id) {
    const uploadResult = await uploadImageToStorage(imageFile, data.agreement_id);
    
    // Actualizar préstamo con URL de imagen
    await fetch(LOAN_FORM_ENDPOINT, {
        method: 'PATCH',
        body: JSON.stringify({
            token: state.token,
            agreement_id: data.agreement_id,
            image_url: uploadResult.url
        })
    });
}
```

---

## RESUMEN DEL FLUJO PASO A PASO

### 1. **Usuario hace clic en link de WhatsApp**
   - URL: `https://somospayme.cl/menu?token=menu_[tenant]_[contact]_[timestamp]`

### 2. **Carga index.html del menú**
   - Renderiza estructura HTML
   - Carga app.js

### 3. **app.js - init() se ejecuta**
   - Extrae token del URL
   - Valida sesión llamando a `/functions/v1/menu-data?token=...&type=user`

### 4. **Edge Function menu-data valida token**
   - Parsea token (short o LLT)
   - Verifica expiración
   - Consulta base de datos

### 5. **Si token válido, loadUserName() ejecuta**
   - Obtiene nombre del usuario
   - Detecta si necesita onboarding
   - Actualiza saludo en UI

### 6. **Si requiere onboarding**
   - Muestra formulario de perfil
   - Usuario completa: nombre, apellido, email
   - Envía POST a `/functions/v1/complete-onboarding`

### 7. **Edge Function complete-onboarding**
   - Actualiza contact_profile
   - Crea tenant del usuario
   - Registra evento
   - Retorna success

### 8. **Page recargada, mostrar menú principal**
   - setupEventListeners() configura botones
   - Usuario puede:
     - Ver perfil
     - Datos bancarios
     - Crear nuevo préstamo
     - Ver estado de préstamos

### 9. **Si usuario click "Nuevo préstamo"**
   - Redirige a `/loan-form?token=[TOKEN]`
   - Carga app.js del formulario

### 10. **app.js loan-form - init() ejecuta**
   - Valida sesión
   - Obtiene lista de contactos

### 11. **Flujo del formulario**
   - Selecciona dirección (presté/me prestaron)
   - Selecciona contacto (existente o nuevo)
   - Ingresa datos (tipo, monto/descripción, concepto)
   - Selecciona fecha
   - Confirma datos
   - Sube imagen (opcional)

### 12. **Envío de formulario**
   - POST a `/functions/v1/loan-web-form`
   - Edge function procesa y crea acuerdo
   - Retorna agreement_id

### 13. **Imagen opcional**
   - Si hay imagen, PATCH a `/functions/v1/loan-web-form`
   - Sube a Supabase Storage
   - Actualiza metadata del acuerdo

### 14. **Pantalla de éxito**
   - Muestra resumen del préstamo
   - Botones para:
     - Crear otro préstamo
     - Volver al menú principal

---

## MIDDLEWARE E INTERCEPTORES

### 1. **Validación de Token - app.js (menu)**
Intercepta todas las llamadas API en **init()** línea 21

### 2. **Validación de Token - app.js (loan-form)**
Intercepta carga de formulario en **init()** línea 312

### 3. **CORS Headers**
En todas las edge functions:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, PATCH, OPTIONS',
};
```

### 4. **Manejo de Sesión Expirada**
- Si status 401: mostrar pantalla de expiración
- Si token no válido: mostrar mensaje de error

### 5. **Validación de Datos en Frontend**
- Email regex validation (línea 152 en menu app.js)
- Nombre solo letras (línea 159)
- Teléfono formato chileno (línea 160-163 en loan-form app.js)
- Monto mayor a 0 (línea 505)
- Descripción mínimo 3 caracteres (línea 508)

---

## TABLAS DE BASE DE DATOS INVOLUCRADAS

1. **tenants**: Información del tenant/workspace
2. **tenant_contacts**: Contactos dentro de un tenant
3. **contact_profiles**: Perfiles de usuario compartidos entre tenants
4. **agreements**: Acuerdos/préstamos
5. **active_sessions**: Sesiones y tokens LLT
6. **events**: Registro de eventos del sistema

---

## VARIABLES DE ENTORNO

```
SUPABASE_URL: https://qgjxkszfdoolaxmsupil.supabase.co
SUPABASE_ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NETLIFY_MENU_URL: https://somospayme.cl/menu
NETLIFY_LOAN_FORM_URL: https://somospayme.cl/loan-form
```

---

## CONCLUSIÓN

El flujo es completamente **basado en tokens** sin dependencia de cookies o autenticación de usuario. Cada componente valida independientemente el token en cada solicitud, lo que permite un flujo sin estado (stateless) escalable y seguro.

