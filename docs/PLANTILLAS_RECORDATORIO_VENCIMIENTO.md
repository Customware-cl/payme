# Plantillas de WhatsApp: Recordatorio de Vencimiento

## 📋 Información de las Plantillas

Este documento describe DOS plantillas de recordatorio de vencimiento con botones interactivos.

---

## 🎯 Plantilla 1: Recordatorio de Dinero

**Nombre:** `due_date_money_v1`
**Categoría:** UTILITY
**Idioma:** Spanish (es)
**Variables:** 12 (11 en body + 1 en botón URL)

### Header
```
Tienes un préstamo por vencer
```
**Sin variables** - Texto fijo

### Body
```
¡{{1}}! 👋 Hoy vence un préstamo que te hizo *{{3}}* el día *{{4}}*.

Monto: *{{2}}*
Concepto: _"{{5}}"_.

📋 *Datos de transferencia:*
```Nombre: {{6}}
RUT: {{7}}
Banco: {{8}}
Tipo: {{9}}
Cuenta: {{10}}
Email: {{11}}```

¿Todo listo para devolver? ✅
```

**Variables del Body (11):**
- `{{1}}` = Nombre del borrower (de su perfil)
- `{{2}}` = Monto formateado (ej: "$50.000")
- `{{3}}` = Nombre del lender (alias del contacto)
- `{{4}}` = Fecha de creación (ej: "14/10/25")
- `{{5}}` = Concepto/descripción del préstamo
- `{{6}}` = Nombre completo del lender (de su perfil)
- `{{7}}` = RUT del lender (ej: "17.029.236-7")
- `{{8}}` = Banco (ej: "Santander")
- `{{9}}` = Tipo de cuenta (ej: "Cuenta Corriente")
- `{{10}}` = Número de cuenta
- `{{11}}` = Email del lender

### Footer
```
(vacío)
```

### Buttons

**Botón 1 - Quick Reply:**
- **Tipo:** Quick Reply
- **Texto:** `Marcar como devuelto`
- **Payload:** Automático (se genera en el backend)

**Botón 2 - URL dinámica:**
- **Tipo:** URL
- **Texto:** `Ver otras opciones`
- **URL:** `{{12}}`
- **Variable:** URL completa al detalle del préstamo

---

## 📦 Plantilla 2: Recordatorio de Objeto

**Nombre:** `due_date_object_v1`
**Categoría:** UTILITY
**Idioma:** Spanish (es)
**Variables:** 6 (5 en body + 1 en botón URL)

### Header
```
Tienes un préstamo por vencer
```
**Sin variables** - Texto fijo

### Body
```
¡{{1}}! 👋 Hoy vence la devolución de "{{2}}" que te prestó {{3}} el día {{4}} bajo el concepto "{{5}}". 📦

¿Todo listo para devolver? ✅
```

**Variables del Body (5):**
- `{{1}}` = Nombre del borrower (de su perfil)
- `{{2}}` = Descripción del objeto (ej: "PlayStation 5")
- `{{3}}` = Nombre del lender (alias del contacto)
- `{{4}}` = Fecha de creación (ej: "14/10/25")
- `{{5}}` = Concepto/descripción adicional

### Footer
```
(vacío)
```

### Buttons

**Botón 1 - Quick Reply:**
- **Tipo:** Quick Reply
- **Texto:** `Marcar como devuelto`
- **Payload:** Automático (se genera en el backend)

**Botón 2 - URL dinámica:**
- **Tipo:** URL
- **Texto:** `Ver otras opciones`
- **URL:** `{{6}}`
- **Variable:** URL completa al detalle del préstamo

---

## 🔧 Configuración en Meta Business Manager

### Paso 1: Acceder a WhatsApp Manager
1. Ve a [Meta Business Manager](https://business.facebook.com/)
2. Selecciona tu Business Account
3. Ve a **WhatsApp Manager**
4. Click en **Message Templates** (Plantillas de mensajes)

### Paso 2: Crear Template de Dinero

1. Click en **Create Template**
2. Completa:
   - **Name:** `due_date_money_v1` ⚠️ **EXACTAMENTE así**
   - **Category:** `UTILITY`
   - **Languages:** `Spanish`

#### Header
1. Selecciona **Text** como tipo de header
2. Ingresa exactamente:
   ```
   Tienes un préstamo por vencer
   ```
3. **SIN variables**

#### Body
1. Copia y pega EXACTAMENTE este texto:
```
¡{{1}}! 👋 Hoy vence un préstamo que te hizo *{{3}}* el día *{{4}}*.

Monto: *{{2}}*
Concepto: _"{{5}}"_.

📋 *Datos de transferencia:*
```Nombre: {{6}}
RUT: {{7}}
Banco: {{8}}
Tipo: {{9}}
Cuenta: {{10}}
Email: {{11}}```

¿Todo listo para devolver? ✅
```

2. Meta detectará automáticamente 11 variables
3. Agrega ejemplos para cada variable (Meta lo requiere):
   - {{1}}: `Juan`
   - {{2}}: `$50.000`
   - {{3}}: `María`
   - {{4}}: `14/10/25`
   - {{5}}: `Préstamo personal`
   - {{6}}: `María González Pérez`
   - {{7}}: `12.345.678-9`
   - {{8}}: `Santander`
   - {{9}}: `Cuenta Corriente`
   - {{10}}: `1234567890`
   - {{11}}: `maria@ejemplo.com`

#### Footer
Dejar vacío

#### Buttons
1. Click **Add button**
2. **Botón 1:**
   - Tipo: **Quick reply**
   - Texto: `Marcar como devuelto`

3. Click **Add button** nuevamente
4. **Botón 2:**
   - Tipo: **Call to action** → **Visit website**
   - Texto: `Ver otras opciones`
   - URL type: **Dynamic**
   - URL: `{{1}}`
   - Ejemplo: `https://hilarious-brigadeiros-9b9834.netlify.app/menu/loan-detail.html?token=menu_abc123&loan_id=xyz789`

#### Submit
1. Click **Submit**
2. Meta revisará la plantilla (1-24 horas)

---

### Paso 3: Crear Template de Objeto

1. Click en **Create Template**
2. Completa:
   - **Name:** `due_date_object_v1` ⚠️ **EXACTAMENTE así**
   - **Category:** `UTILITY`
   - **Languages:** `Spanish`

#### Header
1. Selecciona **Text** como tipo de header
2. Ingresa exactamente:
   ```
   Tienes un préstamo por vencer
   ```
3. **SIN variables**

#### Body
1. Copia y pega EXACTAMENTE este texto:
```
¡{{1}}! 👋 Hoy vence la devolución de "{{2}}" que te prestó {{3}} el día {{4}} bajo el concepto "{{5}}". 📦

¿Todo listo para devolver? ✅
```

2. Meta detectará automáticamente 5 variables
3. Agrega ejemplos para cada variable:
   - {{1}}: `Juan`
   - {{2}}: `PlayStation 5`
   - {{3}}: `María`
   - {{4}}: `14/10/25`
   - {{5}}: `Préstamo de consola`

#### Footer
Dejar vacío

#### Buttons
1. Click **Add button**
2. **Botón 1:**
   - Tipo: **Quick reply**
   - Texto: `Marcar como devuelto`

3. Click **Add button** nuevamente
4. **Botón 2:**
   - Tipo: **Call to action** → **Visit website**
   - Texto: `Ver otras opciones`
   - URL type: **Dynamic**
   - URL: `{{1}}`
   - Ejemplo: `https://hilarious-brigadeiros-9b9834.netlify.app/menu/loan-detail.html?token=menu_abc123&loan_id=xyz789`

#### Submit
1. Click **Submit**
2. Meta revisará la plantilla (1-24 horas)

---

## 📤 Vista Previa de las Plantillas

### Template de Dinero (due_date_money_v1)

```
┌─────────────────────────────────────────────────┐
│ Tienes un préstamo por vencer                   │
├─────────────────────────────────────────────────┤
│ ¡Juan! 👋 Hoy vence un préstamo que te hizo    │
│ *María* el día *14/10/25*.                      │
│                                                  │
│ Monto: *$50.000*                                │
│ Concepto: _"Préstamo personal"_.                │
│                                                  │
│ 📋 *Datos de transferencia:*                    │
│ ```Nombre: María González Pérez                 │
│ RUT: 12.345.678-9                               │
│ Banco: Santander                                 │
│ Tipo: Cuenta Corriente                          │
│ Cuenta: 1234567890                              │
│ Email: maria@ejemplo.com```                     │
│                                                  │
│ ¿Todo listo para devolver? ✅                   │
├─────────────────────────────────────────────────┤
│ [Marcar como devuelto] [Ver otras opciones]    │
└─────────────────────────────────────────────────┘
```

### Template de Objeto (due_date_object_v1)

```
┌─────────────────────────────────────────────────┐
│ Tienes un préstamo por vencer                   │
├─────────────────────────────────────────────────┤
│ ¡Juan! 👋 Hoy vence la devolución de           │
│ "PlayStation 5" que te prestó María el día      │
│ 14/10/25 bajo el concepto "Préstamo de         │
│ consola". 📦                                    │
│                                                  │
│ ¿Todo listo para devolver? ✅                   │
├─────────────────────────────────────────────────┤
│ [Marcar como devuelto] [Ver otras opciones]    │
└─────────────────────────────────────────────────┘
```

---

## ⚠️ Notas Importantes

1. **Nombres exactos:** Los nombres `due_date_money_v1` y `due_date_object_v1` DEBEN ser exactos para que el código funcione
2. **Variables de botones:** En Meta, las variables de botones URL se cuentan por separado (la variable del URL es {{1}} en la configuración de botones, aunque sea la variable 12 o 6 del mensaje completo)
3. **Quick Reply Payload:** El payload del botón Quick Reply se genera automáticamente por el backend (`loan_{id}_mark_returned`)
4. **Categoría UTILITY:** Estos son recordatorios transaccionales, NO marketing
5. **Aprobación:** Meta debe aprobar ambas plantillas antes de usarlas

---

## 💻 Uso desde el Código

El código automáticamente selecciona el template correcto según el tipo de préstamo:

```typescript
// Detectar tipo de préstamo
const isMoneyLoan = agreement.amount !== null;

// Seleccionar template
const templateName = isMoneyLoan
  ? 'due_date_money_v1'  // Préstamo de dinero
  : 'due_date_object_v1'; // Préstamo de objeto

// Obtener template de BD
const { data: template } = await supabase
  .from('templates')
  .select('*')
  .eq('meta_template_name', templateName)
  .is('tenant_id', null)
  .single();
```

---

## 🔍 Troubleshooting

### Error: "Template name does not exist in the translation"

**Causa:** El template no existe en Meta con ese nombre exacto, o no está aprobado.

**Soluciones:**
1. Verifica en Meta Business Manager → WhatsApp Manager → Templates
2. Confirma que los nombres sean EXACTAMENTE `due_date_money_v1` y `due_date_object_v1`
3. Verifica que el estado sea **APPROVED** (no PENDING o REJECTED)
4. Confirma que el idioma sea **Spanish (es)**

### Error: "Parameter count mismatch"

**Causa:** El número de variables enviadas no coincide con el template en Meta.

**Soluciones:**
1. Template de dinero: DEBE tener 11 variables en body + 1 en botón URL = 12 total
2. Template de objeto: DEBE tener 5 variables en body + 1 en botón URL = 6 total
3. Revisa que copiaste el texto del body EXACTAMENTE como está en esta documentación

### Botones no aparecen

**Causa:** Meta no reconoce los botones configurados.

**Soluciones:**
1. Verifica que agregaste AMBOS botones (Quick Reply + URL)
2. El botón Quick Reply DEBE ser tipo "Quick reply"
3. El botón URL DEBE ser tipo "Call to action" → "Visit website" → "Dynamic"

---

## 📚 Referencias

- [WhatsApp Button Components](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/components#button-components)
- [Quick Reply Buttons](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/interactive-message-templates#quick-reply-button)
- [Dynamic URL Buttons](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/dynamic-url)

---

**Última actualización:** 2025-10-10
**Versión:** 1.0
