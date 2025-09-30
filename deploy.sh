#!/bin/bash

# Script de deployment para Bot de Recordatorios
# Despliega migraciones y Edge Functions a Supabase

set -e

echo "🚀 Iniciando deployment del Bot de Recordatorios..."

# Verificar que Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI no encontrado. Instalar con: npm install -g supabase"
    exit 1
fi

# Verificar que está linkeado a un proyecto
if [ ! -f ".supabase/config.toml" ]; then
    echo "❌ Proyecto no linkeado. Ejecutar: supabase link --project-ref YOUR_PROJECT_REF"
    exit 1
fi

echo "📊 Verificando estado del proyecto..."
supabase status

echo "🗃️  Aplicando migraciones de base de datos..."
supabase db push

echo "📦 Generando tipos TypeScript..."
supabase gen types typescript --local > types/database.types.ts

echo "⚡ Desplegando Edge Functions..."

# Desplegar wa_webhook
echo "  📱 Desplegando wa_webhook..."
supabase functions deploy wa_webhook

# Desplegar scheduler_dispatch
echo "  ⏰ Desplegando scheduler_dispatch..."
supabase functions deploy scheduler_dispatch

# Desplegar wa_status_callback
echo "  📋 Desplegando wa_status_callback..."
supabase functions deploy wa_status_callback

echo "🔧 Configurando variables de entorno..."

# Verificar que las variables críticas están configuradas
if [ -f ".env" ]; then
    echo "  ✅ Archivo .env encontrado"

    # Leer variables del .env (solo para verificación local)
    if grep -q "WHATSAPP_ACCESS_TOKEN" .env; then
        echo "  ✅ WhatsApp token configurado"
    else
        echo "  ⚠️  WhatsApp token no encontrado en .env"
    fi
else
    echo "  ⚠️  Archivo .env no encontrado. Usar .env.example como referencia."
fi

echo "🎯 Configuración post-deployment..."

echo ""
echo "📋 Tareas manuales pendientes:"
echo ""
echo "1. 🔑 Configurar variables de entorno en Supabase Dashboard:"
echo "   - Settings > Edge Functions"
echo "   - Agregar WHATSAPP_ACCESS_TOKEN, WHATSAPP_VERIFY_TOKEN, etc."
echo ""
echo "2. 📱 Configurar webhook en Meta for Developers:"
echo "   - URL: https://YOUR_PROJECT_REF.supabase.co/functions/v1/wa_webhook"
echo "   - Verify Token: tu-verify-token"
echo "   - Campos: messages, message_deliveries"
echo ""
echo "3. 📝 Crear y aprobar templates en Meta Business Manager"
echo "   - opt_in_request_es"
echo "   - loan_due_today_es"
echo "   - service_payment_due_es"
echo ""
echo "4. ⏰ Habilitar cron jobs (solo en producción):"
echo "   - Database > SQL Editor en Supabase"
echo "   - Ejecutar comandos SELECT cron.schedule(...)"
echo ""
echo "5. 🏢 Crear primer tenant:"
echo "   - Usar función create_tenant_with_owner()"
echo ""

echo "✅ Deployment completado exitosamente!"
echo ""
echo "🔗 URLs importantes:"
echo "   Dashboard: https://app.supabase.com/project/YOUR_PROJECT_REF"
echo "   Functions: https://app.supabase.com/project/YOUR_PROJECT_REF/functions"
echo "   Database: https://app.supabase.com/project/YOUR_PROJECT_REF/editor"
echo ""
echo "📖 Ver README.md para instrucciones detalladas de configuración."