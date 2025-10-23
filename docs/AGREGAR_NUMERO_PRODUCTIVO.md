# 📱 Guía: Agregar Número Productivo de WhatsApp

**Fecha creación:** 2025-10-22
**Estado:** ⏸️ Esperando verificación empresarial en Meta

---

## 📊 Información del Número Productivo

```
Phone Number ID:     15558789779
Business Account ID: 1560176728670614
Access Token:        ⏳ PENDIENTE (requiere verificación empresarial)
```

---

## ⏸️ Bloqueadores Actuales

### ❌ Cuenta de WhatsApp Business NO verificada

**Documentos pendientes:**
- RUT de la empresa (en trámite)
- Estatutos sociales (en trámite)
- Documento de identidad del representante legal
- Comprobante de domicilio fiscal

**Impacto:**
- No se puede generar Access Token permanente
- No se puede usar el número productivo
- No se puede configurar webhook

---

## ✅ Código Ya Preparado

**Hoy se desplegó:**
- ✅ `wa_webhook` - Soporta múltiples números
- ✅ `flows-handler` - Soporta múltiples números
- ✅ Sistema de routing por phone_number_id
- ✅ Fallback automático a variables de entorno

**El sistema ESTÁ LISTO** para recibir el número productivo cuando esté verificado.

---

## 🚀 Proceso Cuando Tengas Verificación

### FASE 1: Verificación Empresarial en Meta (1-7 días)

**1. Iniciar verificación:**
   - URL: https://business.facebook.com/settings/security
   - Security Center → Business Verification
   - Click "Start Verification"

**2. Cargar documentos:**
   - RUT de la empresa (Chile)
   - Estatutos de la sociedad
   - Cédula del representante legal
   - Comprobante de domicilio fiscal (boleta de servicios)

**3. Formulario:**
   - Legal business name: [Nombre legal de la empresa]
   - Business registration number: [RUT sin puntos ni guión]
   - Business address: [Dirección fiscal]
   - Business website: [Si tienen]

**4. Esperar aprobación:**
   - Meta revisa en 1-7 días hábiles
   - Recibirás email de confirmación
   - Estado visible en: Business Settings → Security Center

---

### FASE 2: Obtener Access Token (5 minutos)

**Una vez verificada la cuenta:**

1. **Ir a System Users:**
   - https://business.facebook.com/settings/system-users

2. **Crear System User:**
   - Click "Add"
   - Name: "PrestaBot Production API"
   - System User Role: "Admin"
   - Click "Create System User"

3. **Generar Token:**
   - Click en el System User creado
   - Click "Generate New Token"
   - Selecciona tu App de WhatsApp

4. **Permisos requeridos:**
   - ✅ `whatsapp_business_management`
   - ✅ `whatsapp_business_messaging`
   - ✅ `business_management`

5. **Duración:**
   - Selecciona: "60 days" o "Never expire"

6. **Guardar token:**
   - **¡CRÍTICO!** Copia el token INMEDIATAMENTE
   - No podrás verlo después
   - Guárdalo en lugar seguro (no en repositorio público)

---

### FASE 3: Configurar en Base de Datos (2 minutos)

**Ejecutar en Supabase SQL Editor:**

```sql
-- Crear tenant productivo
INSERT INTO tenants (
    name,
    whatsapp_phone_number_id,
    whatsapp_access_token,
    whatsapp_business_account_id,
    timezone,
    webhook_verify_token,
    settings
) VALUES (
    'PrestaBot Producción',
    '15558789779',
    'TU_ACCESS_TOKEN_AQUI',  -- ⚠️ Reemplazar con el token real
    '1560176728670614',
    'America/Santiago',
    'token_prestabot_2025',
    '{
        "environment": "production"
    }'::jsonb
);

-- Verificar creación
SELECT
    id,
    name,
    whatsapp_phone_number_id,
    LENGTH(whatsapp_access_token) as token_length,
    created_at
FROM tenants
WHERE whatsapp_phone_number_id = '15558789779';
```

---

### FASE 4: Configurar Webhook en Meta (5 minutos)

**1. Ir a configuración de WhatsApp:**
   - https://business.facebook.com/wa/manage/phone-numbers/
   - Selecciona el número productivo (15558789779)
   - Click "Configuration"

**2. Configurar Webhook:**
   - Click en "Edit" en la sección Webhook

   **Datos:**
   ```
   Callback URL: https://qgjxkszfdoolaxmsupil.supabase.co/functions/v1/wa_webhook
   Verify Token: token_prestabot_2025
   ```

**3. Suscribirse a eventos:**
   - ✅ messages
   - ✅ message_status (opcional, para tracking)

**4. Verificar:**
   - Click "Verify and Save"
   - Debe mostrar "✅ Verified"

---

### FASE 5: Configurar WhatsApp Flows (3 minutos)

**Si usarás el Flow de perfil de usuario:**

```bash
# En terminal local (requiere tener whatsapp_flows_public_key.pem)
curl -X POST "https://graph.facebook.com/v21.0/15558789779/whatsapp_business_encryption" \
  -H "Authorization: Bearer TU_ACCESS_TOKEN" \
  -d "business_public_key=$(cat whatsapp_flows_public_key.pem | tr -d '\n')"

# Verificar configuración
curl "https://graph.facebook.com/v21.0/15558789779/whatsapp_business_encryption" \
  -H "Authorization: Bearer TU_ACCESS_TOKEN"
```

**Respuesta esperada:**
```json
{
  "success": true
}
```

---

### FASE 6: Testing (10 minutos)

**1. Test básico:**
   - Envía "hola" desde tu teléfono al número productivo
   - Debe responder con el menú principal

**2. Verificar logs:**
   - Supabase Dashboard → Edge Functions → wa_webhook
   - Buscar en logs recientes:
     ```
     [ROUTING] Mensaje enrutado al tenant: PrestaBot Producción
     [INTERACTIVE] Using token from: tenant
     ```

**3. Test de funcionalidades:**
   - ✅ Responde a "hola"
   - ✅ Responde a "estado"
   - ✅ Funciona flujo de nuevo préstamo
   - ✅ Funciona Flow de perfil (si aplica)

**4. Verificar aislamiento:**
   ```sql
   -- Verificar que los números están separados
   SELECT
       t.name,
       t.whatsapp_phone_number_id,
       COUNT(c.id) as num_contactos
   FROM tenants t
   LEFT JOIN contacts c ON c.tenant_id = t.id
   WHERE t.whatsapp_phone_number_id IN ('778143428720890', '15558789779')
   GROUP BY t.id, t.name, t.whatsapp_phone_number_id;
   ```

---

## 🔄 Migración de Usuarios (Opcional)

**Si quieres migrar usuarios del número de prueba al productivo:**

```sql
-- IMPORTANTE: Hacer backup primero!

-- Opción 1: Migrar todos los usuarios
-- (NO recomendado, mejor crear usuarios nuevos en producción)

-- Opción 2: Empezar desde cero en producción
-- Los usuarios se crearán automáticamente cuando interactúen con el bot productivo
```

**Recomendación:** Mantener ambos números funcionando:
- **Prueba (778143428720890):** Para testing y desarrollo
- **Productivo (15558789779):** Para usuarios reales

---

## 📋 Checklist Final

**Pre-requisitos:**
- [ ] Empresa constituida (RUT + Estatutos)
- [ ] Cuenta de WhatsApp Business verificada en Meta
- [ ] Access Token permanente generado

**Configuración:**
- [ ] Tenant creado en base de datos
- [ ] Webhook configurado en Meta
- [ ] WhatsApp Flows configurado (si aplica)

**Testing:**
- [ ] Bot responde a mensajes
- [ ] Logs muestran tenant correcto
- [ ] Todas las funcionalidades funcionan
- [ ] No hay cruce de datos con número de prueba

---

## 🆘 Troubleshooting

### Problema: "Access Token inválido"

**Causa:** Token temporal o expirado

**Solución:**
1. Verificar que es un System User Token (no user token)
2. Verificar que tiene los permisos correctos
3. Verificar que no ha expirado
4. Regenerar si es necesario

### Problema: "Webhook verification failed"

**Causa:** Verify token incorrecto

**Solución:**
1. Verificar que el verify token es exactamente: `token_prestabot_2025`
2. No debe tener espacios antes/después
3. Verificar URL del webhook es correcta

### Problema: "Bot no responde"

**Causa:** Webhook no recibe mensajes

**Solución:**
1. Verificar webhook está activo en Meta
2. Verificar suscripción a evento "messages"
3. Revisar logs de Supabase para ver si llegan requests
4. Verificar phone_number_id en logs coincide con 15558789779

---

## 📞 Contacto de Soporte

**Cuando tengas la verificación aprobada:**
1. Obtén el Access Token
2. Avisa y te ayudo con la configuración final (15 minutos)
3. Testing conjunto

---

## 📚 Archivos Relacionados

- `/scripts/setup-new-tenant.sql` - Template SQL genérico
- `/docs/plan-multiples-numeros-whatsapp.md` - Plan completo
- `/CHANGELOG.md` - Cambios implementados hoy

---

**Última actualización:** 2025-10-22
**Siguiente acción:** Esperar verificación empresarial de Meta
