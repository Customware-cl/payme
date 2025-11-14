-- Migration: AI Actions Audit
-- Descripción: Tabla para auditoría completa de todas las acciones ejecutadas por el AI Agent
-- Fecha: 2025-01-24
-- Propósito:
--   1. Trazabilidad completa de acciones de IA
--   2. Rate limiting (contar operaciones por periodo)
--   3. Analytics y debugging
--   4. Compliance y rollback

-- =====================================================
-- TABLA: ai_actions_audit
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_actions_audit (
  -- Identificación
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES tenant_contacts(id) ON DELETE CASCADE,

  -- Función ejecutada
  function_name TEXT NOT NULL,
  arguments JSONB NOT NULL DEFAULT '{}',

  -- Resultado
  result JSONB DEFAULT '{}',
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'cancelled', 'pending_confirmation')),
  error_message TEXT,

  -- Control
  risk_level TEXT NOT NULL CHECK (risk_level IN ('readonly', 'low', 'medium', 'high', 'critical')),
  required_confirmation BOOLEAN NOT NULL DEFAULT false,
  was_confirmed BOOLEAN,

  -- Performance
  execution_time_ms INTEGER,
  tokens_used INTEGER,

  -- Auditoría
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,

  -- Metadata adicional (ej: IP, user agent, etc.)
  metadata JSONB DEFAULT '{}'
);

-- =====================================================
-- ÍNDICES
-- =====================================================

-- Para rate limiting: contar operaciones por usuario en periodo
CREATE INDEX idx_ai_actions_audit_rate_limit
  ON ai_actions_audit(tenant_id, contact_id, function_name, created_at DESC);

-- Para analytics: ver acciones por función
CREATE INDEX idx_ai_actions_audit_function
  ON ai_actions_audit(tenant_id, function_name, created_at DESC);

-- Para limpieza de datos antiguos
CREATE INDEX idx_ai_actions_audit_cleanup
  ON ai_actions_audit(created_at DESC);

-- Para debugging: buscar errores
CREATE INDEX idx_ai_actions_audit_errors
  ON ai_actions_audit(tenant_id, status, created_at DESC)
  WHERE status = 'error';

-- =====================================================
-- RLS (Row Level Security)
-- =====================================================

ALTER TABLE ai_actions_audit ENABLE ROW LEVEL SECURITY;

-- Service role puede hacer todo (edge functions)
CREATE POLICY "Service role tiene acceso completo a ai_actions_audit"
  ON ai_actions_audit
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Los usuarios autenticados pueden ver solo sus propias acciones
CREATE POLICY "Usuarios pueden ver sus propias acciones de IA"
  ON ai_actions_audit
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_contacts tc
      WHERE tc.id = ai_actions_audit.contact_id
        AND tc.contact_profile_id = auth.uid()
    )
  );

-- =====================================================
-- COMENTARIOS
-- =====================================================

COMMENT ON TABLE ai_actions_audit IS 'Auditoría completa de acciones ejecutadas por el AI Agent';
COMMENT ON COLUMN ai_actions_audit.function_name IS 'Nombre de la función ejecutada (ej: create_loan, query_loans)';
COMMENT ON COLUMN ai_actions_audit.arguments IS 'Argumentos enviados a la función';
COMMENT ON COLUMN ai_actions_audit.result IS 'Resultado de la ejecución (datos devueltos)';
COMMENT ON COLUMN ai_actions_audit.status IS 'Estado: success, error, cancelled, pending_confirmation';
COMMENT ON COLUMN ai_actions_audit.risk_level IS 'Nivel de riesgo: readonly, low, medium, high, critical';
COMMENT ON COLUMN ai_actions_audit.required_confirmation IS 'Si requería confirmación del usuario';
COMMENT ON COLUMN ai_actions_audit.was_confirmed IS 'Si el usuario confirmó la acción (null = no aplica)';
COMMENT ON COLUMN ai_actions_audit.execution_time_ms IS 'Tiempo de ejecución en milisegundos';
COMMENT ON COLUMN ai_actions_audit.tokens_used IS 'Tokens de OpenAI consumidos (si aplica)';

-- =====================================================
-- FUNCIÓN: Limpiar registros antiguos (retention policy)
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_old_ai_audit_logs()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Eliminar registros mayores a 90 días (ajustable según compliance)
  DELETE FROM ai_actions_audit
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND status != 'error'; -- Mantener errores por más tiempo para debugging

  -- Eliminar errores mayores a 180 días
  DELETE FROM ai_actions_audit
  WHERE created_at < NOW() - INTERVAL '180 days'
    AND status = 'error';

  RAISE NOTICE 'AI audit logs cleanup completed';
END;
$$;

COMMENT ON FUNCTION cleanup_old_ai_audit_logs() IS 'Limpia registros de auditoría antiguos (90 días para success, 180 días para errores)';

-- =====================================================
-- VISTA: Resumen de acciones por función (analytics)
-- =====================================================

CREATE OR REPLACE VIEW ai_actions_summary AS
SELECT
  tenant_id,
  function_name,
  status,
  risk_level,
  COUNT(*) as total_executions,
  COUNT(*) FILTER (WHERE status = 'success') as successful_executions,
  COUNT(*) FILTER (WHERE status = 'error') as failed_executions,
  COUNT(*) FILTER (WHERE required_confirmation = true) as confirmations_required,
  COUNT(*) FILTER (WHERE was_confirmed = true) as confirmations_accepted,
  COUNT(*) FILTER (WHERE was_confirmed = false) as confirmations_rejected,
  AVG(execution_time_ms) as avg_execution_time_ms,
  SUM(tokens_used) as total_tokens_used,
  MIN(created_at) as first_execution,
  MAX(created_at) as last_execution
FROM ai_actions_audit
GROUP BY tenant_id, function_name, status, risk_level;

COMMENT ON VIEW ai_actions_summary IS 'Resumen de acciones del AI Agent para analytics';

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

GRANT SELECT ON ai_actions_summary TO authenticated;
GRANT ALL ON ai_actions_audit TO service_role;
