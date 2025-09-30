#!/bin/bash

# Script para configurar Telegram bot con el webhook stateful
# Carga las variables del archivo .env

set -e

echo "🔧 Configurando Telegram Bot con Webhook Stateful..."

# Cargar variables de entorno
if [ -f .env ]; then
    set -a
    source .env
    set +a
else
    echo "❌ Archivo .env no encontrado"
    exit 1
fi

# Verificar que las variables necesarias están definidas
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
    echo "❌ TELEGRAM_BOT_TOKEN no está definido en .env"
    exit 1
fi

if [ -z "$TELEGRAM_SECRET_TOKEN" ]; then
    echo "❌ TELEGRAM_SECRET_TOKEN no está definido en .env"
    exit 1
fi

# URL del webhook simple con persistencia en metadata
WEBHOOK_URL="https://qgjxkszfdoolaxmsupil.supabase.co/functions/v1/tg_webhook_simple"

echo "📡 Configurando webhook: $WEBHOOK_URL"

# Configurar webhook con Telegram
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"$WEBHOOK_URL\",
    \"secret_token\": \"$TELEGRAM_SECRET_TOKEN\",
    \"max_connections\": 40,
    \"drop_pending_updates\": true
  }" | jq '.'

echo ""
echo "✅ Webhook configurado. Verificando estado..."

# Verificar la configuración
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo" | jq '.'

echo ""
echo "🎉 ¡Configuración completada!"
echo ""
echo "Ahora puedes probar enviando un mensaje a tu bot:"
echo "1. Envía '/start'"
echo "2. Envía 'Nuevo préstamo'"
echo "3. Sigue las instrucciones del bot"