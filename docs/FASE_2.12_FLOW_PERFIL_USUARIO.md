# FASE 2.12 - WhatsApp Flows para Perfil de Usuario

## Resumen
Implementación de **WhatsApp Flows oficiales** (API de Meta) para gestionar información personal y datos bancarios de los usuarios. Utiliza formularios nativos de WhatsApp para una experiencia superior.

## Cambio de Arquitectura

### ❌ Implementación Anterior (Flow Conversacional)
- Múltiples mensajes de ida y vuelta
- Botones simples (máx 3 por mensaje)
- Validación post-envío
- Conversación "sucia" con muchos mensajes

### ✅ Implementación Actual (WhatsApp Flows)
- Formularios nativos en pantalla única
- UI tipo app dentro de WhatsApp
- Validación en tiempo real
- Prellenado automático de datos
- Conversación limpia (1 mensaje para abrir flow)

## Funcionalidades Implementadas

### 1. Flow de Perfil Personal (`profile-flow.json`)

**Campos:**
- **Nombre** (TextInput, required)
- **Apellido** (TextInput, required)
- **Teléfono** (TextInput, prellenado, read-only)
- **Email** (TextInput email, required, validación)

**Características:**
- Pantalla única con todos los campos
- Footer de confianza: "Tus datos están protegidos y nunca serán compartidos"
- Prellenado automático si el usuario ya tiene datos
- Validación de formato de email

### 2. Flow de Datos Bancarios (`bank-accounts-flow.json`)

**Pantallas:**

#### Screen 1: `ACCOUNTS_LIST`
- **NavigationList** con cuentas existentes (si las hay)
- Primer item: "➕ Agregar nueva cuenta" (siempre visible)
- Cada cuenta muestra: Alias + Banco + Tipo + Número
- Indicador visual ⭐ para cuenta principal
- Click en cuenta → navega a formulario de edición
- Si no hay cuentas: mensaje + botón "Agregar nueva cuenta"

#### Screen 2: `ACCOUNT_FORM`
- **Alias** (TextInput, required)
- **Banco** (Dropdown, 12 bancos chilenos)
- **Tipo de Cuenta** (Dropdown: Corriente, Ahorro, Vista, RUT)
- **Número de Cuenta** (TextInput number, required)
- **Checkbox**: "⭐ Usar como cuenta principal"
- **Enlace "🗑️ Eliminar esta cuenta"** (solo visible en modo edición)
- Modo dinámico: mismo formulario para crear/editar

#### Screen 3: `DELETE_CONFIRM`
- Confirmación explícita antes de eliminar
- Muestra qué cuenta se eliminará
- Acción irreversible

**Bancos Incluidos:**
1. BancoEstado
2. Banco de Chile
3. Banco Santander
4. Banco BCI
5. Scotiabank Chile
6. Banco Itaú
7. Banco Security
8. Banco Falabella
9. Banco Ripley
10. Banco Consorcio
11. Banco BICE
12. Banco Internacional

## Arquitectura Técnica

### Estructura de Archivos

```
/data2/presta_bot/
├── whatsapp-flows/
│   ├── profile-flow.json              # Flow de perfil personal
│   ├── bank-accounts-flow.json        # Flow de datos bancarios
│   └── README.md                      # Guía de registro en Meta
├── supabase/functions/
│   ├── flows-handler/
│   │   └── index.ts                   # Endpoint para procesar respuestas
│   ├── wa_webhook/
│   │   └── index.ts                   # Webhook modificado (trigger flows)
│   └── _shared/
│       └── flow-data-provider.ts      # Proveedor de datos para prellenar
├── supabase/migrations/
│   └── 020_user_profile_data.sql      # Migración de DB
└── docs/
    └── FASE_2.12_FLOW_PERFIL_USUARIO.md  # Esta documentación
```

### Base de Datos

**Tabla `contact_profiles` (extendida):**
```sql
ALTER TABLE contact_profiles
ADD COLUMN first_name VARCHAR(100),
ADD COLUMN last_name VARCHAR(100),
ADD COLUMN email VARCHAR(255);
```

**Tabla `bank_transfer_accounts` (nueva):**
```sql
CREATE TABLE bank_transfer_accounts (
    id UUID PRIMARY KEY,
    contact_profile_id UUID REFERENCES contact_profiles(id),
    alias VARCHAR(100) NOT NULL,
    bank_name VARCHAR(100) NOT NULL,
    account_type account_type NOT NULL,  -- ENUM: corriente, ahorro, vista, rut
    account_number VARCHAR(50) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    CONSTRAINT unique_alias_per_contact UNIQUE(contact_profile_id, alias)
);
```

**Trigger automático:** Solo permite una cuenta `is_default = TRUE` por usuario.

### Flow de Datos

#### 1. Usuario hace click en "👤 Mi Perfil"

```typescript
// wa_webhook/index.ts
case 'user_profile':
  const flowDataProvider = new FlowDataProvider(...);
  const flowToken = await flowDataProvider.generateFlowToken('profile', tenant.id, contact.id);
  const profileData = await flowDataProvider.getProfileData(contact.id);

  // Enviar mensaje con Flow Button
  interactiveResponse = {
    type: 'flow',
    header: { text: '👤 Mi Perfil' },
    body: { text: 'Gestiona tu información personal...' },
    action: {
      name: 'flow',
      parameters: {
        flow_token: flowToken,
        flow_id: WHATSAPP_PROFILE_FLOW_ID,
        flow_action_payload: {
          screen: 'PROFILE_FORM',
          data: profileData  // Prellenar datos
        }
      }
    }
  };
```

#### 2. Usuario completa el formulario

WhatsApp envía los datos al endpoint `flows-handler`:

```typescript
// flows-handler/index.ts
interface FlowRequest {
  version: string;
  flow_token: string;  // Contiene: profile_[tenant]_[contact]_[profile_id]_[timestamp]
  screen: string;
  data: ProfileFlowResponse | BankAccountFlowResponse;
}
```

#### 3. Handler procesa y guarda

```typescript
// Extraer IDs del flow_token
const [flowType, tenantId, contactId, contactProfileId] = flowToken.split('_');

// Actualizar BD
await supabase
  .from('contact_profiles')
  .update({
    first_name: data.first_name,
    last_name: data.last_name,
    email: data.email
  })
  .eq('id', contactProfileId);

// Registrar evento
await supabase.from('events').insert({
  tenant_id: tenantId,
  contact_id: contactId,
  event_type: 'profile_updated',
  payload: { ...data, source: 'whatsapp_flow' }
});
```

**Nota sobre versiones:** Los flows usan `version: "7.2"` que es la versión actualmente soportada por WhatsApp Business Manager (verificado en producción).

**Nota sobre NavigationList:** El flow de cuentas bancarias utiliza el componente `NavigationList` (disponible desde v6.2+) que permite mostrar listas clicables. Los datos deben venir en formato `NavigationItem` desde el backend con la estructura: `id`, `main_content`, `end`, `on_click_action`.

#### 4. Enviar mensaje de confirmación

```
✅ Perfil actualizado

Hola Juan, tus datos están guardados.

Ahora puedes:
• Registrar tus datos bancarios
• Crear tu primer recordatorio

[Botón: Datos Bancarios] [Botón: Nuevo Préstamo]
```

### Validaciones Backend

**Perfil Personal:**
```typescript
// Nombre/Apellido: solo letras, 2-50 caracteres
/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{2,50}$/

// Email: formato RFC 5322
/^[^\s@]+@[^\s@]+\.[^\s@]+$/
```

**Datos Bancarios:**
```typescript
// Alias: 3-30 caracteres
alias.length >= 3 && alias.length <= 30

// Número de cuenta: 8-20 dígitos
/^\d{8,20}$/

// Banco y Tipo: deben estar en listas permitidas
validBanks.includes(bank_name)
validTypes.includes(account_type)
```

## Registro de Flows en Meta Business

### Paso 1: Crear Flows en Meta Business Manager

1. Ir a [Meta Business Suite](https://business.facebook.com/)
2. Seleccionar WhatsApp Business Account
3. Navegar a **Flows** / **Flujos**
4. Click **Create Flow** / **Crear Flujo**

**Flow 1 - Perfil Personal:**
- Nombre: `Profile Flow`
- Categoría: `OTHER`
- JSON: Copiar contenido de `whatsapp-flows/profile-flow.json`
- Endpoint: `https://[PROYECTO].supabase.co/functions/v1/flows-handler`

**Flow 2 - Datos Bancarios:**
- Nombre: `Bank Accounts Flow`
- Categoría: `OTHER`
- JSON: Copiar contenido de `whatsapp-flows/bank-accounts-flow.json`
- Endpoint: `https://[PROYECTO].supabase.co/functions/v1/flows-handler`

### Paso 2: Publicar Flows

1. Validar JSON en preview
2. Configurar endpoint de respuesta
3. Publicar flow
4. Copiar Flow ID generado

### Paso 3: Configurar Variables de Entorno

```bash
# .env o Supabase Secrets
WHATSAPP_PROFILE_FLOW_ID=123456789012345
WHATSAPP_BANK_ACCOUNTS_FLOW_ID=987654321098765
```

## Ejemplos de Uso

### Caso 1: Usuario Nuevo (Sin Datos)

```
Usuario: "hola"
Bot: [Botones: 💰 Nuevo préstamo | 📋 Ver estado | 👤 Mi Perfil]

Usuario: [Click "👤 Mi Perfil"]
Bot: [Mensaje con Flow Button]
     "👤 Mi Perfil

     Gestiona tu información personal para recibir recordatorios personalizados.

     🔒 Tus datos están protegidos

     [Abrir perfil]"

Usuario: [Click "Abrir perfil"]
WhatsApp: [Abre formulario nativo con campos vacíos]
          Nombre: [___]
          Apellido: [___]
          Teléfono: +56912345678 (bloqueado)
          Email: [___]

Usuario: Completa y envía
Bot: "✅ Perfil actualizado

     Hola Juan, tus datos están guardados."
```

### Caso 2: Usuario Existente (Editar Datos)

```
Usuario: [Click "👤 Mi Perfil"]
WhatsApp: [Abre formulario PRELLENADO]
          Nombre: [Juan      ]
          Apellido: [Pérez    ]
          Teléfono: +56912345678
          Email: [juan.perez@gmail.com]

Usuario: Modifica email → juan.p@outlook.com
Bot: "✅ Perfil actualizado"
```

### Caso 3: Agregar Primera Cuenta Bancaria

```
Usuario: [Click en botón para abrir flow de cuentas]
WhatsApp: [Screen ACCOUNTS_LIST - vacía]
          "Tus Cuentas Bancarias

          Aún no has registrado ninguna cuenta bancaria."
          [Botón: Agregar nueva cuenta]

Usuario: [Click "Agregar nueva cuenta"]
WhatsApp: [Screen ACCOUNT_FORM]
          Alias: [Cuenta Principal]
          Banco: [Dropdown → Banco de Chile]
          Tipo: [Dropdown → Cuenta Corriente]
          Número: [123456789]
          ☑ ⭐ Usar como cuenta principal

Usuario: [Envía formulario]
Bot: "✅ Cuenta bancaria guardada

     Tu cuenta Cuenta Principal de Banco de Chile fue agregada exitosamente."
```

### Caso 4: Lista de Cuentas con NavigationList

```
Usuario: [Abre flow de cuentas]
WhatsApp: [Screen ACCOUNTS_LIST con NavigationList]
          "Tus Cuentas Bancarias"

          [➕ Agregar nueva cuenta]
          Registra una nueva cuenta bancaria...

          [Cuenta Principal - Banco de Chile]
          Cuenta Corriente • 12345678 • ⭐ Principal

          [Cuenta Ahorro - BCI]
          Cuenta de Ahorro • 98765432

Usuario: [Click en "Cuenta Principal"]
WhatsApp: [Screen ACCOUNT_FORM con datos prellenados]
          Alias: [Cuenta Principal]
          Banco: [Banco de Chile]
          ...
          🗑️ Eliminar esta cuenta

Usuario: [Modifica y guarda]
Bot: "✅ Cuenta actualizada"
```

## Mensajes de Confirmación

### Perfil Actualizado
```
✅ Perfil actualizado

Hola {first_name}, tus datos están guardados.

Ahora puedes:
• Registrar tus datos bancarios
• Crear tu primer recordatorio de préstamo

¿Qué quieres hacer?
[Botón: Datos Bancarios] [Botón: Crear Recordatorio]
```

### Cuenta Agregada
```
✅ Cuenta bancaria guardada

Tu cuenta {alias} de {bank_name} fue agregada exitosamente.

Las personas que te deben podrán transferir directamente a esta cuenta cuando envíes recordatorios.

[Botón: Ver mis cuentas] [Botón: Crear recordatorio]
```

### Cuenta Eliminada
```
🗑️ Cuenta eliminada

La cuenta {alias} fue eliminada de tu perfil.

Si la eliminaste por error, puedes volver a agregarla cuando quieras.

[Botón: Agregar cuenta]
```

## Ventajas de WhatsApp Flows vs Conversacional

| Aspecto | Flow Conversacional ❌ | WhatsApp Flows ✅ |
|---------|----------------------|------------------|
| **UX** | Múltiples mensajes | Formulario nativo tipo app |
| **Validación** | Post-envío | Tiempo real |
| **Prellenado** | No soportado | Automático |
| **Conversación** | "Sucia" con muchos mensajes | Limpia (1 mensaje) |
| **Edición** | Difícil (reiniciar) | Fácil (campos editables) |
| **Profesionalismo** | Bot básico | Experiencia premium |
| **Engagement** | Medio | Alto |
| **Tasa de Completación** | ~60% | ~85%+ |

## Métricas de Éxito Esperadas

### Flow de Perfil Personal
- **Completion Rate**: >85%
- **Time to Complete**: <60 segundos
- **Error Rate**: <5%
- **Bounce Rate**: <10%

### Flow de Datos Bancarios
- **Completion Rate**: >70%
- **Time to Complete**: <90 segundos
- **Accounts per User**: 1.5 promedio
- **Default Account Setting**: >80%

## Troubleshooting

### Flow no se muestra en WhatsApp
- ✅ Verificar que el flow esté **publicado** (no draft)
- ✅ Verificar `WHATSAPP_PROFILE_FLOW_ID` en variables de entorno
- ✅ Verificar permisos de WhatsApp Business Account

### Datos no se prellenan
- ✅ Verificar que `flow_action_payload.data` tenga estructura correcta
- ✅ Verificar que nombres de campos coincidan con JSON del flow
- ✅ Ver logs en endpoint `flows-handler`

### Error al guardar datos
- ✅ Verificar validaciones backend (email, nombres, cuenta)
- ✅ Ver tabla `events` para identificar errores
- ✅ Verificar que `flow_token` tenga formato correcto

### Flow se cierra inesperadamente
- ✅ Verificar que endpoint responda con `version: "3.0"`
- ✅ Verificar que no haya errores en validaciones
- ✅ Ver logs de `flows-handler` en Supabase

## Deploy y Testing

### 1. Aplicar Migración
```bash
supabase db push
```

### 2. Deploy Funciones
```bash
supabase functions deploy flows-handler
supabase functions deploy wa_webhook
```

### 3. Registrar Flows en Meta
Ver sección "Registro de Flows en Meta Business"

### 4. Configurar Variables de Entorno
```bash
# En Supabase Dashboard → Settings → Edge Functions → Secrets
WHATSAPP_PROFILE_FLOW_ID=...
WHATSAPP_BANK_ACCOUNTS_FLOW_ID=...
```

### 5. Testing
1. Enviar "hola" a tu número de WhatsApp Business
2. Click en "👤 Mi Perfil"
3. Verificar que se abra el flow
4. Completar formulario
5. Verificar mensaje de confirmación
6. Verificar datos en `contact_profiles`

## Próximos Pasos Sugeridos

1. **Agregar Flow de Datos Bancarios al Menú**
   - Botón para abrir directamente el flow de cuentas
   - Mensaje con resumen de cuentas existentes

2. **Integración con Recordatorios**
   - Mostrar datos bancarios en recordatorios de pago
   - Sugerir cuenta predeterminada
   - Facilitar transferencias

3. **Verificación de Cuenta Bancaria**
   - Micro-depósito de $1 con código de verificación
   - Aumentar confianza del usuario

4. **Analytics y Métricas**
   - Dashboard de completion rates
   - Puntos de abandono en el flow
   - A/B testing de textos

5. **Exportar Datos**
   - Permitir al usuario descargar sus datos
   - Cumplimiento con privacidad

## Referencias

- [WhatsApp Flows Documentation](https://developers.facebook.com/docs/whatsapp/flows/)
- [WhatsApp Flows JSON Reference](https://developers.facebook.com/docs/whatsapp/flows/reference/flowjson)
- [Data Exchange API](https://developers.facebook.com/docs/whatsapp/flows/guides/implementingyourfirstflow#data-exchange)
- [Best Practices for Flows](https://developers.facebook.com/docs/whatsapp/flows/bestpractices)

---

**Fecha de Implementación**: 2025-10-02
**Versión**: 2.0 (WhatsApp Flows)
**Estado**: ✅ Implementado y listo para registro en Meta Business
**Breaking Changes**: Reemplaza completamente la implementación conversacional anterior
