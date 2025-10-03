# WhatsApp Flows - Perfil de Usuario

Este directorio contiene los WhatsApp Flows para gestionar información personal y datos bancarios de los usuarios.

## Flows Disponibles

### 1. `profile-flow.json` - Perfil Personal
Permite al usuario registrar/actualizar su información personal:
- Nombre
- Apellido
- Teléfono (prellenado automáticamente)
- Email

**Screen:** 1 pantalla única con formulario completo

### 2. `bank-accounts-flow.json` - Datos de Transferencia
Permite gestionar múltiples cuentas bancarias:
- Listar cuentas existentes
- Agregar nueva cuenta
- Editar cuenta existente
- Eliminar cuenta (con confirmación)

**Screens:** 3 pantallas con navegación:
- `ACCOUNTS_LIST`: Lista de cuentas + botón agregar
- `ACCOUNT_FORM`: Formulario crear/editar cuenta
- `DELETE_CONFIRM`: Confirmación de eliminación

## Registro en WhatsApp Business Manager

### Paso 1: Acceder a Flow Manager

1. Ir a [Meta Business Suite](https://business.facebook.com/)
2. Seleccionar tu cuenta de WhatsApp Business
3. En el menú lateral, ir a **"Flows"** o **"Flujos"**

### Paso 2: Crear Flow de Perfil Personal

1. Click en **"Create Flow"** / **"Crear Flujo"**
2. Nombre: `Profile Flow` / `Flujo de Perfil`
3. Categoría: `OTHER` / `OTRO`
4. En el editor:
   - Click en **"JSON"** (esquina superior derecha)
   - Pegar contenido de `profile-flow.json`
   - Click en **"Preview"** para validar
5. Configurar endpoint:
   - En **"Settings"** / **"Configuración"**
   - **Endpoint URL**: `https://[TU_PROYECTO].supabase.co/functions/v1/flows-handler`
   - **HTTP Method**: `POST`
6. **Publicar** el flow

### Paso 3: Crear Flow de Datos Bancarios

1. Click en **"Create Flow"** / **"Crear Flujo"**
2. Nombre: `Bank Accounts Flow` / `Flujo de Cuentas Bancarias`
3. Categoría: `OTHER` / `OTRO`
4. En el editor:
   - Click en **"JSON"** (esquina superior derecha)
   - Pegar contenido de `bank-accounts-flow.json`
   - Click en **"Preview"** para validar
5. Configurar endpoint (mismo que Flow de Perfil)
6. **Publicar** el flow

### Paso 4: Obtener Flow IDs

Una vez publicados, cada flow tendrá un ID único:
- Ir a la lista de Flows
- Copiar el **Flow ID** de cada uno (formato: `123456789012345`)
- Guardar estos IDs en variables de entorno:

```bash
# .env
WHATSAPP_PROFILE_FLOW_ID=123456789012345
WHATSAPP_BANK_ACCOUNTS_FLOW_ID=987654321098765
```

## Integración con el Sistema

### Trigger de Flows desde Webhook

El webhook `wa_webhook` enviará mensajes con botones de flow:

```typescript
// Ejemplo: Enviar mensaje con Flow Button
const flowMessage = {
  messaging_product: "whatsapp",
  recipient_type: "individual",
  to: phoneNumber,
  type: "interactive",
  interactive: {
    type: "flow",
    header: {
      type: "text",
      text: "👤 Mi Perfil"
    },
    body: {
      text: "Gestiona tu información personal y datos bancarios"
    },
    footer: {
      text: "Tus datos están protegidos"
    },
    action: {
      name: "flow",
      parameters: {
        flow_message_version: "3",
        flow_token: "UNIQUE_TOKEN_12345",
        flow_id: process.env.WHATSAPP_PROFILE_FLOW_ID,
        flow_cta: "Abrir perfil",
        flow_action: "navigate",
        flow_action_payload: {
          screen: "PROFILE_FORM",
          data: {
            first_name: userData.first_name || "",
            last_name: userData.last_name || "",
            phone: userData.phone || "",
            email: userData.email || ""
          }
        }
      }
    }
  }
};
```

### Procesar Respuestas de Flows

El endpoint `flows-handler` recibe las respuestas:

```typescript
interface FlowResponse {
  version: string;
  flow_token: string;
  screen: string;
  data: {
    // Datos del formulario completado
  };
}
```

## Testing

### Modo Draft (Borrador)

Antes de publicar, puedes testear en modo draft:

1. En WhatsApp Business Manager, click en el flow
2. En la esquina superior derecha: **"Send Test"** / **"Enviar Prueba"**
3. Ingresar tu número de WhatsApp
4. Recibirás el flow en tu chat

### Validación de JSON

Usar el validador oficial de Meta:
```bash
# Instalar CLI de WhatsApp Business
npm install -g @meta/wa-flows-cli

# Validar JSON
wa-flows validate profile-flow.json
wa-flows validate bank-accounts-flow.json
```

**Nota sobre versión:** Los flows usan `version: "7.2"` que es la versión actualmente soportada por WhatsApp Business Manager (verificado en producción, octubre 2025).

**Nota sobre NavigationList:** El flow de cuentas bancarias (`bank-accounts-flow.json`) utiliza el componente `NavigationList` (disponible desde v6.2+) para mostrar listas clicables. Este componente:
- Requiere datos en formato `NavigationItem` con: `id`, `main_content`, `end`, `on_click_action`
- Permite máximo 2 NavigationList por pantalla
- No se puede mezclar con otros componentes en el mismo screen
- Los datos deben venir prellenados desde el backend (`flow-data-provider.ts`)

## Prellenado de Datos (Data Exchange)

Para prellenar campos del flow con datos existentes del usuario:

```typescript
// En flow-data-provider.ts
async function getProfileDataForFlow(contactProfileId: string) {
  const { data } = await supabase
    .from('contact_profiles')
    .select('first_name, last_name, phone_e164, email')
    .eq('id', contactProfileId)
    .single();

  return {
    first_name: data?.first_name || "",
    last_name: data?.last_name || "",
    phone: data?.phone_e164 || "",
    email: data?.email || ""
  };
}
```

## Troubleshooting

### Flow no se muestra
- Verificar que el flow esté **publicado** (no en draft)
- Verificar que el Flow ID sea correcto
- Verificar permisos de la WhatsApp Business Account

### Error al enviar
- Verificar formato del mensaje (ver logs de WhatsApp API)
- El flow_token debe ser único por usuario/sesión
- El flow_id debe ser string, no number

### Datos no se prellenan
- Verificar que los nombres de campos coincidan con el JSON
- Verificar que el payload de `flow_action_payload.data` tenga la estructura correcta
- Ver logs en el endpoint `flows-handler`

## Referencias

- [WhatsApp Flows Documentation](https://developers.facebook.com/docs/whatsapp/flows/)
- [WhatsApp Flows Reference](https://developers.facebook.com/docs/whatsapp/flows/reference)
- [Flow JSON Schema](https://developers.facebook.com/docs/whatsapp/flows/reference/flowjson)
- [Data Exchange API](https://developers.facebook.com/docs/whatsapp/flows/guides/implementingyourfirstflow#data-exchange)
