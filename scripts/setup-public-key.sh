#!/bin/bash

# Script para configurar la clave pública de WhatsApp Flows en Meta
# Uso: ./setup-public-key.sh PHONE_NUMBER_ID SYSTEM_USER_TOKEN

set -e

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "❌ Error: Debes proporcionar el PHONE_NUMBER_ID y SYSTEM_USER_TOKEN"
  echo ""
  echo "Uso: ./setup-public-key.sh PHONE_NUMBER_ID SYSTEM_USER_TOKEN"
  echo ""
  echo "📋 PHONE_NUMBER_ID:"
  echo "   Es el ID del número de teléfono de WhatsApp Business"
  echo "   Para este proyecto: 778143428720890"
  echo ""
  echo "📋 SYSTEM_USER_TOKEN:"
  echo "   1. Ve a: https://business.facebook.com/settings/system-users"
  echo "   2. Crea un System User con permisos Admin"
  echo "   3. Genera token con permisos: whatsapp_business_messaging"
  echo ""
  echo "4. Ejecuta: ./setup-public-key.sh 778143428720890 SYSTEM_TOKEN"
  exit 1
fi

PHONE_NUMBER_ID="$1"
SYSTEM_TOKEN="$2"

echo "🔐 Configurando clave pública de WhatsApp Flows..."
echo "   Phone Number ID: $PHONE_NUMBER_ID"
echo ""

# Leer clave pública
if [ ! -f "whatsapp_flows_public_key.pem" ]; then
  echo "❌ Error: No se encuentra whatsapp_flows_public_key.pem"
  exit 1
fi

PUBLIC_KEY=$(cat whatsapp_flows_public_key.pem)

echo "🔍 Verificando clave pública actual en Meta..."
CURRENT=$(curl -s "https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/whatsapp_business_encryption" \
  -H "Authorization: Bearer ${SYSTEM_TOKEN}")

if echo "$CURRENT" | grep -q "error"; then
  echo "⚠️  No hay clave configurada o error al verificar (puede ser normal):"
  echo "$CURRENT" | python3 -m json.tool
  echo ""
fi

echo "📤 Enviando clave pública a Meta (usando Cloud API format)..."
RESPONSE=$(curl -s -X POST "https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/whatsapp_business_encryption" \
  -H "Authorization: Bearer ${SYSTEM_TOKEN}" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "business_public_key=${PUBLIC_KEY}")

if echo "$RESPONSE" | grep -q "error"; then
  echo "❌ Error al configurar clave pública:"
  echo "$RESPONSE" | python3 -m json.tool
  echo ""
  echo "💡 Posibles causas:"
  echo "  1. PHONE_NUMBER_ID incorrecto (debe ser 778143428720890)"
  echo "  2. System User Token sin permisos (necesita whatsapp_business_messaging)"
  echo "  3. System User sin rol de Admin en Business Manager"
  echo ""
  echo "📖 Documentación:"
  echo "  https://developers.facebook.com/docs/whatsapp/cloud-api/reference/whatsapp-business-encryption"
  exit 1
elif echo "$RESPONSE" | grep -q "success"; then
  echo "✅ Clave pública configurada exitosamente!"
  echo ""
  echo "📊 Respuesta de Meta:"
  echo "$RESPONSE" | python3 -m json.tool
  echo ""
  echo "📌 Próximos pasos:"
  echo "  1. Re-habilitar firma en flows-handler (revertir cambios temporales)"
  echo "  2. Deploy flows-handler actualizado"
  echo "  3. Enviar 'hola' a WhatsApp"
  echo "  4. Click en '👤 Mi Perfil'"
  echo "  5. El Flow debería abrirse correctamente (sin pantalla en blanco)"
  echo "  6. Completar formulario y verificar que se guarden los datos"
else
  echo "⚠️ Respuesta inesperada de Meta:"
  echo "$RESPONSE" | python3 -m json.tool
fi
