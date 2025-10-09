# Plantilla de WhatsApp: Menú Web

## 📋 Información de la Plantilla

**Nombre:** `menu_web_access`
**Categoría:** UTILITY
**Idioma:** Spanish (es)

---

## 📝 Contenido de la Plantilla

### Header
```
¡Hola {{1}}! 👋
```
**Variables:**
- `{{1}}` = Nombre del usuario

### Body
```
Accede a tu menú personal de PrestaBot donde puedes:

• Ver y editar tu perfil
• Gestionar tus datos bancarios
• Crear nuevos préstamos

Todo de forma rápida y segura desde tu navegador.
```

### Footer
```
🔒 Link válido por 1 hora
```

### Buttons
**Botón 1 - URL dinámica:**
- **Tipo:** URL
- **Texto del botón:** `Abrir Menú`
- **URL:** `{{1}}`
- **Variable:** URL completa del menú con token

---

## 🔧 Configuración en Meta Business Manager

### Paso 1: Acceder a WhatsApp Manager
1. Ve a [Meta Business Manager](https://business.facebook.com/)
2. Selecciona tu Business Account
3. Ve a **WhatsApp Manager**
4. Click en **Message Templates** (Plantillas de mensajes)

### Paso 2: Crear Nueva Plantilla
1. Click en **Create Template**
2. Completa:
   - **Name:** `menu_web_access`
   - **Category:** `UTILITY`
   - **Languages:** `Spanish`

### Paso 3: Header (Encabezado)
1. Selecciona **Text** como tipo de header
2. Ingresa:
   ```
   ¡Hola {{1}}! 👋
   ```
3. Marca la variable `{{1}}` como **Text**
4. Ejemplo: `Juan`

### Paso 4: Body (Cuerpo)
1. Ingresa el texto del body (copiar de arriba)
2. **NO uses variables en el body** (WhatsApp limita variables)

### Paso 5: Footer (Pie de página)
1. Marca checkbox **Add a footer**
2. Ingresa:
   ```
   🔒 Link válido por 1 hora
   ```

### Paso 6: Buttons (Botones)
1. Selecciona **Button type:** `Call to action`
2. Click **Add button**
3. Selecciona **Visit website**
4. Configura:
   - **Button text:** `Abrir Menú`
   - **URL type:** `Dynamic`
   - **URL:** `{{1}}`
   - **Example:** `https://hilarious-brigadeiros-9b9834.netlify.app/menu?token=menu_abc123_def456_1234567890`

### Paso 7: Submit para Aprobación
1. Click **Submit**
2. Meta revisará la plantilla (usualmente 1-24 horas)
3. Recibirás notificación cuando esté aprobada

---

## 📤 Vista Previa de la Plantilla

```
┌────────────────────────────────────┐
│ ¡Hola Juan! 👋                     │
├────────────────────────────────────┤
│ Accede a tu menú personal de       │
│ PrestaBot donde puedes:            │
│                                    │
│ • Ver y editar tu perfil           │
│ • Gestionar tus datos bancarios    │
│ • Crear nuevos préstamos           │
│                                    │
│ Todo de forma rápida y segura      │
│ desde tu navegador.                │
├────────────────────────────────────┤
│ 🔒 Link válido por 1 hora          │
├────────────────────────────────────┤
│ [     Abrir Menú     ]             │
└────────────────────────────────────┘
```

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
const messagePayload = {
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
    body: JSON.stringify(messagePayload)
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

**Error: "Template not found"**
- Verifica que el nombre sea exactamente `menu_web_access`
- Confirma que la plantilla esté aprobada en Meta Business

**Error: "Invalid parameter"**
- Verifica que la URL del botón sea completa (incluya https://)
- Confirma que el nombre del contacto no esté vacío

**Error: "Template language mismatch"**
- Asegúrate de usar `es` como código de idioma
- Verifica que el idioma esté disponible en tu cuenta de WhatsApp Business

---

## 📚 Referencias

- [WhatsApp Business Platform - Message Templates](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates)
- [Template Components](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/components)
- [Dynamic URLs](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/dynamic-url)
