# Documentación Completa - Flujo de Carga de Aplicación Web desde WhatsApp

Este directorio contiene la documentación completa del flujo de carga de la aplicación web de SomosPayme cuando un usuario hace clic en un link de WhatsApp.

## Documentos Disponibles

### 1. RESUMEN_EJECUTIVO_WEBAPP.md
**Leer esto primero**

Resumen ejecutivo con:
- Descripción general del flujo
- 14 pasos principales
- Componentes críticos
- Tabla de errores comunes
- Escenarios de usuario

**Tiempo de lectura**: 10 minutos

---

### 2. FLUJO_WEBAPP_WHATSAPP.md
**Guía completa y detallada**

Análisis profundo con:
- 11 fases del flujo
- Referencias específicas a archivos y líneas de código
- Edge functions detalladas
- Validaciones en frontend y backend
- Tablas de base de datos
- Middleware e interceptores
- Variables de entorno

**Tiempo de lectura**: 30-40 minutos

**Secciones principales**:
- Fase 1: Generación del link de WhatsApp
- Fase 2: Carga del menú
- Fase 3: Inicialización de app.js
- Fase 4: Edge Function menu-data
- Fase 5: Carga de nombre de usuario
- Fase 6: Detección de onboarding
- Fase 7: Edge Function complete-onboarding
- Fase 8: Configuración de event listeners
- Fase 9: Carga del formulario de préstamo
- Fase 10: Edge Function loan-web-form
- Fase 11: Flujo de creación de préstamo

---

### 3. DIAGRAMA_FLUJO_WHATSAPP.md
**Diagramas visuales en ASCII**

Diagramas de:
- Flujo general completo
- Flujo del formulario de préstamo
- Token parsing
- Estado global del formulario
- Validaciones de datos
- CORS y headers

**Tiempo de lectura**: 15-20 minutos

---

## Cómo Usar Esta Documentación

### Para entender rápidamente el flujo:
1. Lee RESUMEN_EJECUTIVO_WEBAPP.md (10 min)
2. Consulta los escenarios de usuario

### Para implementar cambios:
1. Lee FLUJO_WEBAPP_WHATSAPP.md sección relevante
2. Consulta DIAGRAMA_FLUJO_WHATSAPP.md para visualizar
3. Busca referencias a líneas específicas de código

### Para depurar problemas:
1. Lee tabla de errores en RESUMEN_EJECUTIVO_WEBAPP.md
2. Consulta validaciones en DIAGRAMA_FLUJO_WHATSAPP.md
3. Lee Edge Function específica en FLUJO_WEBAPP_WHATSAPP.md

---

## Archivos de Código Referenciados

### Frontend (Vanilla JavaScript)
```
/public/menu/
  ├── index.html
  └── app.js

/public/loan-form/
  ├── index.html
  └── app.js
```

### Backend (Edge Functions - Deno/TypeScript)
```
/supabase/functions/
  ├── generate-menu-token/index.ts
  ├── menu-data/index.ts
  ├── complete-onboarding/index.ts
  ├── loan-web-form/index.ts
  ├── create-received-loan/index.ts
  └── generate-loan-web-link/index.ts
```

---

## Quick Reference - URLs y Endpoints

### Frontend URLs
| URL | Descripción |
|-----|-------------|
| `https://somospayme.cl/menu?token=...` | Menú principal |
| `https://somospayme.cl/loan-form?token=...` | Formulario de préstamo |
| `https://somospayme.cl/menu/profile.html?token=...` | Perfil de usuario |
| `https://somospayme.cl/menu/bank-details.html?token=...` | Datos bancarios |
| `https://somospayme.cl/menu/loans.html?token=...` | Estado de préstamos |

### Edge Function URLs
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/functions/v1/generate-menu-token` | Generar token de menú |
| GET | `/functions/v1/menu-data?token=...&type=user` | Obtener datos de usuario |
| POST | `/functions/v1/complete-onboarding` | Completar perfil |
| GET | `/functions/v1/loan-web-form?token=...` | Obtener contactos |
| POST | `/functions/v1/loan-web-form` | Crear préstamo |
| PATCH | `/functions/v1/loan-web-form` | Actualizar imagen |

---

## Flujo Rápido (30 segundos)

```
1. Usuario hace clic en link WhatsApp
2. Navegador carga /public/menu/index.html
3. app.js extrae token de URL
4. Frontend valida token con GET /menu-data
5. Si token válido:
   - Si requiere onboarding: mostrar formulario
   - Si no requiere: mostrar menú principal
6. Usuario click "Nuevo préstamo"
7. Redirige a /loan-form?token=...
8. Usuario completa 5 pantallas
9. Frontend POST a /loan-web-form con datos
10. Backend crea agreement en DB
11. Mostrar pantalla de éxito
```

---

## Componentes Críticos

### Token Parsing
- **Función**: `parseToken(token, supabase)`
- **Ubicación**: Cada edge function
- **Soporta**: 3 formatos (menu short, menu LLT, loan web)
- **Validaciones**: expiración, revoke, formato

### Validaciones
- **Frontend**: Email, teléfono, monto, nombres
- **Backend**: Token, datos de entrada, lógica de negocio
- **CORS**: Permitir todos los orígenes

### Interceptores
- **Frontend**: Cada fetch() pasa token en URL, maneja 401
- **Backend**: Valida token primero en cada función

---

## Base de Datos - Tablas Principales

| Tabla | Propósito |
|-------|----------|
| `tenants` | Workspace del usuario |
| `tenant_contacts` | Contactos dentro de tenant |
| `contact_profiles` | Perfil compartido |
| `agreements` | Préstamos creados |
| `active_sessions` | Sesiones LLT |
| `events` | Audit trail |

---

## Preguntas Frecuentes

### ¿Cómo se genera el token?
El bot de WhatsApp llama a `generate-menu-token` edge function, que retorna una URL con el token.

### ¿Cuánto dura el token?
- **Short**: 1 hora
- **LLT**: 30 días (y se registra en DB)

### ¿Qué pasa si el token expira?
Mostrar pantalla "Este enlace ha expirado" y usuario debe pedir nuevo link en WhatsApp.

### ¿Se requiere autenticación?
No. Solo se usa el token temporal. No hay login tradicional.

### ¿Cómo se validan los datos?
- Frontend: Regex y validaciones básicas
- Backend: Validaciones nuevamente + lógica de negocio

### ¿Se pueden revocar tokens?
Sí, pero solo para LLT (actualizar `active_sessions.revoked = true`)

### ¿Qué sucede si se pierde el token?
Usuario debe hacer clic en el link de WhatsApp nuevamente

---

## Logs Útiles

### Frontend Console (Chrome DevTools)
```javascript
console.log('Menu initialized', { hasToken: !!state.token })
console.log('Session validated successfully')
console.log('[LOAN_WEB_FORM] Token parsed:', tokenData)
```

### Backend Logs (Supabase Functions)
```
[ONBOARDING] Starting onboarding for contact: ...
[MENU_DATA] User check: { requires_onboarding: true }
[LOAN_WEB_FORM] POST request received: { ... }
[LOAN_WEB_FORM] Loan created successfully: { agreement_id }
```

---

## Cambios Recientes (Octubre 2024)

Ver CHANGELOG.md en el repositorio raíz para historial completo de cambios.

---

## Contacto y Soporte

Para preguntas sobre este flujo:
1. Revisar documentación relevante (FLUJO_WEBAPP_WHATSAPP.md)
2. Consultar referencia de código específica
3. Ver tabla de errores comunes

---

**Última actualización**: Octubre 21, 2024
**Versión de documentación**: 1.0
**Estado**: Completa y detallada

