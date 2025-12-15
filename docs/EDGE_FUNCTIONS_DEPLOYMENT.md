# Edge Functions - Guía de Deployment

## Funciones que DEBEN desplegarse con `--no-verify-jwt`

Estas funciones NO deben verificar JWT porque:
- Reciben requests directamente desde el frontend (sin JWT de Supabase Auth)
- Usan su propio sistema de autenticación (tokens en query params)
- Reciben webhooks externos

### Lista de funciones:

```bash
# Webhooks externos
npx supabase functions deploy wa_webhook --no-verify-jwt

# Frontend del menú web (autenticación por token en query param)
npx supabase functions deploy menu-data --no-verify-jwt
npx supabase functions deploy loan-actions --no-verify-jwt
npx supabase functions deploy loan-web-form --no-verify-jwt
npx supabase functions deploy create-received-loan --no-verify-jwt
npx supabase functions deploy complete-onboarding --no-verify-jwt

# Scheduler (autenticación por SCHEDULER_AUTH_TOKEN)
npx supabase functions deploy scheduler_dispatch --no-verify-jwt
```

## ⚠️ IMPORTANTE

Si despliegas estas funciones SIN el flag `--no-verify-jwt`, se configurarán con `verify_jwt: true` y **fallarán con 401 Unauthorized**.

### Síntomas de deployment incorrecto:
- Error 401 al cargar contactos en formulario
- Error 401 al ver detalle de préstamos
- Error 401 al cargar datos del menú
- Webhook de WhatsApp no responde

### Verificación post-deployment:

```bash
# Usar MCP para verificar configuración
mcp__supabase__list_edge_functions
```

Buscar en el output:
```json
{
  "slug": "nombre-funcion",
  "verify_jwt": false  // ← Debe ser false
}
```

## Funciones que SÍ requieren JWT

Estas funciones están protegidas por Supabase Auth y SÍ deben verificar JWT:

```bash
# Token generators (usan service role key)
npx supabase functions deploy generate-menu-token

# Flows y handlers internos
npx supabase functions deploy flows-handler
npx supabase functions deploy generate-loan-web-link
```

## Sistema de Autenticación

### Frontend del Menú Web
- **Sistema**: Tokens personalizados (short o LLT)
- **Formato Short**: `menu_[tenant]_[contact]_[timestamp]` (1 hora)
- **Formato LLT**: `menu_llt_[tenant]_[contact]_[uuid]_[timestamp]` (30 días)
- **Transporte**: Query parameter `?token=...`
- **Validación**: Función `parseToken()` en cada edge function

### WhatsApp Webhook
- **Sistema**: Verificación de firma HMAC (Meta)
- **Transporte**: Header `X-Hub-Signature-256`
- **Sin JWT**: Es un webhook externo de Meta

## Troubleshooting

### Error: "Token inválido o expirado"
1. Verificar que la función tenga `verify_jwt: false`
2. Verificar que `parseToken()` soporte tokens LLT
3. Verificar que el token esté en `active_sessions` (si es LLT)

### Error: 401 Unauthorized
1. Verificar `verify_jwt: false` con `list_edge_functions`
2. Redesplegar con `--no-verify-jwt`

## Historial de Issues

### 2025-10-15
- **Issue**: loan-actions y loan-web-form retornaban 401
- **Causa**: Desplegadas con `verify_jwt: true` (default)
- **Fix**: Redesplegar con `--no-verify-jwt`
- **Commits**: `c47ffc2`, `1a99ac1`
