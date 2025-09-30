#!/bin/bash

# Script para ver logs de la función wa_webhook en tiempo real

echo "📊 Obteniendo logs recientes de wa_webhook..."
echo ""

# Usar la API de Supabase para obtener logs
curl -s "https://api.supabase.com/v1/projects/qgjxkszfdoolaxmsupil/functions/wa_webhook/logs" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnanhrc3pmZG9vbGF4bXN1cGlsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODU4OTk3MSwiZXhwIjoyMDc0MTY1OTcxfQ.G0dkXunOrSLXfX6_Wa9YeWIyyS2wXbU_c18uULKpBH0" \
  | jq -r '.[] | "\(.timestamp) [\(.level)] \(.message)"' 2>/dev/null || echo "No se pudieron obtener logs via API"

echo ""
echo "💡 También puedes ver los logs en:"
echo "https://supabase.com/dashboard/project/qgjxkszfdoolaxmsupil/logs/edge-functions"