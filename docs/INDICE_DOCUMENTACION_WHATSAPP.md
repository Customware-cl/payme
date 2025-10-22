# Índice de Documentación - Flujo de Carga desde WhatsApp

## Archivos Disponibles

```
/data2/presta_bot/docs/
├── INDICE_DOCUMENTACION_WHATSAPP.md     ← ESTÁS AQUÍ
├── README_FLUJO_WEBAPP.md               ← LEER PRIMERO
├── RESUMEN_EJECUTIVO_WEBAPP.md          ← Resumen rápido (10 min)
├── FLUJO_WEBAPP_WHATSAPP.md             ← Detalle completo (40 min)
└── DIAGRAMA_FLUJO_WHATSAPP.md           ← Diagramas visuales (20 min)
```

---

## Mapa de Contenido

### README_FLUJO_WEBAPP.md
**Índice principal y guía rápida**

**Secciones**:
- Documentos disponibles
- Cómo usar la documentación
- Archivos de código referenciados
- Quick reference (URLs y endpoints)
- Flujo rápido (30 segundos)
- Componentes críticos
- Base de datos
- Preguntas frecuentes
- Logs útiles

**Mejor para**: Orientarse, buscar URLs rápidamente, responder preguntas

---

### RESUMEN_EJECUTIVO_WEBAPP.md
**Visión general del flujo (10-15 minutos)**

**Secciones**:
1. Resumen rápido del concepto
2. Tabla de datos clave
3. Archivos principales
4. **14 pasos principales del flujo** (divididos en 4 fases)
5. Componentes críticos (token parsing, validación, CORS)
6. Tablas de base de datos
7. Errores comunes y resolución
8. 5 escenarios de usuario
9. Puntos de entrada clave
10. Configuración requerida

**Mejor para**: Entender rápidamente el flujo, resolver errores, ver escenarios

---

### FLUJO_WEBAPP_WHATSAPP.md
**Documentación completa y detallada (30-40 minutos)**

**Fases documentadas**:
1. **Fase 1**: Generación del link de WhatsApp
   - Edge function: generate-menu-token
   - Estructura del token (short vs LLT)
   - Validaciones y almacenamiento

2. **Fase 2**: Carga del menú - Entry point
   - Archivo HTML principal
   - Estructura de pantallas

3. **Fase 3**: Inicialización del app.js - Menu
   - Estado global
   - Función init()
   - Línea de ejecución
   - Extracción de parámetros (líneas 15-16)
   - Validación de sesión (líneas 38-69)
   - Manejo de sesión inválida

4. **Fase 4**: Edge Function - Menu Data
   - Función parseToken() detallada
   - Soporte para LLT y Short tokens
   - Carga de datos de usuario
   - Respuesta JSON

5. **Fase 5**: Carga de nombre de usuario
   - Función loadUserName()
   - Detección de onboarding

6. **Fase 6**: Detección de Onboarding
   - Función showOnboardingScreen()
   - Formulario HTML
   - Función handleOnboardingSubmit()

7. **Fase 7**: Edge Function - Complete Onboarding
   - Flujo de 5 pasos
   - Obtener tenant_contact
   - Actualizar contact_profile
   - Crear tenant
   - Registrar evento

8. **Fase 8**: Configuración de Event Listeners
   - Función setupEventListeners()
   - 4 botones del menú
   - Handlers y redirecciones

9. **Fase 9**: Carga del Formulario de Préstamo
   - HTML con 5 pantallas
   - Estado global del app.js
   - Función init()
   - Validación de sesión

10. **Fase 10**: Edge Function - Loan Web Form
    - GET request (obtener contactos)
    - POST request (crear préstamo)
    - PATCH request (actualizar imagen)
    - Soporta 3 formatos de token

11. **Fase 11**: Flujo de Creación de Préstamo
    - Función createLoan()
    - Payloads para lent vs borrowed
    - Subida de imagen opcional

**Mejor para**: Implementar cambios, entender detalles, referencias de código

---

### DIAGRAMA_FLUJO_WHATSAPP.md
**Diagramas visuales en ASCII (15-20 minutos)**

**Diagramas incluidos**:
1. **Diagrama General del Flujo Completo**
   - De click en WhatsApp hasta éxito
   - Puntos de decisión (token válido?)
   - Ramas onboarding vs menú

2. **Diagrama del Flujo de Préstamo (Loan Form)**
   - 5 pantallas del formulario
   - Inputs de usuario
   - Validaciones en cada paso
   - API calls
   - Edge function processing

3. **Diagrama de Token Parsing**
   - parseToken() function
   - Detección de formato
   - Validaciones LLT vs Short
   - Output esperado

4. **Diagrama de Estado Global**
   - State object completo
   - Todos los campos
   - Descripción de cada uno
   - Usos en el flujo

5. **Flujo de Validación de Datos**
   - Validaciones por tipo (monto, descripción, email, etc)
   - Regexes específicas
   - Lógica en cada paso

6. **Diagrama de CORS y Headers**
   - corsHeaders estructura
   - OPTIONS request handling
   - Métodos permitidos

**Mejor para**: Visualizar flujo, entender state, validaciones

---

## Búsqueda Rápida por Tema

### Temas Técnicos
| Tema | Ubicación |
|------|-----------|
| Entry point | README (archivo), FLUJO (Fase 2), RESUMEN (punto 2) |
| Token parsing | FLUJO (Fase 4), DIAGRAMA (Token Parsing), RESUMEN (Token Parsing) |
| Onboarding | FLUJO (Fase 6-7), RESUMEN (paso 7-8), DIAGRAMA (Token Parsing) |
| Validaciones | FLUJO (Fase 4,10), DIAGRAMA (Validación), RESUMEN (Validación) |
| CORS | FLUJO (Middleware), DIAGRAMA (CORS), README (CORS) |
| Edge functions | FLUJO (todas las fases), README (endpoints) |
| Base de datos | RESUMEN (Tablas), FLUJO (RPC calls) |
| Préstamo | FLUJO (Fase 11), DIAGRAMA (Préstamo), RESUMEN (paso 14) |

### Temas de Usuario
| Tema | Ubicación |
|------|-----------|
| Usuario nuevo | RESUMEN (Escenario A) |
| Usuario existente | RESUMEN (Escenario B) |
| Crear préstamo dinero | RESUMEN (Escenario C) |
| Crear préstamo objeto | RESUMEN (Escenario D) |
| Token expirado | RESUMEN (Escenario E) |
| Errores | RESUMEN (Tabla de errores) |

### Ubicaciones de Código
| Archivo | Ubicación |
|---------|-----------|
| /public/menu/index.html | FLUJO (Fase 2), DIAGRAMA (Pantallas) |
| /public/menu/app.js | FLUJO (Fase 3,5,6,8), README (Logs) |
| /public/loan-form/index.html | FLUJO (Fase 9) |
| /public/loan-form/app.js | FLUJO (Fase 9,11), DIAGRAMA (Estado) |
| generate-menu-token | FLUJO (Fase 1), RESUMEN (paso 1) |
| menu-data | FLUJO (Fase 4), DIAGRAMA (Token) |
| complete-onboarding | FLUJO (Fase 7), RESUMEN (paso 8) |
| loan-web-form | FLUJO (Fase 10), RESUMEN (paso 14) |

---

## Referencias Cruzadas Rápidas

### Si necesitas entender...

**"¿Cómo se genera el token?"**
- RESUMEN_EJECUTIVO → Paso 1
- FLUJO → Fase 1
- README → Cómo se genera el token (FAQ)

**"¿Qué validaciones hace el frontend?"**
- DIAGRAMA → Flujo de validación de datos
- FLUJO → Fase 10 (POST request)
- README → Validaciones

**"¿Cuándo se activa el onboarding?"**
- FLUJO → Fase 6
- RESUMEN → Paso 6
- DIAGRAMA → Token parsing (requires_onboarding)

**"¿Cómo se crea un préstamo?"**
- FLUJO → Fase 11
- DIAGRAMA → Flujo de préstamo
- RESUMEN → Pasos 12-14

**"¿Qué tablas de BD están involucradas?"**
- RESUMEN → Tabla de base de datos
- FLUJO → Muchas referencias en cada fase
- README → Base de datos (Quick Reference)

**"¿Cuáles son los endpoints de API?"**
- README → Edge Function URLs
- RESUMEN → Puntos de entrada clave
- FLUJO → Fase 1, 4, 7, 10

**"¿Cómo debug si el usuario tiene error?"**
- RESUMEN → Tabla de errores comunes
- README → Logs útiles
- DIAGRAMA → Validaciones

---

## Matriz de Lectura por Rol

### Developer Junior
1. README_FLUJO_WEBAPP (20 min)
2. RESUMEN_EJECUTIVO (15 min)
3. DIAGRAMA_FLUJO (20 min)
4. FLUJO_WEBAPP (40 min)
**Total: 95 minutos**

### Developer Senior
1. README_FLUJO_WEBAPP (10 min - referencias rápidas)
2. FLUJO_WEBAPP (secciones relevantes, 20-30 min)
**Total: 30-40 minutos**

### QA/Tester
1. README_FLUJO_WEBAPP (10 min)
2. RESUMEN_EJECUTIVO (20 min - escenarios)
3. DIAGRAMA_FLUJO (15 min - validaciones)
**Total: 45 minutos**

### Project Manager
1. README_FLUJO_WEBAPP (5 min)
2. RESUMEN_EJECUTIVO (completo, 15 min)
**Total: 20 minutos**

### Architect
1. RESUMEN_EJECUTIVO (componentes críticos, 5 min)
2. FLUJO_WEBAPP (Fase 1, 4, 10, 20 min)
3. DIAGRAMA_FLUJO (Token parsing, estado, 10 min)
**Total: 35 minutos**

---

## Estadísticas

| Métrica | Valor |
|---------|-------|
| Total de documentos | 4 |
| Total de palabras | ~8,000 |
| Total de líneas de código analizadas | 3,171 |
| Edge functions documentadas | 6 |
| Archivo HTML documentados | 2 |
| Archivo JS documentados | 2 |
| Tablas de BD documentadas | 6 |
| Escenarios de usuario | 5 |
| Diagramas ASCII | 6 |
| Referencias de código | 150+ |

---

## Convenciones Usadas

### Formato de Referencias
```
Función: nombreFuncion() - línea X-Y
Archivo: /ruta/archivo.js
Endpoint: GET /functions/v1/endpoint?params=value
Tabla: table_name (campo1, campo2)
```

### Formatos de Tokens
```
Short: menu_[tenant_id]_[contact_id]_[timestamp]
LLT: menu_llt_[tenant_id]_[contact_id]_[uuid]_[timestamp]
Loan Web: loan_web_[tenant_id]_[lender_contact_id]_[timestamp]
```

### Símbolos Usados
```
┌─ Indica comienzo de estructura
├─ Continuación de estructura
└─ Fin de estructura
▼ Indica siguiente paso
│ Línea de flujo
→ Resultado o continuación
✓ Completado
✗ Error o no completado
```

---

## Próximas Actualizaciones

Cuando se realicen cambios en el código:

1. Actualizar FLUJO_WEBAPP_WHATSAPP.md con nuevas fases/cambios
2. Actualizar DIAGRAMA_FLUJO_WHATSAPP.md si cambia lógica
3. Actualizar RESUMEN_EJECUTIVO_WEBAPP.md si cambian pasos principales
4. Mantener README_FLUJO_WEBAPP.md como índice
5. Registrar cambios en CHANGELOG.md

---

## Cómo Contribuir a la Documentación

Si encuentras:
- **Error**: Actualizar la sección relevante
- **Ambigüedad**: Aclarar con más detalles
- **Código desactualizado**: Verificar con fuente y actualizar
- **Diagrama confuso**: Recrear o simplificar
- **Falta algo**: Agregar nueva sección

---

**Última actualización**: Octubre 21, 2024
**Versión**: 1.0
**Estado**: Completa

