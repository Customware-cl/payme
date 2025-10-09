# Changelog

Todos los cambios notables del proyecto serán documentados en este archivo.

## [2025-10-09] - Corrección: Comando "estado" ahora muestra préstamos pendientes

### 🐛 Corregido
- **Problema:** Préstamos creados no aparecían al escribir "estado" en WhatsApp
- **Causa raíz:** El comando filtraba solo préstamos con `status = 'active'`, excluyendo los que están en `'pending_confirmation'`
- **Solución:** Cambiar filtro de `.eq('status', 'active')` a `.in('status', ['active', 'pending_confirmation'])`
- **Impacto:** Ahora los usuarios pueden ver:
  - Préstamos activos y confirmados
  - Préstamos pendientes esperando confirmación del prestatario
- **Archivo:** `supabase/functions/wa_webhook/index.ts` (líneas 312, 319, 648, 655)

### 📦 Deploy Info
- **Edge Function actualizada:** `wa_webhook`
  - Script size: 137.3kB
  - Estado: ✅ Desplegado correctamente
  - Comando: `npx supabase functions deploy wa_webhook --no-verify-jwt`

### 💡 Contexto
Los préstamos tienen estado `'pending_confirmation'` cuando:
- Se crean desde el formulario web
- Esperan que el prestatario confirme en WhatsApp
- No han sido rechazados ni completados

---

## [2025-10-09] - Mejora UX: Indicador visual para préstamos pendientes

### ✨ Añadido
- **Indicador de estado pendiente en comando "estado" y botón "check_status"**
  - Los préstamos con estado `pending_confirmation` ahora muestran el indicador: `⏳ _Pendiente de confirmación_`
  - Aplicado a ambas secciones:
    - 💰 Préstamos que hiciste (lent agreements)
    - 📥 Préstamos que te hicieron (borrowed agreements)
  - Aplicado a ambos flujos:
    - Comando de texto: "estado" / "status"
    - Botón interactivo: "check_status"

### 🎨 Formato del Indicador
```
1. A *Juan Pérez*: $50.000
   Vence: 15 Oct 2025
   Monto: $50.000
   ⏳ _Pendiente de confirmación_
```

### 🔄 Modificado
- **`wa_webhook/index.ts`**:
  - Comando "estado" - préstamos hechos (líneas 329-348)
  - Comando "estado" - préstamos recibidos (líneas 350-369)
  - Botón "check_status" - préstamos hechos (líneas 977-996)
  - Botón "check_status" - préstamos recibidos (líneas 998-1017)
  - Patrón aplicado: `const isPending = agreement.status === 'pending_confirmation';`
  - Visualización: `if (isPending) { statusText += '   ⏳ _Pendiente de confirmación_\n'; }`

### 💡 Impacto
- Mayor claridad para los usuarios sobre el estado de sus préstamos
- Diferenciación visual entre préstamos activos y pendientes de confirmación
- Consistencia entre todos los puntos de acceso al estado (texto y botón)

### 📦 Deploy Info
- **Edge Function actualizada:** `wa_webhook`
  - Script size: 137.4kB
  - Estado: ✅ Desplegado correctamente
  - Comando: `npx supabase functions deploy wa_webhook --no-verify-jwt`
  - Dashboard: https://supabase.com/dashboard/project/qgjxkszfdoolaxmsupil/functions

---

## [2025-10-09] - Mejora UX: Formato automático de monto

### ✨ Añadido
- **Formato automático de monto en formulario web**
  - El campo de monto ahora formatea automáticamente mientras escribes
  - Formato chileno: `$50.000` con separador de miles (punto)
  - Símbolo $ se agrega automáticamente
  - Placeholder actualizado: "Ej: $50.000"
  - Hint: "Se formateará automáticamente"
  - El valor se guarda sin formato internamente para procesamiento
  - Archivo: `public/loan-form/app.js` (líneas 257-295)

### 📦 Deploy Info
- **Frontend actualizado en Netlify:**
  - Deploy ID: `68e81dc3b036c64a0710f2d4`
  - URL: https://hilarious-brigadeiros-9b9834.netlify.app
  - Estado: ✅ Live

---

## [2025-10-09] - Correcciones críticas: Token WhatsApp y formulario web

### 🐛 Corregido

#### 1. Token de WhatsApp expirado
- **Problema:** El bot no respondía mensajes (HTTP 401, "Session has expired")
- **Causa raíz:** Token almacenado en DOS lugares, solo se actualizó uno
- **Solución:** Actualizar token en ambos lugares:
  1. ✅ Supabase Secrets: `WHATSAPP_ACCESS_TOKEN`
  2. ✅ Tabla `tenants`: columna `whatsapp_access_token`
- **Lección:** Ambos tokens deben estar sincronizados para que el bot funcione
- **Archivos:** Base de datos + Supabase Secrets

#### 2. Formulario web no mostraba contactos
- **Problema:** El formulario retornaba HTTP 401 sin logs, contactos no aparecían
- **Causas múltiples identificadas:**

  **a) Filtro de opt_in_status incorrecto**
  - Buscaba `opt_in_status = 'subscribed'` pero todos los contactos tienen `'pending'`
  - Solución: Eliminado filtro de `opt_in_status`
  - Archivo: `supabase/functions/loan-web-form/index.ts` (línea 151)

  **b) URL incorrecta en frontend**
  - Frontend llamaba: `/functions/v1/loan-web-form/contacts?token=xxx`
  - Edge Functions no soportan sub-paths así
  - Solución: Corregido a `/functions/v1/loan-web-form?token=xxx`
  - Archivo: `public/loan-form/app.js` (línea 127)

  **c) JWT verification bloqueando peticiones públicas (CRÍTICO)**
  - Edge Function requería JWT por defecto
  - Navegador no envía JWT (llamada pública)
  - Resultado: HTTP 401, sin logs en función
  - Solución: Deploy con `--no-verify-jwt`
  - Comando: `npx supabase functions deploy loan-web-form --no-verify-jwt`
  - Mismo fix que se aplicó a `wa_webhook`

### 📦 Deploy Info

- **Edge Function actualizada:** `loan-web-form` v9
  - Estado: ✅ Desplegado correctamente
  - Script size: 88.83kB
  - Cambios: Filtro eliminado + routing mejorado + logging detallado
  - Flag crítico: `--no-verify-jwt` habilitado

- **Frontend actualizado en Netlify:**
  - Deploy ID: `68e81437a4424a23b71c19b7`
  - URL corregida para llamar a Edge Function
  - Estado: ✅ Funcionando correctamente

- **Edge Function:** `wa_webhook` v2.0.2
  - Re-deployado con token actualizado
  - Estado: ✅ Bot responde correctamente

### ✅ Estado Final
- ✅ Bot de WhatsApp responde correctamente
- ✅ Formulario web carga contactos (3 contactos visibles)
- ✅ Flujo completo funcional: WhatsApp → Link → Formulario → Creación de préstamo

---

## [2025-10-08] - Integración Completa: WhatsApp → Formulario Web

### ✨ Añadido
- **Botón "Formulario Web" en WhatsApp**
  - Al presionar "💰 Nuevo préstamo" ahora aparecen dos opciones:
    - 💬 Por WhatsApp (flujo conversacional)
    - 🌐 Formulario web (link al formulario en Netlify)

- **Generación automática de links personalizados**
  - Cada usuario recibe un link único y temporal
  - El link incluye token con: `tenant_id`, `contact_id` (prestador), `timestamp`
  - Expiración automática: 1 hora
  - Formato: `https://hilarious-brigadeiros-9b9834.netlify.app/loan-form?token=xxx`

### 🔄 Modificado
- **`wa_webhook/index.ts`**:
  - Nuevo caso `new_loan`: muestra selector de método (WhatsApp vs Web)
  - Nuevo caso `new_loan_chat`: inicia flujo conversacional (código anterior)
  - Nuevo caso `new_loan_web`: llama a `generate-loan-web-link` y envía URL
  - Mensajes personalizados con instrucciones claras

### 🚀 Flujo Completo
```
Usuario en WhatsApp → "💰 Nuevo préstamo"
     ↓
Bot muestra 2 opciones:
  1. 💬 Por WhatsApp
  2. 🌐 Formulario web
     ↓
Usuario elige "🌐 Formulario web"
     ↓
Bot llama a generate-loan-web-link (Supabase)
     ↓
Edge Function genera token y URL de Netlify
     ↓
Bot envía link al usuario
     ↓
Usuario abre formulario en navegador
     ↓
Formulario carga contactos del tenant
     ↓
Usuario completa 5 pantallas
     ↓
Formulario envía a loan-web-form (Supabase)
     ↓
Edge Function crea préstamo en DB
     ↓
✅ Préstamo creado
```

### 📦 Deploy Info
- **Webhook actualizado:** `wa_webhook` desplegado
  - Script size: 137.2kB
  - Runtime: Deno edge-runtime v1.69.12
  - Estado: ✅ Desplegado correctamente

---

## [2025-10-08] - Despliegue en Netlify

### ✨ Añadido
- **Configuración de despliegue en Netlify** para hosting del frontend y formulario web
  - Proyecto vinculado: `hilarious-brigadeiros-9b9834`
  - URL principal: https://hilarious-brigadeiros-9b9834.netlify.app
  - URL formulario de préstamos: https://hilarious-brigadeiros-9b9834.netlify.app/loan-form

### 🏗️ Configuración
- **Archivo `netlify.toml`** creado con:
  - Build command: `npm run build && cp -r public/loan-form dist/`
  - Publish directory: `dist`
  - Redirects configurados para SPA routing
  - Redirect específico para `/loan-form/*`
  - Node.js version: 18

### 🔐 Variables de Entorno
- **VITE_API_URL** configurada apuntando a Supabase
  - Valor: `https://qgjxkszfdoolaxmsupil.supabase.co`
  - Scopes: builds, functions
  - Contexto: all (development, deploy-preview, production)

### 📦 Estructura de Despliegue
- **Frontend React** (compilado con Vite) → raíz del sitio (Netlify)
- **Formulario de préstamos** (estático) → `/loan-form` (Netlify)
- **Edge Functions** (backend) → Supabase
- Arquitectura híbrida: Frontend en Netlify + Backend en Supabase

### 🔄 Modificado
- **`generate-loan-web-link/index.ts`**:
  - URLs generadas apuntan a Netlify en lugar de Supabase Storage
  - Variable de entorno `NETLIFY_LOAN_FORM_URL` con fallback hardcoded
  - Formato: `https://hilarious-brigadeiros-9b9834.netlify.app/loan-form?token=xxx`

- **`public/loan-form/app.js`**:
  - Configuración de API apunta a Supabase Edge Functions
  - URLs: `https://qgjxkszfdoolaxmsupil.supabase.co/functions/v1/loan-web-form`
  - CORS habilitado entre dominios (Netlify → Supabase)

### 🚀 Deploy Info
- **Primer despliegue:** Deploy ID: `68e719b86ada39ca8f6084f7`
  - Estado: ✅ Ready
  - Tiempo de build: 30 segundos

- **Segundo despliegue (correcciones):** Deploy ID: `68e71b415fb9e6cf62bf6df2`
  - Estado: ✅ Ready
  - Tiempo de build: 25 segundos
  - 1 archivo actualizado (app.js corregido)

- **Edge Function actualizada:** `generate-loan-web-link` v2
  - Estado: ACTIVE
  - Versión: 2
  - Desplegada en Supabase

### 🔗 Flujo Completo (WhatsApp → Netlify → Supabase)
1. Usuario en WhatsApp solicita crear préstamo
2. Bot llama a `generate-loan-web-link` (Supabase)
3. Genera token temporal y URL de Netlify
4. Usuario abre URL: `https://hilarious-brigadeiros-9b9834.netlify.app/loan-form?token=xxx`
5. Formulario (Netlify) llama a `loan-web-form` (Supabase) para obtener contactos
6. Usuario completa formulario
7. Formulario envía datos a `loan-web-form` (Supabase)
8. Edge Function crea préstamo en DB usando FlowHandlers

---

## [2025-10-08] - Formulario Web para Préstamos (Sistema Standalone)

### ✨ Añadido
- **Formulario web mobile-first** para crear préstamos de forma visual
  - 5 pantallas secuenciales (¿Quién? → ¿Qué? → ¿Cuándo? → Confirmación → Éxito)
  - Diseño minimalista <50KB total
  - Soporte para contactos existentes y nuevos
  - Opciones de fecha rápidas: Mañana, En una semana, A fin de mes, Fecha específica
  - Tipos de préstamo: Dinero (💰) o Un objeto (📦)

- **Nueva Edge Function** `generate-loan-web-link` (Standalone)
  - **NO modifica `wa_webhook`** - Función completamente independiente
  - Endpoint POST - Genera links temporales seguros
  - Validación de tenant y contact
  - Registra evento `web_form_link_generated`
  - Token format: `loan_web_[tenant_id]_[lender_contact_id]_[timestamp]`
  - Response incluye URL, token, tiempo de expiración (1 hora)

- **Nueva Edge Function** `loan-web-form` (Procesador)
  - Endpoint GET `/contacts?token=xxx` - Obtiene lista de contactos del tenant
  - Endpoint POST - Crea préstamo validando token temporal
  - Seguridad: Token con expiración de 1 hora
  - Integración con `FlowHandlers` existentes

### 🏗️ Arquitectura
- **Sistema Standalone:** No requiere modificaciones al webhook existente
- **Modularidad:** Componentes independientes y reutilizables
- **Flexibilidad:** Puede integrarse desde múltiples fuentes:
  - Web App Admin Panel
  - API REST (futura)
  - WhatsApp (opcional, sin modificar webhook actual)
  - Cualquier cliente que necesite generar links de préstamos

### 📁 Archivos Creados
- `public/loan-form/index.html` - SPA con 5 pantallas
- `public/loan-form/styles.css` - Estilos mobile-first (~15KB)
- `public/loan-form/app.js` - Lógica vanilla JavaScript (~20KB)
- `supabase/functions/generate-loan-web-link/index.ts` - Edge Function generadora (STANDALONE)
- `supabase/functions/loan-web-form/index.ts` - Edge Function procesadora
- `docs/FORMULARIO_WEB_PRESTAMOS.md` - Documentación completa

### 🔄 Modificado
- **NINGUNO** - El sistema es completamente independiente
- `wa_webhook/index.ts` - **SIN CAMBIOS** (se mantiene estable)

### 🚀 Deployment Pendiente
Los siguientes pasos deben completarse manualmente:

1. **Crear bucket en Storage** (público):
   - Dashboard Supabase → Storage → New bucket
   - Nombre: `loan-form`
   - Public bucket: ✓ Yes

2. **Subir archivos del formulario**:
   - Subir `public/loan-form/index.html` → `loan-form/index.html`
   - Subir `public/loan-form/styles.css` → `loan-form/styles.css`
   - Subir `public/loan-form/app.js` → `loan-form/app.js`

3. **Deploy Edge Functions** (desde Dashboard o CLI):
   ```bash
   # Opción A: Dashboard Supabase
   # Edge Functions → Deploy new function
   # 1. generate-loan-web-link (copiar contenido de generate-loan-web-link/index.ts)
   # 2. loan-web-form (copiar contenido de loan-web-form/index.ts + _shared/)

   # Opción B: Supabase CLI (recomendado)
   npx supabase functions deploy generate-loan-web-link
   npx supabase functions deploy loan-web-form
   ```

4. **Configurar política de Storage**:
   ```sql
   CREATE POLICY "Public access to loan-form"
   ON storage.objects FOR SELECT
   USING (bucket_id = 'loan-form');
   ```

### 📊 Métricas Esperadas
- **Completion Rate**: >75% (formulario web)
- **Time to Complete**: <60 segundos
- **Error Rate**: <8%
- **User Preference**: ~30% elegirán formulario web

### 🔗 Referencias
- Documentación completa: `docs/FORMULARIO_WEB_PRESTAMOS.md`
- Arquitectura: Triple opción (Flow + Web + Conversacional)
- Stack: HTML/CSS/JS vanilla, Supabase Edge Functions, Supabase Storage

---

## [2025-10-03] - WhatsApp Flows con Encriptación AES-128-GCM

### ✨ Añadido
- Implementación de WhatsApp Flows con encriptación AES-128-GCM
- Flow para gestión de perfil de usuario
- Flow para gestión de cuentas bancarias
- Sistema de auto-creación de contact_profile si no existe

### 🔄 Modificado
- Sistema de encriptación RSA-OAEP + AES-GCM
- Validación y procesamiento de flows encriptados

---

*Formato basado en [Keep a Changelog](https://keepachangelog.com/)*
