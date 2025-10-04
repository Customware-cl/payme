#!/bin/bash

# Script para actualizar el token de WhatsApp en la base de datos
# Uso: ./update-whatsapp-token.sh "NUEVO_TOKEN_AQUI"

set -e

if [ -z "$1" ]; then
  echo "❌ Error: Debes proporcionar el nuevo token como argumento"
  echo ""
  echo "Uso: ./update-whatsapp-token.sh \"NUEVO_TOKEN\""
  echo ""
  echo "📋 Pasos para generar un nuevo token:"
  echo "1. Ve a: https://developers.facebook.com/tools/explorer"
  echo "2. Selecciona tu aplicación WhatsApp"
  echo "3. En 'Permissions' busca y selecciona:"
  echo "   - whatsapp_business_management"
  echo "   - whatsapp_business_messaging"
  echo "4. Click en 'Generate Access Token'"
  echo "5. Copia el token y ejecuta:"
  echo "   ./update-whatsapp-token.sh \"TOKEN_COPIADO\""
  exit 1
fi

NEW_TOKEN="$1"
TENANT_ID="d4c43ab8-426f-4bb9-8736-dfe301459590"

echo "🔄 Actualizando token de WhatsApp..."
echo "   Tenant ID: $TENANT_ID"
echo ""

# Leer credenciales del .env
source .env

# Verificar que el token es válido antes de guardarlo
echo "🔍 Verificando validez del token..."
VALIDATION=$(curl -s "https://graph.facebook.com/v21.0/debug_token?input_token=${NEW_TOKEN}&access_token=${NEW_TOKEN}")

if echo "$VALIDATION" | grep -q "error"; then
  echo "❌ Token inválido o expirado:"
  echo "$VALIDATION" | python3 -m json.tool
  exit 1
fi

echo "✅ Token válido"
echo ""

# Actualizar en base de datos
echo "💾 Actualizando en base de datos..."
RESPONSE=$(curl -s -X PATCH "https://qgjxkszfdoolaxmsupil.supabase.co/rest/v1/tenants?id=eq.${TENANT_ID}" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{\"whatsapp_access_token\": \"${NEW_TOKEN}\", \"updated_at\": \"now()\"}")

if echo "$RESPONSE" | grep -q "whatsapp_access_token"; then
  echo "✅ Token actualizado correctamente en la base de datos"
  echo ""
  echo "📊 Detalles del token:"
  echo "$VALIDATION" | python3 -m json.tool | grep -A 5 "data"
  echo ""
  echo "✨ Ahora puedes probar el bot enviando 'hola' a WhatsApp"
else
  echo "❌ Error al actualizar token:"
  echo "$RESPONSE" | python3 -m json.tool
  exit 1
fi
