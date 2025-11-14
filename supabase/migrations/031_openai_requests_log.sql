-- Migración 031: Tabla de auditoría para requests de OpenAI
-- Permite analizar payloads, respuestas, tokens y costos

CREATE TABLE IF NOT EXISTS openai_requests_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Context
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES tenant_contacts(id) ON DELETE SET NULL,

  -- Request info
  model TEXT NOT NULL,
  request_type TEXT NOT NULL DEFAULT 'chat_completion', -- chat_completion, transcription, vision
  request_payload JSONB NOT NULL, -- Payload completo enviado a OpenAI

  -- Response info
  response_payload JSONB, -- Respuesta completa de OpenAI (null si error)
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  error_message TEXT,

  -- Tokens y costos
  prompt_tokens INT,
  completion_tokens INT,
  total_tokens INT,
  cached_tokens INT, -- Para prompt caching de OpenAI

  -- Tool calls (para análisis de function calling)
  tool_calls_count INT DEFAULT 0,
  tool_calls JSONB, -- Array de tool calls ejecutados

  -- Metadata
  finish_reason TEXT, -- stop, length, tool_calls, content_filter
  response_time_ms INT, -- Tiempo de respuesta en milisegundos

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para queries eficientes
CREATE INDEX idx_openai_log_tenant_created ON openai_requests_log(tenant_id, created_at DESC);
CREATE INDEX idx_openai_log_contact ON openai_requests_log(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_openai_log_model ON openai_requests_log(model);
CREATE INDEX idx_openai_log_status ON openai_requests_log(status);
CREATE INDEX idx_openai_log_created ON openai_requests_log(created_at DESC);

-- Índice GIN para buscar en payloads (útil para debugging)
CREATE INDEX idx_openai_log_request_payload ON openai_requests_log USING GIN (request_payload);
CREATE INDEX idx_openai_log_response_payload ON openai_requests_log USING GIN (response_payload);

-- RLS Policies
ALTER TABLE openai_requests_log ENABLE ROW LEVEL SECURITY;

-- Solo service_role puede leer/escribir (para evitar que usuarios vean payloads internos)
CREATE POLICY "Service role full access"
  ON openai_requests_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Comentarios para documentación
COMMENT ON TABLE openai_requests_log IS
'Auditoría completa de requests a OpenAI API.
Permite debugging, análisis de costos y optimización de prompts.';

COMMENT ON COLUMN openai_requests_log.request_payload IS
'Payload JSON completo enviado a OpenAI (messages, tools, parameters)';

COMMENT ON COLUMN openai_requests_log.response_payload IS
'Respuesta JSON completa de OpenAI (choices, usage, etc)';

COMMENT ON COLUMN openai_requests_log.cached_tokens IS
'Tokens cacheados por OpenAI prompt caching (reduce costos)';

COMMENT ON COLUMN openai_requests_log.tool_calls IS
'Array de function calls ejecutados en esta interacción';

-- Vista para análisis de costos (basado en precios actuales de OpenAI)
CREATE OR REPLACE VIEW openai_cost_analysis AS
SELECT
  DATE_TRUNC('day', created_at) as date,
  tenant_id,
  model,
  status,
  COUNT(*) as request_count,
  SUM(prompt_tokens) as total_prompt_tokens,
  SUM(completion_tokens) as total_completion_tokens,
  SUM(total_tokens) as total_tokens,
  SUM(cached_tokens) as total_cached_tokens,
  AVG(response_time_ms) as avg_response_time_ms,
  -- Estimación de costo (estos precios deben actualizarse según OpenAI)
  CASE
    WHEN model LIKE 'gpt-5%' THEN
      (SUM(prompt_tokens) * 0.000002 + SUM(completion_tokens) * 0.000008) -- $2/1M input, $8/1M output
    WHEN model LIKE 'gpt-4o%' THEN
      (SUM(prompt_tokens) * 0.0000025 + SUM(completion_tokens) * 0.00001) -- $2.50/1M input, $10/1M output
    WHEN model = 'whisper-1' THEN
      COUNT(*) * 0.006 -- $0.006 por minuto (estimado)
    ELSE 0
  END as estimated_cost_usd
FROM openai_requests_log
GROUP BY DATE_TRUNC('day', created_at), tenant_id, model, status
ORDER BY date DESC;

COMMENT ON VIEW openai_cost_analysis IS
'Análisis diario de costos de OpenAI por tenant y modelo.
NOTA: Los precios son estimaciones y deben actualizarse según la tarifa actual de OpenAI.';
