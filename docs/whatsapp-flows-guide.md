# Guía Completa de WhatsApp Flows

## Índice
1. [Arquitectura General](#arquitectura-general)
2. [Encriptación AES-128-GCM](#encriptación-aes-128-gcm)
3. [Estructura del Flow JSON](#estructura-del-flow-json)
4. [Pre-poblado de Datos](#pre-poblado-de-datos)
5. [Guardado de Datos](#guardado-de-datos)
6. [Configuración en Meta](#configuración-en-meta)
7. [Despliegue y Actualización](#despliegue-y-actualización)
8. [Troubleshooting](#troubleshooting)

---

## Arquitectura General

### Componentes

```
┌─────────────────┐
│  WhatsApp User  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│      Meta WhatsApp Platform         │
│  - Almacena Flow JSON               │
│  - Encripta/Desencripta payloads    │
│  - Valida RSA public key            │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│    wa_webhook (Edge Function)       │
│  - Recibe mensajes de WhatsApp      │
│  - Genera flow_token único          │
│  - Obtiene datos con FlowDataProvider│
│  - Envía mensaje con Flow Button    │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│   flows-handler (Edge Function)     │
│  - Desencripta payload (AES-128-GCM)│
│  - Procesa data_exchange            │
│  - Guarda datos en Supabase         │
│  - Encripta respuesta               │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│         Supabase Database           │
│  - contact_profiles                 │
│  - bank_transfer_accounts           │
│  - etc.                             │
└─────────────────────────────────────┘
```

### Flow Lifecycle

1. **Usuario hace click en botón** → wa_webhook recibe interactive button reply
2. **wa_webhook genera flow_token** → Formato: `{type}_{tenant_id}_{contact_id}_{profile_id}_{timestamp}`
3. **wa_webhook obtiene datos** → FlowDataProvider consulta DB para pre-poblar
4. **wa_webhook envía Flow message** → Con flow_token y datos en `flow_action_payload.data`
5. **Meta abre Flow** → Muestra UI con datos pre-poblados
6. **Usuario completa y envía** → Meta encripta payload con AES-128-GCM
7. **flows-handler recibe** → Desencripta, valida, procesa
8. **flows-handler guarda** → Actualiza DB con nuevos datos
9. **flows-handler responde** → Encripta respuesta, Flow se cierra

---

## Encriptación AES-128-GCM

### Generación de Claves RSA

```bash
# Generar clave privada RSA 2048-bit
openssl genrsa -out whatsapp_flows_private_key.pem 2048

# Extraer clave pública
openssl rsa -in whatsapp_flows_private_key.pem -pubout -out whatsapp_flows_public_key.pem
```

**IMPORTANTE:**
- Clave privada → Almacenar en Supabase Secrets como `WHATSAPP_FLOWS_PRIVATE_KEY`
- Clave pública → Configurar en Meta usando API
- **NUNCA** commitear claves privadas al repositorio

### Configurar Public Key en Meta

```bash
# URL: /v21.0/{PHONE_NUMBER_ID}/whatsapp_business_encryption
curl -X POST "https://graph.facebook.com/v21.0/778143428720890/whatsapp_business_encryption" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -d "business_public_key=$(cat whatsapp_flows_public_key.pem | tr -d '\n')"
```

### Flujo de Encriptación

**1. Meta → flows-handler (Request)**
```json
{
  "encrypted_aes_key": "base64...",     // AES key encriptada con RSA-OAEP
  "initial_vector": "base64...",        // IV de 16 bytes
  "encrypted_flow_data": "base64..."    // Payload encriptado con AES-GCM
}
```

**Proceso:**
1. Desencriptar AES key con RSA-OAEP + SHA-256 usando private key
2. Usar AES key + IV para desencriptar payload (AES-128-GCM, tag 128-bit)
3. Parsear JSON desencriptado

**2. flows-handler → Meta (Response)**

**Proceso:**
1. **IMPORTANTE:** Invertir IV bitwise (NOT cada byte)
2. Encriptar respuesta JSON con AES-GCM usando flipped IV
3. Responder con Base64 del encrypted buffer

### Módulo de Encriptación

Archivo: `supabase/functions/_shared/whatsapp-flows-encryption.ts`

```typescript
// Desencriptar request
export async function decryptAesKey(
  encryptedAesKeyBase64: string,
  privateKeyPem: string
): Promise<ArrayBuffer>

export async function decryptFlowData(
  encryptedDataBase64: string,
  aesKeyBuffer: ArrayBuffer,
  ivBase64: string
): Promise<any>

// Encriptar response
export function flipInitializationVector(iv: Uint8Array): Uint8Array

export async function encryptResponse(
  response: any,
  aesKeyBuffer: ArrayBuffer,
  ivBase64: string
): Promise<string>
```

**Ejemplo de uso:**

```typescript
// Desencriptar request
const aesKey = await decryptAesKey(body.encrypted_aes_key, privateKey);
const decryptedData = await decryptFlowData(
  body.encrypted_flow_data,
  aesKey,
  body.initial_vector
);

// Encriptar response
const responseData = {
  version: "3.0",
  screen: "SUCCESS",
  data: { message: "Guardado exitosamente" }
};
const encryptedResponse = await encryptResponse(
  responseData,
  aesKey,
  body.initial_vector
);

return new Response(encryptedResponse, {
  headers: { 'Content-Type': 'text/plain' }
});
```

---

## Estructura del Flow JSON

### Versiones y Schema

```json
{
  "version": "7.2",
  "data_api_version": "3.0",
  "routing_model": {},
  "screens": [...]
}
```

### Screen con Data Model

```json
{
  "id": "PROFILE_FORM",
  "title": "Tu Perfil",
  "terminal": true,
  "data": {
    "first_name": {
      "type": "string",
      "__example__": "Juan"
    },
    "email": {
      "type": "string",
      "__example__": "juan@example.com"
    }
  },
  "layout": {
    "type": "SingleColumnLayout",
    "children": [...]
  }
}
```

**Data Model:**
- Define el schema de datos que el screen espera recibir
- `type`: "string", "number", "boolean", "array", "object"
- `__example__`: Valor de ejemplo para testing

### Form Component

```json
{
  "type": "Form",
  "name": "profile_form",
  "init-values": {
    "first_name": "${data.first_name}",
    "last_name": "${data.last_name}",
    "email": "${data.email}"
  },
  "children": [...]
}
```

**CLAVE PARA PRE-POBLAR:**
- Usar `init-values` en el **Form**, NO en los TextInput
- Las keys deben coincidir con el `name` de cada TextInput
- Los valores usan sintaxis `${data.field_name}` para binding dinámico

### TextInput Component

```json
{
  "type": "TextInput",
  "name": "first_name",
  "label": "Nombre",
  "input-type": "text",
  "required": true,
  "helper-text": "Tu primer nombre"
}
```

**Propiedades permitidas:**
- `name` (required) - Debe coincidir con key en `init-values`
- `label` (required)
- `input-type`: "text", "email", "number", "password", "passcode"
- `required`: true/false
- `helper-text`: Texto de ayuda
- `enabled`: true/false (default: true)

**Propiedades NO permitidas:**
- ❌ `value` - Causa error de validación
- ❌ `init-value` - Causa error de validación
- ❌ `default` - No tiene efecto

### Footer Button (Submit)

```json
{
  "type": "Footer",
  "label": "Guardar perfil",
  "on-click-action": {
    "name": "data_exchange",
    "payload": {
      "first_name": "${form.first_name}",
      "last_name": "${form.last_name}",
      "email": "${form.email}"
    }
  }
}
```

**IMPORTANTE:**
- `"name": "data_exchange"` → Envía datos al endpoint
- `"name": "complete"` → Solo cierra el Flow SIN enviar datos
- Payload usa `${form.field_name}` para acceder a valores del formulario

---

## Pre-poblado de Datos

### 1. FlowDataProvider

Archivo: `supabase/functions/_shared/flow-data-provider.ts`

```typescript
export class FlowDataProvider {
  async getProfileData(contactId: string): Promise<{
    first_name: string;
    last_name: string;
    email: string;
  }> {
    const { data: contact } = await this.supabase
      .from('contacts')
      .select('contact_profile_id')
      .eq('id', contactId)
      .single();

    if (!contact?.contact_profile_id) {
      return { first_name: "", last_name: "", email: "" };
    }

    const { data: profile } = await this.supabase
      .from('contact_profiles')
      .select('first_name, last_name, email')
      .eq('id', contact.contact_profile_id)
      .single();

    return {
      first_name: profile?.first_name || "",
      last_name: profile?.last_name || "",
      email: profile?.email || ""
    };
  }
}
```

### 2. Enviar datos en wa_webhook

```typescript
// Obtener datos para pre-poblar
const profileData = await flowDataProvider.getProfileData(contact.id);
console.log('[PROFILE_FLOW] Profile data retrieved:', JSON.stringify(profileData));

// Enviar Flow con datos
const interactiveResponse = {
  type: 'flow',
  header: { type: 'text', text: '👤 Mi Perfil' },
  body: { text: 'Gestiona tu información personal.' },
  action: {
    name: 'flow',
    parameters: {
      flow_message_version: '3',
      flow_token: flowToken,
      flow_id: flowId,
      flow_cta: 'Abrir perfil',
      flow_action: 'navigate',
      flow_action_payload: {
        screen: 'PROFILE_FORM',
        data: profileData  // ← Datos aquí
      }
    }
  }
};
```

### 3. Init-values en Flow JSON

```json
{
  "type": "Form",
  "name": "profile_form",
  "init-values": {
    "first_name": "${data.first_name}",
    "last_name": "${data.last_name}",
    "email": "${data.email}"
  },
  "children": [
    {
      "type": "TextInput",
      "name": "first_name",
      "label": "Nombre"
    }
  ]
}
```

**Flujo completo:**
1. wa_webhook consulta DB → `{ first_name: "Felipe", last_name: "Abarca", email: "..." }`
2. wa_webhook envía en `flow_action_payload.data`
3. Meta recibe y bindea a `screen.data`
4. Form `init-values` usa `${data.first_name}` para pre-poblar TextInput con `name="first_name"`

---

## Guardado de Datos

### 1. Footer con data_exchange

```json
{
  "type": "Footer",
  "label": "Guardar",
  "on-click-action": {
    "name": "data_exchange",
    "payload": {
      "first_name": "${form.first_name}",
      "last_name": "${form.last_name}",
      "email": "${form.email}"
    }
  }
}
```

### 2. flows-handler procesa request

```typescript
// Desencriptar
const decryptedData = await decryptFlowData(
  body.encrypted_flow_data,
  aesKey,
  body.initial_vector
);

console.log('[CRYPTO] Flow data decrypted:', decryptedData);
// {
//   action: "data_exchange",
//   version: "3.0",
//   screen: "PROFILE_FORM",
//   flow_token: "profile_...",
//   data: {
//     first_name: "Felipe",
//     last_name: "Abarca",
//     email: "fabarca212@gmail.com"
//   }
// }
```

### 3. Extraer IDs del flow_token

```typescript
const flowToken = decryptedData.flow_token;
// Format: "profile_{tenantId}_{contactId}_{contactProfileId}_{timestamp}"

const parts = flowToken.split('_');
const flowType = parts[0];           // "profile"
const tenantId = parts[1];           // UUID
const contactId = parts[2];          // UUID
const contactProfileId = parts[3];   // UUID
const timestamp = parts[4];          // number
```

### 4. Guardar en Supabase

```typescript
const profileData = decryptedData.data as ProfileFlowResponse;

console.log('Updating profile:', {
  contactProfileId,
  tenantId,
  contactId
});

const { error } = await supabase
  .from('contact_profiles')
  .update({
    first_name: profileData.first_name,
    last_name: profileData.last_name,
    email: profileData.email,
    updated_at: new Date().toISOString()
  })
  .eq('id', contactProfileId);

if (error) throw error;

console.log('Profile updated successfully');
```

### 5. Responder con éxito

```typescript
const successResponse = {
  version: "3.0",
  screen: "SUCCESS",
  data: {
    extension_message_response: {
      params: {
        flow_token: flowToken
      }
    }
  }
};

const encryptedResponse = await encryptResponse(
  successResponse,
  aesKey,
  body.initial_vector
);

return new Response(encryptedResponse, {
  status: 200,
  headers: { 'Content-Type': 'text/plain' }
});
```

---

## Configuración en Meta

### 1. Crear Flow

1. Ir a https://business.facebook.com/wa/manage/flows/
2. Click **"Create Flow"**
3. Nombre: "Profile Flow" (ejemplo)
4. Categoría: según caso de uso

### 2. Subir Flow JSON

**Opción A: Via API (Recomendado)**

```bash
bash scripts/update-flow.sh
```

Script:
```bash
#!/bin/bash
FLOW_ID="1293469045408700"
ACCESS_TOKEN="${1:-$(grep WHATSAPP_ACCESS_TOKEN .env | cut -d= -f2)}"

curl -s -X POST "https://graph.facebook.com/v21.0/${FLOW_ID}/assets" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -F "name=flow.json" \
  -F "asset_type=FLOW_JSON" \
  -F "file=@/data2/presta_bot/whatsapp-flows/profile-flow.json;type=application/json"
```

**Opción B: Via Meta UI**

1. Click en Flow → Tab "Editor"
2. Pegar JSON completo
3. Click "Save"

### 3. Configurar Endpoint

En Meta Flow Setup:

- **Endpoint URL**: `https://qgjxkszfdoolaxmsupil.supabase.co/functions/v1/flows-handler`
- **Verify Token**: (dejar vacío si usas `--no-verify-jwt`)

### 4. Configurar Public Key

```bash
# Obtener PHONE_NUMBER_ID
echo $WHATSAPP_PHONE_NUMBER_ID

# Configurar
curl -X POST "https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/whatsapp_business_encryption" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -d "business_public_key=$(cat whatsapp_flows_public_key.pem | tr -d '\n')"
```

Respuesta exitosa:
```json
{
  "success": true
}
```

### 5. Publicar Flow

**Desde UI:**
1. Click botón **"Publish"**
2. Confirmar

**O via API:**
```bash
curl -X POST "https://graph.facebook.com/v21.0/${FLOW_ID}/publish" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
```

**IMPORTANTE:**
- Flows en DRAFT requieren `mode: 'draft'` en el mensaje
- Flows PUBLISHED no necesitan mode parameter
- Cada cambio al JSON requiere republicar

---

## Despliegue y Actualización

### Variables de Entorno

`.env`:
```bash
# WhatsApp
WHATSAPP_ACCESS_TOKEN=EAF...         # Token permanente de System User
WHATSAPP_PHONE_NUMBER_ID=778143...   # Phone number ID (NO WABA_ID)
WHATSAPP_PROFILE_FLOW_ID=12934...    # ID del Flow creado
```

Supabase Secrets:
```bash
npx supabase secrets set \
  WHATSAPP_ACCESS_TOKEN=... \
  WHATSAPP_FLOWS_PRIVATE_KEY="$(cat whatsapp_flows_private_key.pem)" \
  --project-ref qgjxkszfdoolaxmsupil
```

### Deploy Edge Functions

```bash
# Deploy wa_webhook
npx supabase functions deploy wa_webhook \
  --project-ref qgjxkszfdoolaxmsupil \
  --no-verify-jwt

# Deploy flows-handler
npx supabase functions deploy flows-handler \
  --project-ref qgjxkszfdoolaxmsupil \
  --no-verify-jwt
```

**IMPORTANTE:**
- Edge Functions cachean environment variables
- Después de cambiar secrets, re-deployar las functions
- `--no-verify-jwt` permite requests públicos desde Meta

### Actualizar Flow JSON

```bash
# 1. Editar JSON
nano whatsapp-flows/profile-flow.json

# 2. Actualizar en Meta
bash scripts/update-flow.sh

# 3. Publicar en Meta UI
# (O via API)

# 4. Esperar 2-3 minutos para que Meta actualice cache
```

---

## Troubleshooting

### Error: "Flow requires mode 'draft'"

**Causa:** Flow está en DRAFT pero no enviaste `mode: 'draft'`

**Solución:**
```typescript
flow_action_payload: {
  screen: 'PROFILE_FORM',
  data: profileData
}
// mode: 'draft'  // Agregar si Flow está en DRAFT
```

O publicar el Flow en Meta.

---

### Error: "Property 'value' is not allowed in 'TextInput'"

**Causa:** Intentaste usar `value` directamente en TextInput

**Solución:** Usar `init-values` en el Form:
```json
{
  "type": "Form",
  "name": "my_form",
  "init-values": {
    "field_name": "${data.field_name}"
  }
}
```

---

### Error: "Required TextInput 'field' cannot be disabled"

**Causa:** TextInput con `required: true` y `enabled: false`

**Solución:** Quitar uno de los dos:
```json
{
  "type": "TextInput",
  "name": "phone",
  "required": false,  // Si enabled: false
  "enabled": false
}
```

O mejor: remover el campo completamente si no se necesita.

---

### Error: "Session has expired"

**Causa:** Token temporal de WhatsApp expiró

**Solución:** Usar token permanente de System User:

1. Meta Business Suite → Configuración → Usuarios del sistema
2. Crear System User con rol "Administrador"
3. Asignar app con permiso "Manage app"
4. Generar token con permisos:
   - `business_management`
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
5. Actualizar en Supabase Secrets
6. Re-deploy edge functions

---

### Datos no se pre-poblan

**Checklist:**

1. ✅ `wa_webhook` envía datos en `flow_action_payload.data`?
   ```typescript
   console.log('[PROFILE_FLOW] Profile data retrieved:', JSON.stringify(profileData));
   ```

2. ✅ Flow JSON tiene `data` schema?
   ```json
   "data": {
     "first_name": { "type": "string" }
   }
   ```

3. ✅ Form tiene `init-values`?
   ```json
   {
     "type": "Form",
     "init-values": {
       "first_name": "${data.first_name}"
     }
   }
   ```

4. ✅ TextInput `name` coincide con key en `init-values`?
   ```json
   { "type": "TextInput", "name": "first_name" }
   ```

5. ✅ Flow publicado después de cambios?

---

### Datos no se guardan

**Checklist:**

1. ✅ Footer usa `data_exchange` (NO `complete`)?
   ```json
   { "on-click-action": { "name": "data_exchange" } }
   ```

2. ✅ Payload usa `${form.field_name}`?
   ```json
   {
     "payload": {
       "first_name": "${form.first_name}"
     }
   }
   ```

3. ✅ `flows-handler` recibe request?
   - Ver logs: `[CRYPTO] Flow data decrypted`

4. ✅ `flow_token` se parsea correctamente?
   ```typescript
   const parts = flowToken.split('_');
   ```

5. ✅ DB update sin errores?
   ```typescript
   if (error) console.error('DB error:', error);
   ```

---

### Health check falla

**Causa:** Meta envía `{"action": "ping"}` encriptado

**Solución:** Detectar ping DESPUÉS de desencriptar:

```typescript
// Desencriptar primero
const decryptedData = await decryptFlowData(...);

// Luego detectar ping
if (decryptedData.action === 'ping') {
  const pingResponse = {
    version: decryptedData.version || "3.0",
    data: { status: "active" }
  };
  const encryptedPing = await encryptResponse(pingResponse, aesKey, iv);
  return new Response(encryptedPing, {
    headers: { 'Content-Type': 'text/plain' }
  });
}
```

---

### Error: "Object with ID does not exist"

**Causa:** Usando WABA_ID en lugar de PHONE_NUMBER_ID

**Solución:**
```bash
# Correcto
curl "https://graph.facebook.com/v21.0/778143428720890/whatsapp_business_encryption"

# Incorrecto
curl "https://graph.facebook.com/v21.0/773972555504544/whatsapp_business_encryption"
```

Usar `WHATSAPP_PHONE_NUMBER_ID`, NO `WHATSAPP_BUSINESS_ACCOUNT_ID`.

---

## Referencias

- **WhatsApp Flows Docs**: https://developers.facebook.com/docs/whatsapp/flows/
- **Flow JSON Reference**: https://developers.facebook.com/docs/whatsapp/flows/reference/flowjson/
- **Components Reference**: https://developers.facebook.com/docs/whatsapp/flows/reference/components/
- **Flows API**: https://developers.facebook.com/docs/whatsapp/flows/reference/flowsapi/
- **Encryption Guide**: https://developers.facebook.com/docs/whatsapp/flows/guides/implementingyourflowendpoint#encryption

---

## Ejemplos de Implementación

### Ejemplo 1: Flow de Perfil (Actual)

Archivos:
- `/whatsapp-flows/profile-flow.json`
- `/supabase/functions/_shared/flow-data-provider.ts::getProfileData()`
- `/supabase/functions/flows-handler/index.ts` (case 'profile')
- `/supabase/functions/wa_webhook/index.ts` (case 'user_profile')

### Ejemplo 2: Flow de Cuentas Bancarias (Próximo)

**Flow JSON**: `/whatsapp-flows/bank-accounts-flow.json`

Estructura:
1. **ACCOUNT_LIST Screen** - Lista de cuentas con NavigationList
2. **ACCOUNT_FORM Screen** - Formulario para agregar/editar cuenta

**Data Provider:**
```typescript
async getBankAccountsData(contactId: string): Promise<NavigationItem[]> {
  // Retorna lista de cuentas como NavigationItems
  // Cada item navega a ACCOUNT_FORM con datos pre-poblados
}
```

**Flow Handler:**
```typescript
case 'bank':
  const accountData = flowData.data as BankAccountFlowResponse;

  if (accountData.edit_mode && accountData.account_id) {
    // Actualizar cuenta existente
    await supabase
      .from('bank_transfer_accounts')
      .update({...})
      .eq('id', accountData.account_id);
  } else {
    // Crear nueva cuenta
    await supabase
      .from('bank_transfer_accounts')
      .insert({...});
  }
```

---

## Checklist de Implementación

Cuando implementes un nuevo Flow:

### ✅ Paso 1: Diseñar Flow JSON
- [ ] Definir screens y routing
- [ ] Crear `data` schema para cada screen
- [ ] Agregar `init-values` en Forms
- [ ] Usar `data_exchange` en Footer buttons
- [ ] Validar JSON con Meta

### ✅ Paso 2: FlowDataProvider
- [ ] Crear método `get{FlowName}Data(contactId)`
- [ ] Consultar DB para obtener datos existentes
- [ ] Retornar objetos que coincidan con `screen.data` schema
- [ ] Agregar logs para debugging

### ✅ Paso 3: wa_webhook
- [ ] Detectar interactive button click
- [ ] Generar flow_token con `generateFlowToken()`
- [ ] Obtener datos con FlowDataProvider
- [ ] Enviar Flow message con datos en `flow_action_payload.data`
- [ ] Agregar logs

### ✅ Paso 4: flows-handler
- [ ] Crear interface para Flow response type
- [ ] Agregar case en switch para el flow type
- [ ] Parsear flow_token
- [ ] Extraer datos del payload
- [ ] Validar datos
- [ ] Guardar/actualizar en DB
- [ ] Retornar respuesta encriptada
- [ ] Agregar logs

### ✅ Paso 5: Configuración
- [ ] Subir Flow JSON a Meta
- [ ] Configurar endpoint URL
- [ ] Publicar Flow
- [ ] Guardar FLOW_ID en .env

### ✅ Paso 6: Testing
- [ ] Probar apertura del Flow
- [ ] Verificar pre-poblado de datos
- [ ] Llenar formulario y enviar
- [ ] Verificar datos guardados en DB
- [ ] Re-abrir Flow, verificar nuevos datos pre-poblados
- [ ] Probar health checks
- [ ] Revisar logs de errores

---

**Última actualización:** 2025-10-03
**Versión WhatsApp Flows:** 7.2
**Data API Version:** 3.0
