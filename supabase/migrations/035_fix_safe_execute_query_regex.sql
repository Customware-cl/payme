-- Migración 035: Fix para safe_execute_query regex bug
--
-- PROBLEMA: El regex '^\s*select' en PostgreSQL NO funciona como esperado
-- porque \s NO es un shorthand válido para whitespace en POSIX regex.
-- El regex estaba rechazando queries SELECT válidos.
--
-- SOLUCIÓN: Reemplazar regex con LIKE pattern más simple y rápido.
-- Después de lower(trim()), el query DEBE empezar con 'select'.

CREATE OR REPLACE FUNCTION safe_execute_query(
  sql_query TEXT,
  max_rows INT DEFAULT 100
) RETURNS JSON
SECURITY DEFINER
SET statement_timeout = '10s'
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  result JSON;
  normalized_sql TEXT;
  row_count INT;
BEGIN
  -- Validar que sql_query no sea NULL o vacío
  IF sql_query IS NULL OR trim(sql_query) = '' THEN
    RAISE EXCEPTION 'Query cannot be empty';
  END IF;

  -- Normalizar query para validaciones (lowercase + trim whitespace)
  normalized_sql := lower(trim(sql_query));

  -- =====================================================
  -- VALIDACIÓN 1: Solo SELECT permitido
  -- =====================================================
  -- FIX: Usar LIKE en lugar de regex (más simple y rápido)
  -- Después de lower(trim()), el query DEBE empezar con 'select'
  IF NOT (normalized_sql LIKE 'select%') THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed. Query starts with: %',
      substring(sql_query from 1 for 50);
  END IF;

  -- =====================================================
  -- VALIDACIÓN 2: Detectar keywords destructivos
  -- =====================================================
  IF normalized_sql ~* '\y(drop|delete|update|insert|alter|create|truncate|grant|revoke|execute|call)\y' THEN
    RAISE EXCEPTION 'Destructive SQL keywords detected. Query rejected for security.';
  END IF;

  -- =====================================================
  -- VALIDACIÓN 3: Detectar funciones peligrosas
  -- =====================================================
  IF normalized_sql ~* '\y(pg_sleep|pg_read_file|pg_write_file|pg_ls_dir|dblink|dblink_exec|dblink_connect|lo_import|lo_export|lo_unlink|copy|pg_catalog\.pg_|pg_stat)\y' THEN
    RAISE EXCEPTION 'Dangerous PostgreSQL functions detected. Query rejected.';
  END IF;

  -- =====================================================
  -- VALIDACIÓN 4: Detectar intentos de bypass con comentarios
  -- =====================================================
  IF normalized_sql ~* '(/\*|\*/|--)'  THEN
    RAISE EXCEPTION 'SQL comments detected. Comments are not allowed for security reasons.';
  END IF;

  -- =====================================================
  -- VALIDACIÓN 5: Detectar múltiples statements
  -- =====================================================
  -- Verificar que no haya ';' antes del final (permitir solo al final)
  IF position(';' in rtrim(sql_query)) > 0 AND
     position(';' in rtrim(sql_query)) < length(rtrim(sql_query)) THEN
    RAISE EXCEPTION 'Multiple SQL statements detected (semicolon found). Only single SELECT allowed.';
  END IF;

  -- =====================================================
  -- VALIDACIÓN 6: Verificar tenant_id presente
  -- =====================================================
  IF normalized_sql !~ '\ytenant_id\y' THEN
    RAISE EXCEPTION 'Security violation: Query must filter by tenant_id. This is required for multi-tenancy isolation.';
  END IF;

  -- =====================================================
  -- VALIDACIÓN 7: Detectar acceso a schemas del sistema
  -- =====================================================
  IF normalized_sql ~* '\y(pg_catalog\.|information_schema\.|pg_temp\.|auth\.)\y' THEN
    RAISE EXCEPTION 'Access to system schemas is prohibited.';
  END IF;

  -- =====================================================
  -- VALIDACIÓN 8: Validar límite de filas
  -- =====================================================
  IF max_rows IS NULL OR max_rows < 1 OR max_rows > 1000 THEN
    RAISE EXCEPTION 'Invalid max_rows parameter. Must be between 1 and 1000. Got: %', max_rows;
  END IF;

  -- =====================================================
  -- EJECUTAR QUERY CON LÍMITE DE FILAS
  -- =====================================================
  BEGIN
    -- Ejecutar query y convertir resultado a JSON
    -- COALESCE maneja el caso de 0 resultados retornando []
    EXECUTE format(
      'SELECT COALESCE(json_agg(row_to_json(t)), ''[]''::json) FROM (%s LIMIT %s) t',
      sql_query,
      max_rows
    ) INTO result;

    -- Obtener número de filas retornadas (para logging)
    GET DIAGNOSTICS row_count = ROW_COUNT;

    -- Log exitoso (opcional: insertar en tabla de audit)
    -- INSERT INTO sql_execution_log (query, rows_returned, executed_at)
    -- VALUES (sql_query, row_count, NOW());

    RETURN result;

  EXCEPTION
    WHEN query_canceled THEN
      RAISE EXCEPTION 'Query execution timeout (>10 seconds). Query was cancelled.';

    WHEN syntax_error THEN
      RAISE EXCEPTION 'SQL syntax error: %', SQLERRM;

    WHEN undefined_table THEN
      RAISE EXCEPTION 'Table or column not found: %', SQLERRM;

    WHEN undefined_column THEN
      RAISE EXCEPTION 'Column not found: %', SQLERRM;

    WHEN OTHERS THEN
      RAISE EXCEPTION 'Query execution failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
  END;

END;
$$;

-- Comentario actualizado
COMMENT ON FUNCTION safe_execute_query(TEXT, INT) IS
'Ejecuta queries SQL SELECT de forma segura con múltiples validaciones de seguridad.
Solo accesible desde Edge Functions (service_role).
Timeout: 10 segundos.
Máximo: 1000 filas.
v2.0.11: Fix de regex bug - ahora usa LIKE para validación de SELECT.
Uso: SELECT * FROM safe_execute_query(''SELECT id FROM agreements WHERE tenant_id = ... LIMIT 10'', 10)';
