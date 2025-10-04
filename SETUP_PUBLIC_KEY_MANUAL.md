# 🔐 Configuración Manual de Clave Pública para WhatsApp Flows

El endpoint de configuración de clave pública requiere un **System User Access Token** en lugar de un User Access Token regular.

## Opción 1: Configurar mediante System User (Recomendado)

### Paso 1: Crear System User

1. Ve a **Meta Business Settings**: https://business.facebook.com/settings/system-users
2. Click en **"Add"** para crear un nuevo System User
3. Dale un nombre (ej: "WhatsApp Flows API")
4. Asigna el rol **"Admin"**
5. Click en **"Create System User"**

### Paso 2: Generar Access Token del System User

1. Click en el System User que acabas de crear
2. Click en **"Generate New Token"**
3. Selecciona tu aplicación: **"Bot Customware"** (ID: 23992581753731581)
4. Selecciona los siguientes permisos:
   - ✅ `whatsapp_business_management`
   - ✅ `whatsapp_business_messaging`
5. Click en **"Generate Token"**
6. **COPIA EL TOKEN** (solo se muestra una vez)

### Paso 3: Configurar la clave pública

Ejecuta el siguiente comando con el token del System User:

```bash
cd /data2/presta_bot

# Configura el System User token temporalmente
export SYSTEM_TOKEN="PEGA_AQUI_EL_SYSTEM_USER_TOKEN"

# Ejecuta la configuración
curl -X POST "https://graph.facebook.com/v21.0/773972555504544/whatsapp_business_encryption" \
  -H "Authorization: Bearer $SYSTEM_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"business_public_key\": $(cat whatsapp_flows_public_key.pem | jq -Rs .)}"
```

## Opción 2: Usar la Interfaz de Meta (Más Fácil)

Desafortunadamente, **Meta no proporciona una interfaz UI** para configurar la clave pública de Flows. Debes usar la API.

## Opción 3: Deshabilitar la firma (No Recomendado - Solo Testing)

⚠️ **Solo para desarrollo/testing** - Meta puede rechazar Flows sin firma en producción.

Si solo quieres probar el Flow sin la firma criptográfica:

1. Ve a tu Flow en Meta: https://business.facebook.com/wa/manage/flows/
2. Edita el Flow
3. En "Endpoint Configuration", **deja el endpoint vacío o usa uno que devuelva respuestas sin firma**

**Nota:** Esto significa que el Flow NO guardará datos, solo mostrará la interfaz.

## Verificación

Una vez configurada la clave pública, verifica con:

```bash
curl "https://graph.facebook.com/v21.0/773972555504544/whatsapp_business_encryption" \
  -H "Authorization: Bearer $SYSTEM_TOKEN"
```

Deberías ver algo como:

```json
{
  "data": [
    {
      "id": "...",
      "business_public_key": "-----BEGIN PUBLIC KEY-----\n..."
    }
  ]
}
```

## Próximos pasos después de configurar

1. ✅ Clave pública configurada
2. 📱 Enviar "hola" a WhatsApp
3. 👆 Click en "👤 Mi Perfil"
4. ✨ El Flow debería abrir correctamente (sin pantalla en blanco)
5. 📝 Completar formulario
6. ✅ Verificar que los datos se guardan en la base de datos

---

## Recursos

- **Documentación oficial**: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/whatsapp-business-encryption
- **System Users**: https://business.facebook.com/settings/system-users
- **Graph API Explorer**: https://developers.facebook.com/tools/explorer

## ¿Necesitas ayuda?

Si tienes problemas:
1. Verifica que el System User tenga permisos de Admin
2. Verifica que el token tenga el scope `whatsapp_business_management`
3. Verifica que estés usando el WABA ID correcto: `773972555504544`
