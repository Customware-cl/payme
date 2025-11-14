-- Migración 030: Fix tenant_id validation regex
-- El regex anterior usaba \b que no matchea cuando hay alias (a.tenant_id)

-- Drop función existente
DROP FUNCTION IF EXISTS safe_execute_query(TEXT, INT);

-- Recrear con regex corregido
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
  IF sql_query IS NULL OR trim(sql_query) = '' THEN
    RAISE EXCEPTION 'Query cannot be empty';
  END IF;

  normalized_sql := lower(trim(sql_query));

  -- VALIDACIÓN 1: Solo SELECT permitido
  IF normalized_sql !~ '^\\s*select' THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed. Query starts with: %',
      substring(sql_query from 1 for 50);
  END IF;

  -- VALIDACIÓN 2: Detectar keywords destructivos
  IF normalized_sql ~* '\\b(drop|delete|update|insert|alter|create|truncate|grant|revoke|execute|call)\\b' THEN
    RAISE EXCEPTION 'Destructive SQL keywords detected. Query rejected for security.';
  END IF;

  -- VALIDACIÓN 3: Detectar funciones peligrosas
  IF normalized_sql ~* '\\b(pg_sleep|pg_read_file|pg_write_file|pg_ls_dir|dblink|dblink_exec|dblink_connect|lo_import|lo_export|lo_unlink|copy|pg_catalog\\.pg_|pg_stat)\\b' THEN
    RAISE EXCEPTION 'Dangerous PostgreSQL functions detected. Query rejected.';
  END IF;

  -- VALIDACIÓN 4: Detectar intentos de bypass con comentarios
  IF normalized_sql ~* '(/\\*|\\*/|--)'  THEN
    RAISE EXCEPTION 'SQL comments detected. Comments are not allowed for security reasons.';
  END IF;

  -- VALIDACIÓN 5: Detectar múltiples statements
  IF position(';' in rtrim(sql_query)) > 0 AND
     position(';' in rtrim(sql_query)) < length(rtrim(sql_query)) THEN
    RAISE EXCEPTION 'Multiple SQL statements detected (semicolon found). Only single SELECT allowed.';
  END IF;

  -- VALIDACIÓN 6: Verificar tenant_id presente (CORREGIDO)
  -- Busca "tenant_id" con o sin alias (a.tenant_id, agreements.tenant_id, etc.)
  IF normalized_sql !~ 'tenant_id' THEN
    RAISE EXCEPTION 'Security violation: Query must filter by tenant_id. This is required for multi-tenancy isolation.';
  END IF;

  -- VALIDACIÓN 7: Detectar acceso a schemas del sistema
  IF normalized_sql ~* '\\b(pg_catalog\\.|information_schema\\.|pg_temp\\.|auth\\.)\\b' THEN
    RAISE EXCEPTION 'Access to system schemas is prohibited.';
  END IF;

  -- VALIDACIÓN 8: Validar límite de filas
  IF max_rows IS NULL OR max_rows < 1 OR max_rows > 1000 THEN
    RAISE EXCEPTION 'Invalid max_rows parameter. Must be between 1 and 1000. Got: %', max_rows;
  END IF;

  -- EJECUTAR QUERY CON LÍMITE DE FILAS
  BEGIN
    EXECUTE format(
      'SELECT COALESCE(json_agg(row_to_json(t)), ''[]''::json) FROM (%s LIMIT %s) t',
      sql_query,
      max_rows
    ) INTO result;

    GET DIAGNOSTICS row_count = ROW_COUNT;
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

-- Permisos
REVOKE ALL ON FUNCTION safe_execute_query(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION safe_execute_query(TEXT, INT) TO service_role;

COMMENT ON FUNCTION safe_execute_query(TEXT, INT) IS
'Ejecuta queries SQL SELECT de forma segura con múltiples validaciones de seguridad.
v2 - Corregido regex de tenant_id para soportar aliases (a.tenant_id)';
