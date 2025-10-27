/**
 * SQL Parser Validator (Validación programática)
 * Primera capa de defensa: valida sintaxis y seguridad sin usar LLM
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const DESTRUCTIVE_KEYWORDS = [
  'DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE',
  'TRUNCATE', 'GRANT', 'REVOKE', 'EXECUTE', 'CALL'
];

const DANGEROUS_FUNCTIONS = [
  'pg_sleep', 'pg_read_file', 'pg_write_file', 'pg_ls_dir',
  'dblink', 'dblink_exec', 'dblink_connect',
  'lo_import', 'lo_export', 'lo_unlink',
  'copy', 'pg_catalog', 'pg_stat'
];

const ALLOWED_TABLES = [
  'agreements',
  'tenant_contacts',
  'contact_profiles'
];

/**
 * Validar SQL de forma programática (sin LLM)
 */
export function validateSQLSyntax(
  sql: string,
  context: {
    requiredTenantId: string;
    maxJoins?: number;
    maxLength?: number;
  }
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Normalizar query (trim, lowercase para comparaciones)
  const trimmedSQL = sql.trim();
  const normalizedSQL = trimmedSQL.toLowerCase();

  // 1. Validar longitud
  const maxLength = context.maxLength || 2000;
  if (trimmedSQL.length === 0) {
    errors.push('Query vacía');
    return { valid: false, errors, warnings };
  }
  if (trimmedSQL.length > maxLength) {
    errors.push(`Query demasiado larga (${trimmedSQL.length} chars, máx ${maxLength})`);
  }

  // 2. DEBE empezar con SELECT
  if (!normalizedSQL.match(/^\s*select/i)) {
    errors.push('Query debe empezar con SELECT');
  }

  // 3. Detectar keywords destructivos
  for (const keyword of DESTRUCTIVE_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(normalizedSQL)) {
      errors.push(`Keyword prohibido detectado: ${keyword}`);
    }
  }

  // 4. Detectar funciones peligrosas
  for (const func of DANGEROUS_FUNCTIONS) {
    const regex = new RegExp(`\\b${func}\\b`, 'i');
    if (regex.test(normalizedSQL)) {
      errors.push(`Función peligrosa detectada: ${func}`);
    }
  }

  // 5. Verificar que tiene tenant_id en WHERE
  const hasTenantIdFilter = normalizedSQL.includes('tenant_id') &&
                             normalizedSQL.includes('where');

  if (!hasTenantIdFilter) {
    errors.push(`CRÍTICO: Falta filtro por tenant_id en WHERE clause`);
  } else {
    // Verificar que usa el tenant_id correcto
    const tenantIdPattern = new RegExp(`tenant_id\\s*=\\s*['"]${context.requiredTenantId}['"]`, 'i');
    if (!tenantIdPattern.test(normalizedSQL)) {
      errors.push(`CRÍTICO: tenant_id no coincide con el esperado (${context.requiredTenantId})`);
    }
  }

  // 6. Detectar múltiples statements (SQL injection)
  // Buscar ';' que no esté al final o que tenga algo después
  const trimmedForSemicolon = trimmedSQL.trimEnd();
  const semicolonIndex = trimmedForSemicolon.indexOf(';');

  if (semicolonIndex !== -1 && semicolonIndex < trimmedForSemicolon.length - 1) {
    errors.push('Múltiples statements detectados (;). Solo se permite una query');
  }

  // 7. Validar número de JOINs
  const maxJoins = context.maxJoins || 3;
  const joinMatches = normalizedSQL.match(/\bjoin\b/gi);
  const joinCount = joinMatches ? joinMatches.length : 0;

  if (joinCount > maxJoins) {
    errors.push(`Demasiados JOINs (${joinCount}, máx ${maxJoins})`);
  }

  // 8. Validar tablas permitidas
  // Extraer nombres de tablas después de FROM y JOIN
  const tablePattern = /(?:from|join)\s+(\w+)/gi;
  const tableMatches = [...normalizedSQL.matchAll(tablePattern)];
  const tablesUsed = tableMatches.map(m => m[1]);

  for (const table of tablesUsed) {
    if (!ALLOWED_TABLES.includes(table)) {
      errors.push(`Tabla no permitida: ${table}. Solo se permiten: ${ALLOWED_TABLES.join(', ')}`);
    }
  }

  // 9. Detectar comentarios (potencial obfuscación)
  if (normalizedSQL.includes('--') || normalizedSQL.includes('/*')) {
    warnings.push('Query contiene comentarios. Se recomienda revisión manual');
  }

  // 10. Detectar UNION (puede ser usado para bypass)
  if (/\bunion\b/i.test(normalizedSQL)) {
    warnings.push('Query contiene UNION. Verificar que no sea intento de bypass');
  }

  // 11. Validar que no intenta acceder a schemas del sistema
  const systemSchemas = ['pg_catalog', 'information_schema', 'pg_temp', 'auth'];
  for (const schema of systemSchemas) {
    if (new RegExp(`\\b${schema}\\.`, 'i').test(normalizedSQL)) {
      errors.push(`Acceso a schema del sistema prohibido: ${schema}`);
    }
  }

  // 12. Detectar subconsultas muy anidadas (potencial DoS)
  const openParens = (normalizedSQL.match(/\(/g) || []).length;
  const closeParens = (normalizedSQL.match(/\)/g) || []).length;

  if (openParens !== closeParens) {
    errors.push('Paréntesis desbalanceados');
  }

  if (openParens > 10) {
    warnings.push('Query con muchas subconsultas anidadas. Puede causar timeout');
  }

  // 13. Detectar funciones de agregación sin GROUP BY (puede ser legítimo)
  const hasAggregation = /\b(sum|count|avg|max|min)\s*\(/i.test(normalizedSQL);
  const hasGroupBy = /\bgroup\s+by\b/i.test(normalizedSQL);

  if (hasAggregation && !hasGroupBy && joinCount > 0) {
    warnings.push('Agregación sin GROUP BY con JOINs. Verificar resultado esperado');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Sanitizar SQL para prevenir inyecciones obvias
 * (Solo para logging/debugging, NO usar para ejecutar)
 */
export function sanitizeSQLForLogging(sql: string): string {
  // Remover comentarios
  let sanitized = sql.replace(/--[^\n]*/g, '');
  sanitized = sanitized.replace(/\/\*.*?\*\//gs, '');

  // Normalizar espacios
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  // Truncar si es muy largo
  if (sanitized.length > 500) {
    sanitized = sanitized.substring(0, 500) + '... (truncado)';
  }

  return sanitized;
}

/**
 * Extraer tablas usadas en la query
 */
export function extractTablesUsed(sql: string): string[] {
  const normalized = sql.toLowerCase();
  const tablePattern = /(?:from|join)\s+(\w+)/gi;
  const matches = [...normalized.matchAll(tablePattern)];
  return [...new Set(matches.map(m => m[1]))];
}

/**
 * Estimar complejidad de la query
 */
export function estimateQueryComplexity(sql: string): 'simple' | 'moderate' | 'complex' {
  const normalized = sql.toLowerCase();

  const joinCount = (normalized.match(/\bjoin\b/gi) || []).length;
  const subqueryCount = (normalized.match(/\bselect\b/gi) || []).length - 1; // -1 por el SELECT principal
  const hasAggregation = /\b(sum|count|avg|max|min|group\s+by)\b/i.test(normalized);
  const hasCTE = /\bwith\b/i.test(normalized);

  if (hasCTE || subqueryCount > 2 || joinCount > 2) {
    return 'complex';
  }

  if (joinCount > 0 || hasAggregation || subqueryCount > 0) {
    return 'moderate';
  }

  return 'simple';
}
