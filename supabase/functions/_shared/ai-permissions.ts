/**
 * AI Permissions System
 *
 * Sistema de control de permisos para funciones del AI Agent
 * Define qué puede/no puede hacer la IA y bajo qué condiciones
 *
 * Principios:
 * 1. Deny by default - todo requiere permiso explícito
 * 2. Confirmación obligatoria para operaciones de escritura
 * 3. Rate limiting para prevenir abuso
 * 4. Auditoría completa de todas las acciones
 */

/**
 * Niveles de riesgo de las funciones
 */
export enum RiskLevel {
  READONLY = 'readonly',      // Solo lectura, sin modificaciones
  LOW = 'low',                // Modificaciones menores, reversibles
  MEDIUM = 'medium',          // Modificaciones importantes
  HIGH = 'high',              // Modificaciones críticas (dinero, eliminaciones)
  CRITICAL = 'critical'       // Operaciones destructivas
}

/**
 * Cuándo requiere confirmación del usuario
 */
export enum ConfirmationRequired {
  NEVER = 'never',            // Nunca requiere confirmación (ej: consultas)
  CONDITIONAL = 'conditional', // Depende de condiciones (ej: monto alto)
  ALWAYS = 'always'           // Siempre requiere confirmación
}

/**
 * Validaciones para una función
 */
export interface FunctionValidations {
  maxAmount?: number;         // Monto máximo permitido
  maxPerDay?: number;         // Máximo de operaciones por día
  maxPerHour?: number;        // Máximo de operaciones por hora
  requiresExistingRecord?: boolean; // Requiere que el registro exista
  allowedStatuses?: string[]; // Estados permitidos para modificar
}

/**
 * Configuración de permisos para una función
 */
export interface FunctionPermission {
  name: string;
  description: string;
  risk: RiskLevel;
  requiresConfirmation: ConfirmationRequired;
  validations: FunctionValidations;
  enabled: boolean;           // Si está habilitada o no
}

/**
 * Configuración de permisos por función
 *
 * IMPORTANTE: Este es el único lugar donde se definen permisos
 * Cualquier función que NO esté aquí será RECHAZADA
 */
export const FUNCTION_PERMISSIONS: Record<string, FunctionPermission> = {

  // === CONSULTAS (READ-ONLY) ===

  query_loans: {
    name: 'query_loans',
    description: 'Consultar préstamos del usuario (queries pre-definidas simples)',
    risk: RiskLevel.READONLY,
    requiresConfirmation: ConfirmationRequired.NEVER,
    validations: {
      maxPerHour: 30 // Máx 30 consultas por hora (anti-spam)
    },
    enabled: true
  },

  query_loans_dynamic: {
    name: 'query_loans_dynamic',
    description: 'Consultar préstamos con SQL dinámico (Text-to-SQL Agent)',
    risk: RiskLevel.READONLY,
    requiresConfirmation: ConfirmationRequired.NEVER,
    validations: {
      maxPerHour: 20, // Más restrictivo que query_loans (usa más recursos)
      maxPerDay: 100  // Límite diario adicional por costos de LLM
    },
    enabled: true
  },

  search_contacts: {
    name: 'search_contacts',
    description: 'Buscar contactos por nombre',
    risk: RiskLevel.READONLY,
    requiresConfirmation: ConfirmationRequired.NEVER,
    validations: {
      maxPerHour: 20
    },
    enabled: true
  },

  show_uncertainty: {
    name: 'show_uncertainty',
    description: 'Registrar caso de incertidumbre y pedir aclaración',
    risk: RiskLevel.READONLY,
    requiresConfirmation: ConfirmationRequired.NEVER,
    validations: {},
    enabled: true
  },

  // === OPERACIONES DE PRÉSTAMOS ===

  create_loan: {
    name: 'create_loan',
    description: 'Crear nuevo préstamo (lent o borrowed)',
    risk: RiskLevel.HIGH,
    requiresConfirmation: ConfirmationRequired.ALWAYS,
    validations: {
      maxAmount: 100000000, // 100 millones CLP (límite de seguridad)
      maxPerDay: 10 // Máx 10 préstamos por día
    },
    enabled: true
  },

  mark_loan_returned: {
    name: 'mark_loan_returned',
    description: 'Marcar préstamo como devuelto/pagado',
    risk: RiskLevel.HIGH,
    requiresConfirmation: ConfirmationRequired.ALWAYS,
    validations: {
      requiresExistingRecord: true,
      allowedStatuses: ['pending', 'partial'], // Solo préstamos activos
      maxPerDay: 20
    },
    enabled: true
  },

  reschedule_loan: {
    name: 'reschedule_loan',
    description: 'Reprogramar fecha de vencimiento de préstamo',
    risk: RiskLevel.MEDIUM,
    requiresConfirmation: ConfirmationRequired.ALWAYS,
    validations: {
      requiresExistingRecord: true,
      allowedStatuses: ['pending', 'partial', 'overdue'],
      maxPerDay: 15
    },
    enabled: true
  },

  update_loan_amount: {
    name: 'update_loan_amount',
    description: 'Modificar monto de un préstamo',
    risk: RiskLevel.HIGH,
    requiresConfirmation: ConfirmationRequired.ALWAYS,
    validations: {
      maxAmount: 100000000,
      requiresExistingRecord: true,
      allowedStatuses: ['pending'], // Solo si no se ha pagado nada
      maxPerDay: 5
    },
    enabled: false // DESHABILITADO por ahora (muy riesgoso)
  },

  delete_loan: {
    name: 'delete_loan',
    description: 'Eliminar un préstamo',
    risk: RiskLevel.CRITICAL,
    requiresConfirmation: ConfirmationRequired.ALWAYS,
    validations: {
      requiresExistingRecord: true,
      maxPerDay: 3
    },
    enabled: false // DESHABILITADO - requiere confirmación doble
  },

  // === OPERACIONES DE CONTACTOS ===

  create_contact: {
    name: 'create_contact',
    description: 'Crear nuevo contacto',
    risk: RiskLevel.LOW,
    requiresConfirmation: ConfirmationRequired.CONDITIONAL, // Solo si hay contactos similares
    validations: {
      maxPerDay: 15
    },
    enabled: true
  },

  update_contact: {
    name: 'update_contact',
    description: 'Actualizar información de contacto',
    risk: RiskLevel.MEDIUM,
    requiresConfirmation: ConfirmationRequired.ALWAYS,
    validations: {
      requiresExistingRecord: true,
      maxPerDay: 10
    },
    enabled: true
  },

  delete_contact: {
    name: 'delete_contact',
    description: 'Eliminar un contacto',
    risk: RiskLevel.CRITICAL,
    requiresConfirmation: ConfirmationRequired.ALWAYS,
    validations: {
      requiresExistingRecord: true,
      maxPerDay: 2
    },
    enabled: false // DESHABILITADO - muy riesgoso, requiere validaciones extra
  },

  merge_contacts: {
    name: 'merge_contacts',
    description: 'Fusionar contactos duplicados',
    risk: RiskLevel.HIGH,
    requiresConfirmation: ConfirmationRequired.ALWAYS,
    validations: {
      requiresExistingRecord: true,
      maxPerDay: 5
    },
    enabled: false // DESHABILITADO - requiere lógica compleja
  },

  // === RECORDATORIOS Y NOTIFICACIONES ===

  send_reminder: {
    name: 'send_reminder',
    description: 'Enviar recordatorio de pago',
    risk: RiskLevel.MEDIUM,
    requiresConfirmation: ConfirmationRequired.CONDITIONAL, // Solo si no se envió recientemente
    validations: {
      maxPerDay: 5, // Máx 5 recordatorios por día
      requiresExistingRecord: true
    },
    enabled: false // DESHABILITADO por ahora (requiere integración WhatsApp)
  }
};

/**
 * Resultado de validación de permisos
 */
export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  requiresConfirmation: boolean;
  riskLevel: RiskLevel;
}

/**
 * Verificar si una función está permitida
 */
export function checkFunctionPermission(
  functionName: string,
  args?: any
): PermissionCheckResult {
  // 1. Verificar que la función existe en la configuración
  const permission = FUNCTION_PERMISSIONS[functionName];

  if (!permission) {
    return {
      allowed: false,
      reason: `Función "${functionName}" no está registrada en el sistema de permisos`,
      requiresConfirmation: false,
      riskLevel: RiskLevel.CRITICAL
    };
  }

  // 2. Verificar que la función está habilitada
  if (!permission.enabled) {
    return {
      allowed: false,
      reason: `Función "${functionName}" está deshabilitada`,
      requiresConfirmation: false,
      riskLevel: permission.risk
    };
  }

  // 3. Validar monto si aplica
  if (permission.validations.maxAmount && args?.amount) {
    if (args.amount > permission.validations.maxAmount) {
      return {
        allowed: false,
        reason: `Monto ${args.amount} excede el máximo permitido (${permission.validations.maxAmount})`,
        requiresConfirmation: false,
        riskLevel: permission.risk
      };
    }
  }

  // 4. Función permitida
  return {
    allowed: true,
    requiresConfirmation: permission.requiresConfirmation !== ConfirmationRequired.NEVER,
    riskLevel: permission.risk
  };
}

/**
 * Verificar rate limiting para una función
 *
 * @param supabase - Cliente de Supabase
 * @param tenantId - ID del tenant
 * @param contactId - ID del contacto
 * @param functionName - Nombre de la función
 * @returns Si está dentro del rate limit
 */
export async function checkRateLimit(
  supabase: any,
  tenantId: string,
  contactId: string,
  functionName: string
): Promise<{ allowed: boolean; reason?: string; count?: number; limit?: number }> {
  const permission = FUNCTION_PERMISSIONS[functionName];

  if (!permission) {
    return { allowed: false, reason: 'Función no encontrada' };
  }

  const { maxPerDay, maxPerHour } = permission.validations;

  // Si no hay límites, permitir
  if (!maxPerDay && !maxPerHour) {
    return { allowed: true };
  }

  try {
    // Verificar límite por hora
    if (maxPerHour) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const { count: hourCount, error: hourError } = await supabase
        .from('ai_actions_audit')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('contact_id', contactId)
        .eq('function_name', functionName)
        .gte('created_at', oneHourAgo);

      if (hourError) {
        console.error('[RateLimit] Error checking hourly limit:', hourError);
        // En caso de error, permitir (fail open)
        return { allowed: true };
      }

      if ((hourCount || 0) >= maxPerHour) {
        return {
          allowed: false,
          reason: `Límite de ${maxPerHour} operaciones por hora excedido`,
          count: hourCount || 0,
          limit: maxPerHour
        };
      }
    }

    // Verificar límite por día
    if (maxPerDay) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { count: dayCount, error: dayError } = await supabase
        .from('ai_actions_audit')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('contact_id', contactId)
        .eq('function_name', functionName)
        .gte('created_at', oneDayAgo);

      if (dayError) {
        console.error('[RateLimit] Error checking daily limit:', dayError);
        // En caso de error, permitir (fail open)
        return { allowed: true };
      }

      if ((dayCount || 0) >= maxPerDay) {
        return {
          allowed: false,
          reason: `Límite de ${maxPerDay} operaciones por día excedido`,
          count: dayCount || 0,
          limit: maxPerDay
        };
      }
    }

    return { allowed: true };

  } catch (error) {
    console.error('[RateLimit] Exception:', error);
    // En caso de error, permitir (fail open)
    return { allowed: true };
  }
}

/**
 * Obtener lista de funciones habilitadas para el system prompt
 */
export function getEnabledFunctionNames(): string[] {
  return Object.values(FUNCTION_PERMISSIONS)
    .filter(p => p.enabled)
    .map(p => p.name);
}

/**
 * Obtener descripción de permisos para incluir en system prompt
 */
export function getPermissionsDescription(): string {
  const enabled = Object.values(FUNCTION_PERMISSIONS).filter(p => p.enabled);

  const readOnly = enabled.filter(p => p.risk === RiskLevel.READONLY);
  const writes = enabled.filter(p => p.risk !== RiskLevel.READONLY);

  return `
FUNCIONES DISPONIBLES:

Consultas (ejecutan directamente, sin confirmación):
${readOnly.map(p => `- ${p.name}: ${p.description}`).join('\n')}

Operaciones de escritura (REQUIEREN confirmación del usuario):
${writes.map(p => `- ${p.name}: ${p.description} [${p.risk}]`).join('\n')}

REGLAS CRÍTICAS:
1. NUNCA ejecutes operaciones de escritura sin confirmación explícita
2. Si el usuario dice "confirmo" o similar, verifica que haya una acción pendiente de confirmar
3. Si hay ambigüedad, usa show_uncertainty para pedir aclaración
4. Respeta SIEMPRE los límites de montos y operaciones
5. Si una función falla validación, explica claramente por qué al usuario
`;
}
