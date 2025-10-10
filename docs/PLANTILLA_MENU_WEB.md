# Plantilla de WhatsApp: Menú Web

## 📋 Información de la Plantilla

**Nombre:** `menu_web_access`
**Categoría:** UTILITY
**Idioma:** Spanish (es)

---

## 📝 Contenido de la Plantilla

> **⚠️ IMPORTANTE:** Esta plantilla DEBE ser categorizada como **UTILITY**, no MARKETING.
> Para evitar que Meta la detecte como marketing, usamos lenguaje transaccional y directo.

### **OPCIÓN 1 - RECOMENDADA** (Más simple y transaccional)

### Header
```
Tu acceso personal
```
**Sin variables** - Más simple evita problemas de categorización

### Body
```
Registra préstamos, ve su estado y gestiona tu información.

Válido por 1 hora.
```
**Sin bullets ni lenguaje promocional** - Directo y transaccional

### Footer
```
(vacío)
```

### Buttons
**Botón 1 - URL dinámica:**
- **Tipo:** URL
- **Texto del botón:** `Ingresar`
- **URL:** `{{1}}`
- **Variable:** URL completa del menú con token

---

### **OPCIÓN 2** (Con personalización)

### Header
```
{{1}}, tu acceso está listo
```
**Variables:**
- `{{1}}` = Nombre del usuario

### Body
```
Registra préstamos, ve su estado y más.

Este link expira en 1 hora.
```

### Footer
```
(vacío)
```

### Buttons
**Botón 1 - URL dinámica:**
- **Tipo:** URL
- **Texto del botón:** `Acceder ahora`
- **URL:** `{{1}}`
- **Variable:** URL completa del menú con token

---

## 🔧 Configuración en Meta Business Manager

### ⚠️ TIPS PARA MANTENER LA CATEGORÍA UTILITY:

1. **Evitar lenguaje promocional:**
   - ❌ "donde puedes", "rápida y segura", "todo desde tu navegador"
   - ✅ "actualiza", "ingresa", "válido por X tiempo"

2. **Ser directo y transaccional:**
   - ❌ Listar beneficios con bullets
   - ✅ Decir qué puede hacer de forma simple

3. **No usar emojis excesivos:**
   - ❌ 👋 💰 📋 🔒 (muchos emojis = marketing)
   - ✅ Sin emojis o máximo 1

4. **Enfocarse en la acción del usuario:**
   - ❌ "Accede a tu menú personal"
   - ✅ "Tu acceso está listo"

---

### Paso 1: Acceder a WhatsApp Manager
1. Ve a [Meta Business Manager](https://business.facebook.com/)
2. Selecciona tu Business Account
3. Ve a **WhatsApp Manager**
4. Click en **Message Templates** (Plantillas de mensajes)

### Paso 2: Crear Nueva Plantilla
1. Click en **Create Template**
2. Completa:
   - **Name:** `menu_web_access`
   - **Category:** `UTILITY` ⚠️ **MUY IMPORTANTE**
   - **Languages:** `Spanish`

### Paso 3: Header (Encabezado)

**Para OPCIÓN 1 (recomendada):**
1. Selecciona **Text** como tipo de header
2. Ingresa exactamente:
   ```
   Tu acceso personal
   ```
3. **SIN variables** (más simple = menos chance de rechazo)

**Para OPCIÓN 2 (con nombre):**
1. Selecciona **Text** como tipo de header
2. Ingresa:
   ```
   {{1}}, tu acceso está listo
   ```
3. Marca la variable `{{1}}` como **Text**
4. Ejemplo: `Juan`

### Paso 4: Body (Cuerpo)

**Para OPCIÓN 1:**
```
Registra préstamos, ve su estado y gestiona tu información.

Válido por 1 hora.
```

**Para OPCIÓN 2:**
```
Registra préstamos, ve su estado y más.

Este link expira en 1 hora.
```

⚠️ **NO agregues bullets, emojis ni lenguaje promocional**

### Paso 5: Footer (Pie de página)
1. **Dejar vacío** o sin marcar "Add a footer"
2. La información de expiración ya está en el body

### Paso 6: Buttons (Botones)
1. Selecciona **Button type:** `Call to action`
2. Click **Add button**
3. Selecciona **Visit website**
4. Configura:
   - **Button text:** `Ingresar` (OPCIÓN 1) o `Acceder ahora` (OPCIÓN 2)
   - **URL type:** `Dynamic`
   - **URL:** `{{1}}`
   - **Example:** `https://hilarious-brigadeiros-9b9834.netlify.app/menu?token=menu_abc123_def456_1234567890`

### Paso 7: Submit para Aprobación
1. Click **Submit**
2. **SI Meta detecta como MARKETING:**
   - Selecciona "Request Review" en el mensaje de alerta
   - Explica: "Esta plantilla es para dar acceso a gestión de cuenta (perfil y datos bancarios), no es contenido promocional"
   - O simplifica más el contenido usando OPCIÓN 1
3. Meta revisará la plantilla (usualmente 1-24 horas)
4. Recibirás notificación cuando esté aprobada

---

## 📤 Vista Previa de la Plantilla

### OPCIÓN 1 (Recomendada - Sin variables)

```
┌────────────────────────────────────┐
│ Tu acceso personal                 │
├────────────────────────────────────┤
│ Registra préstamos, ve su estado  │
│ y gestiona tu información.         │
│                                    │
│ Válido por 1 hora.                 │
├────────────────────────────────────┤
│ [      Ingresar      ]             │
└────────────────────────────────────┘
```

### OPCIÓN 2 (Con personalización)

```
┌────────────────────────────────────┐
│ Juan, tu acceso está listo         │
├────────────────────────────────────┤
│ Registra préstamos, ve su estado   │
│ y más.                             │
│                                    │
│ Este link expira en 1 hora.        │
├────────────────────────────────────┤
│ [    Acceder ahora    ]            │
└────────────────────────────────────┘
```

### ✅ Por qué estas versiones son UTILITY:

1. **Lenguaje transaccional** - "Ingresa", "Actualiza" (acciones directas)
2. **Sin promoción** - No vende beneficios, solo informa qué puede hacer
3. **Específico al usuario** - Acceso a SU información personal
4. **Respuesta a acción** - El usuario solicitó acceso y se le da
5. **Sin emojis excesivos** - Profesional y directo
6. **Información crítica** - Incluye expiración del link (seguridad)

---

## 💻 Uso desde el Código

### Enviar plantilla usando la API de WhatsApp

```typescript
// 1. Generar token del menú
const tokenResponse = await fetch(
  'https://qgjxkszfdoolaxmsupil.supabase.co/functions/v1/generate-menu-token',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_id: tenant.id,
      contact_id: contact.id
    })
  }
);

const { data } = await tokenResponse.json();
const menuUrl = data.url; // URL completa con token

// 2. Enviar plantilla de WhatsApp

// ========== OPCIÓN 1 - SIN VARIABLES EN HEADER ==========
const messagePayload = {
  messaging_product: 'whatsapp',
  to: contact.phone_e164.replace('+', ''),
  type: 'template',
  template: {
    name: 'menu_web_access',
    language: { code: 'es' },
    components: [
      // Solo el botón tiene variable (la URL)
      {
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [
          {
            type: 'text',
            text: menuUrl
          }
        ]
      }
    ]
  }
};

// ========== OPCIÓN 2 - CON VARIABLE EN HEADER ==========
const messagePayloadOption2 = {
  messaging_product: 'whatsapp',
  to: contact.phone_e164.replace('+', ''),
  type: 'template',
  template: {
    name: 'menu_web_access',
    language: { code: 'es' },
    components: [
      {
        type: 'header',
        parameters: [
          {
            type: 'text',
            text: contact.name || 'Usuario'
          }
        ]
      },
      {
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [
          {
            type: 'text',
            text: menuUrl
          }
        ]
      }
    ]
  }
};

// 3. Enviar a WhatsApp API
const response = await fetch(
  `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(messagePayload) // o messagePayloadOption2
  }
);
```

---

## 🎯 Casos de Uso

1. **Bienvenida inicial:** Enviar al crear nuevo contacto
2. **Recordatorio:** Enviar si usuario no completa perfil
3. **Comando manual:** Al escribir "menú" en WhatsApp
4. **Botón en menú:** Agregar opción en el menú principal de WhatsApp

---

## ⚠️ Notas Importantes

1. **Aprobación requerida:** Meta debe aprobar la plantilla antes de usarla
2. **Ventana de 24h:** Las plantillas se usan FUERA de la ventana de 24 horas
3. **Límite de variables:** Máximo 1 variable en header, 0 en body, 1 en cada botón
4. **URL dinámica:** La URL completa (con token) va como variable del botón
5. **Expiración del token:** El token expira en 1 hora (menciónalo en el footer)

---

## 🔍 Troubleshooting

**❌ Meta detecta la plantilla como MARKETING**
- **Causa:** Lenguaje promocional, bullets, emojis excesivos
- **Solución 1:** Usa OPCIÓN 1 (sin variable en header, más simple)
- **Solución 2:** Elimina TODO lenguaje promocional:
  - ❌ "donde puedes", "rápida y segura", "todo desde tu navegador"
  - ✅ "actualiza", "ingresa", "válido por X"
- **Solución 3:** Solicita revisión explicando que es acceso a gestión de cuenta
- **Solución 4:** Verifica que categoría sea UTILITY al crear

**Error: "Template not found"**
- Verifica que el nombre sea exactamente `menu_web_access`
- Confirma que la plantilla esté aprobada en Meta Business
- Revisa que esté en el idioma correcto (Spanish / es)

**Error: "Invalid parameter"**
- Verifica que la URL del botón sea completa (incluya https://)
- Si usas OPCIÓN 2, confirma que el nombre del contacto no esté vacío
- Si usas OPCIÓN 1, asegúrate de NO enviar parámetro de header

**Error: "Template language mismatch"**
- Asegúrate de usar `es` como código de idioma en el código
- Verifica que el idioma esté disponible en tu cuenta de WhatsApp Business
- Confirma que seleccionaste "Spanish" al crear la plantilla

**La plantilla se aprobó pero el mensaje no se envía**
- Verifica que el token de WhatsApp sea válido y no haya expirado
- Confirma que el número de teléfono esté en formato correcto (sin +)
- Revisa los logs de Supabase para ver el error específico
- Usa `usePersonalizedHeader = false` si creaste OPCIÓN 1
- Usa `usePersonalizedHeader = true` si creaste OPCIÓN 2

---

## 📚 Referencias

- [WhatsApp Business Platform - Message Templates](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates)
- [Template Components](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/components)
- [Dynamic URLs](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/dynamic-url)
