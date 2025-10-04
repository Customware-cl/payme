#!/bin/bash

# Script para actualizar el Flow JSON en Meta
set -e

FLOW_ID="1293469045408700"
ACCESS_TOKEN="${1:-$(grep WHATSAPP_ACCESS_TOKEN /data2/presta_bot/.env | cut -d= -f2)}"

if [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Error: No se encontró ACCESS_TOKEN"
  exit 1
fi

echo "🔄 Actualizando Flow $FLOW_ID en Meta..."
echo ""

# Actualizar el Flow usando la API de Meta
RESPONSE=$(curl -s -X POST "https://graph.facebook.com/v21.0/${FLOW_ID}/assets" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -F "name=flow.json" \
  -F "asset_type=FLOW_JSON" \
  -F "file=@/data2/presta_bot/whatsapp-flows/profile-flow.json;type=application/json")

if echo "$RESPONSE" | jq -e '.success == true and (.validation_errors | length) == 0' > /dev/null 2>&1; then
  echo "✅ Flow actualizado exitosamente!"
  echo "$RESPONSE" | jq .
elif echo "$RESPONSE" | jq -e '.validation_errors | length > 0' > /dev/null 2>&1; then
  echo "⚠️  Flow actualizado con errores de validación:"
  echo "$RESPONSE" | jq .
  exit 1
else
  echo "❌ Error al actualizar Flow:"
  echo "$RESPONSE" | jq .
  exit 1
fi
