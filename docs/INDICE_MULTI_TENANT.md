# 📚 Índice de Documentación Multi-Tenant

**Última actualización:** 2025-10-22

---

## 🎯 Inicio Rápido

**¿Quieres agregar un número productivo de WhatsApp?**

👉 **Lee primero:** [`AGREGAR_NUMERO_PRODUCTIVO.md`](./AGREGAR_NUMERO_PRODUCTIVO.md)

---

## 📋 Documentos por Caso de Uso

### 1️⃣ Agregar Número Productivo (Caso más común)

**Tu situación:**
- Tienes un número de prueba funcionando
- Quieres agregar el número productivo
- Estás esperando verificación empresarial de Meta

**Leer:**
1. 📄 [`AGREGAR_NUMERO_PRODUCTIVO.md`](./AGREGAR_NUMERO_PRODUCTIVO.md) - Guía completa paso a paso
2. 📄 [`../CHANGELOG.md`](../CHANGELOG.md) - Ver sección "Multi-Tenant" para cambios técnicos

**Ejecutar cuando tengas verificación:**
1. Obtener Access Token en Meta Business
2. Crear tenant con SQL (5 min)
3. Configurar webhook (5 min)
4. ¡Listo! (15 min total)

---

### 2️⃣ Entender la Arquitectura Multi-Tenant

**Tu situación:**
- Quieres entender cómo funciona el sistema
- Necesitas conocer la arquitectura técnica
- Quieres saber cómo se enrutan los mensajes

**Leer:**
1. 📄 [`plan-multiples-numeros-whatsapp.md`](./plan-multiples-numeros-whatsapp.md) - Arquitectura completa
2. 📄 [`../CHANGELOG.md`](../CHANGELOG.md) - Cambios implementados

**Conceptos clave:**
- **Bot WhatsApp:** Número desde donde se envían mensajes (no es usuario)
- **Tenant/Usuario:** Persona que registra préstamos
- **Contacto:** Persona hacia la cual un usuario tiene préstamos
- **phone_number_id:** Identifica cada bot/número de WhatsApp

---

### 3️⃣ Configurar Desde Cero (Nuevo proyecto)

**Tu situación:**
- Estás instalando el sistema por primera vez
- Necesitas configurar el primer número de WhatsApp
- Quieres entender todo el flujo

**Leer en orden:**
1. 📄 [`../README.md`](../README.md) - Instalación general
2. 📄 [`plan-multiples-numeros-whatsapp.md`](./plan-multiples-numeros-whatsapp.md) - Arquitectura
3. 📄 [`../scripts/setup-new-tenant.sql`](../scripts/setup-new-tenant.sql) - Script de configuración

**Ejecutar:**
```bash
# 1. Clonar y configurar proyecto
git clone ...
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con credenciales de Meta

# 3. Deploy
npx supabase functions deploy wa_webhook --project-ref TU_PROJECT_REF --no-verify-jwt
npx supabase functions deploy flows-handler --project-ref TU_PROJECT_REF --no-verify-jwt

# 4. Crear tenant
# Ejecutar SQL en Supabase Dashboard
```

---

### 4️⃣ Verificar Configuración Existente

**Tu situación:**
- Ya tienes el sistema funcionando
- Quieres verificar que todo esté correcto
- Necesitas diagnosticar problemas

**Ejecutar:**
```bash
# Verificación automática
deno run --allow-env --allow-net --allow-read scripts/verify-multi-tenant-setup.ts
```

**Revisar manualmente:**
```sql
-- En Supabase SQL Editor
SELECT
    id,
    name,
    whatsapp_phone_number_id,
    CASE
        WHEN whatsapp_access_token IS NULL THEN '❌ NULL'
        WHEN whatsapp_access_token = '' THEN '❌ EMPTY'
        ELSE '✅ SET (' || LENGTH(whatsapp_access_token) || ' chars)'
    END as token_status
FROM tenants
ORDER BY created_at DESC;
```

---

### 5️⃣ Troubleshooting

**Problemas comunes:**

**Bot no responde:**
1. Verificar webhook configurado en Meta
2. Verificar logs en Supabase Dashboard
3. Verificar phone_number_id en BD coincide con Meta

**"Access Token inválido":**
1. Verificar que es System User Token (no user token)
2. Verificar permisos: `whatsapp_business_messaging`
3. Regenerar token si expiró

**"Tenant not found":**
1. Verificar phone_number_id en webhook
2. Verificar tenant existe en BD
3. Ejecutar script de verificación

**Leer:**
- 📄 [`AGREGAR_NUMERO_PRODUCTIVO.md`](./AGREGAR_NUMERO_PRODUCTIVO.md) - Sección "Troubleshooting"
- 📄 [`plan-multiples-numeros-whatsapp.md`](./plan-multiples-numeros-whatsapp.md) - Sección "Troubleshooting"

---

## 📁 Estructura de Archivos

```
presta_bot/
│
├── docs/
│   ├── INDICE_MULTI_TENANT.md                  ← Estás aquí
│   ├── AGREGAR_NUMERO_PRODUCTIVO.md            ← Guía paso a paso (PRINCIPAL)
│   ├── plan-multiples-numeros-whatsapp.md      ← Arquitectura técnica
│   └── PLAN_MIGRACION_MULTI_TENANT_SEGURO.md   ← Plan de migración detallado
│
├── scripts/
│   ├── setup-new-tenant.sql                    ← Template SQL genérico
│   └── verify-multi-tenant-setup.ts            ← Script de verificación
│
├── supabase/functions/
│   ├── wa_webhook/index.ts                     ← Modificado (usa token por tenant)
│   └── _shared/flow-handlers.ts                ← Modificado (usa token por tenant)
│
└── CHANGELOG.md                                 ← Registro de cambios

```

---

## 🔗 Links Externos

**Meta Business Manager:**
- [Business Settings](https://business.facebook.com/settings/)
- [WhatsApp Configuration](https://business.facebook.com/wa/manage/phone-numbers/)
- [System Users](https://business.facebook.com/settings/system-users)
- [Business Verification](https://business.facebook.com/settings/security)

**Supabase:**
- [Project Dashboard](https://supabase.com/dashboard/project/qgjxkszfdoolaxmsupil)
- [Edge Functions Logs](https://supabase.com/dashboard/project/qgjxkszfdoolaxmsupil/logs/edge-functions)
- [SQL Editor](https://supabase.com/dashboard/project/qgjxkszfdoolaxmsupil/sql)

**Documentación oficial:**
- [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)

---

## ❓ FAQ

**P: ¿Puedo tener varios números al mismo tiempo?**
R: Sí, el sistema soporta múltiples números. Cada número tiene su propio tenant y token.

**P: ¿Los usuarios pueden usar ambos números?**
R: Sí, los usuarios (Felipe, Catherine, etc.) pueden interactuar con ambos bots si quieren.

**P: ¿Necesito deploying cada vez que agrego un número?**
R: No, solo necesitas crear el tenant en la BD y configurar webhook en Meta.

**P: ¿Qué pasa si el token expira?**
R: Genera un nuevo System User Token y actualiza el campo `whatsapp_access_token` en la tabla `tenants`.

**P: ¿Puedo usar el mismo token para múltiples números?**
R: No recomendado. Cada número debería tener su propio token para seguridad y aislamiento.

---

## 📞 Soporte

**Si tienes dudas:**
1. Revisa la documentación correspondiente arriba
2. Ejecuta el script de verificación
3. Revisa los logs en Supabase
4. Contacta al equipo de desarrollo

---

**Última actualización:** 2025-10-22
**Mantenedor:** Claude Code
**Estado:** ✅ Documentación completa
