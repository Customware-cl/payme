/**
 * Schema Provider para AI SQL Agent
 * Provee información de schema, RLS policies y contexto para generación de SQL
 */

export interface TableColumn {
  name: string;
  type: string;
  nullable: boolean;
  description: string;
}

export interface TableSchema {
  name: string;
  description: string;
  columns: TableColumn[];
  primaryKey: string;
  foreignKeys: Array<{
    column: string;
    references: string;
    description: string;
  }>;
}

export interface SQLExample {
  question: string;
  sql: string;
  explanation: string;
}

export interface Contact {
  id: string;
  name: string;
  phone_e164?: string;
}

export interface SchemaInfo {
  tables: Record<string, TableSchema>;
  rlsPolicies: string[];
  userContext: {
    tenantId: string;
    contactId: string;
    contactsList: Contact[];
  };
  examples: SQLExample[];
  currentDate: string;
}

/**
 * Obtener schema completo para el AI Agent
 */
export async function getSchemaForAI(
  supabase: any,
  tenantId: string,
  contactId: string
): Promise<SchemaInfo> {
  // 1. Obtener lista de contactos del usuario
  const { data: contacts } = await supabase
    .from('tenant_contacts')
    .select('id, name, contact_profile_id')
    .eq('tenant_id', tenantId)
    .order('name');

  const contactsList: Contact[] = (contacts || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    phone_e164: null // Podríamos hacer JOIN con contact_profiles si es necesario
  }));

  // 2. Schema de tablas
  const tables: Record<string, TableSchema> = {
    agreements: {
      name: 'agreements',
      description: 'Préstamos y acuerdos entre el usuario y sus contactos',
      columns: [
        {
          name: 'id',
          type: 'UUID',
          nullable: false,
          description: 'ID único del préstamo'
        },
        {
          name: 'tenant_id',
          type: 'UUID',
          nullable: false,
          description: 'ID del tenant (OBLIGATORIO en WHERE)'
        },
        {
          name: 'tenant_contact_id',
          type: 'UUID',
          nullable: true,
          description: 'ID del contacto que recibe el préstamo (borrower/prestatario)'
        },
        {
          name: 'lender_tenant_contact_id',
          type: 'UUID',
          nullable: true,
          description: 'ID del contacto que otorga el préstamo (lender/prestamista)'
        },
        {
          name: 'contact_id',
          type: 'UUID',
          nullable: true,
          description: 'LEGACY: Contact ID del borrower. Usar tenant_contact_id en queries nuevos'
        },
        {
          name: 'lender_contact_id',
          type: 'UUID',
          nullable: true,
          description: 'LEGACY: Contact ID del lender. Usar lender_tenant_contact_id en queries nuevos'
        },
        {
          name: 'created_by',
          type: 'UUID',
          nullable: false,
          description: 'ID del usuario que creó el registro'
        },
        {
          name: 'type',
          type: 'agreement_type',
          nullable: false,
          description: 'Tipo de acuerdo: "loan" (préstamo) o "service" (servicio)'
        },
        {
          name: 'title',
          type: 'VARCHAR',
          nullable: false,
          description: 'Título del acuerdo'
        },
        {
          name: 'description',
          type: 'TEXT',
          nullable: true,
          description: 'Descripción o notas del préstamo'
        },
        {
          name: 'item_description',
          type: 'TEXT',
          nullable: true,
          description: 'Descripción del ítem prestado (para préstamos de objetos)'
        },
        {
          name: 'amount',
          type: 'NUMERIC',
          nullable: true,
          description: 'Monto del préstamo en pesos chilenos (nullable para préstamos de objetos)'
        },
        {
          name: 'currency',
          type: 'VARCHAR',
          nullable: true,
          description: 'Moneda del préstamo (default: MXN o CLP según tenant)'
        },
        {
          name: 'start_date',
          type: 'DATE',
          nullable: false,
          description: 'Fecha de inicio del acuerdo'
        },
        {
          name: 'due_date',
          type: 'DATE',
          nullable: true,
          description: 'Fecha de vencimiento del préstamo'
        },
        {
          name: 'status',
          type: 'agreement_status',
          nullable: false,
          description: 'Estado: "active" (activo sin devolver), "completed" (devuelto/pagado), "cancelled", "overdue" (vencido), "returned", "due_soon" (próximo a vencer), "paused", "pending_confirmation" (esperando confirmación del borrower), "rejected" (rechazado por borrower)'
        },
        {
          name: 'borrower_confirmed',
          type: 'BOOLEAN',
          nullable: true,
          description: 'Si el borrower confirmó el préstamo (true=confirmado, false=rechazado, null=pendiente)'
        },
        {
          name: 'borrower_confirmed_at',
          type: 'TIMESTAMPTZ',
          nullable: true,
          description: 'Timestamp de confirmación/rechazo del borrower'
        },
        {
          name: 'borrower_rejection_reason',
          type: 'VARCHAR',
          nullable: true,
          description: 'Razón del rechazo (ej: "never_borrowed", "wrong_amount", "already_returned")'
        },
        {
          name: 'borrower_rejection_details',
          type: 'TEXT',
          nullable: true,
          description: 'Detalles adicionales del rechazo proporcionados por el borrower'
        },
        {
          name: 'created_at',
          type: 'TIMESTAMPTZ',
          nullable: false,
          description: 'Fecha de creación del registro'
        },
        {
          name: 'updated_at',
          type: 'TIMESTAMPTZ',
          nullable: false,
          description: 'Fecha de última actualización'
        },
        {
          name: 'completed_at',
          type: 'TIMESTAMPTZ',
          nullable: true,
          description: 'Timestamp cuando el préstamo fue completado/devuelto'
        }
      ],
      primaryKey: 'id',
      foreignKeys: [
        {
          column: 'tenant_id',
          references: 'tenants(id)',
          description: 'Relación con el tenant'
        },
        {
          column: 'tenant_contact_id',
          references: 'tenant_contacts(id)',
          description: 'Contacto que recibe el préstamo (borrower)'
        },
        {
          column: 'lender_tenant_contact_id',
          references: 'tenant_contacts(id)',
          description: 'Contacto que otorga el préstamo (lender)'
        }
      ]
    },
    tenant_contacts: {
      name: 'tenant_contacts',
      description: 'Contactos del tenant (incluye al usuario mismo)',
      columns: [
        {
          name: 'id',
          type: 'UUID',
          nullable: false,
          description: 'ID único del contacto en el tenant'
        },
        {
          name: 'tenant_id',
          type: 'UUID',
          nullable: false,
          description: 'ID del tenant (OBLIGATORIO en WHERE)'
        },
        {
          name: 'contact_profile_id',
          type: 'UUID',
          nullable: false,
          description: 'Referencia al perfil global del contacto'
        },
        {
          name: 'name',
          type: 'VARCHAR',
          nullable: false,
          description: 'Nombre del contacto (personalizado por el tenant)'
        },
        {
          name: 'nickname',
          type: 'VARCHAR',
          nullable: true,
          description: 'Apodo o nombre corto'
        },
        {
          name: 'preferred_channel',
          type: 'VARCHAR',
          nullable: true,
          description: 'Canal preferido: "whatsapp", "telegram", "auto"'
        },
        {
          name: 'whatsapp_id',
          type: 'VARCHAR',
          nullable: true,
          description: 'ID de WhatsApp del contacto'
        },
        {
          name: 'opt_in_status',
          type: 'opt_in_status',
          nullable: false,
          description: 'Estado de opt-in para WhatsApp: "pending", "opted_in", "opted_out"'
        },
        {
          name: 'opt_in_date',
          type: 'TIMESTAMPTZ',
          nullable: true,
          description: 'Fecha de opt-in para WhatsApp'
        },
        {
          name: 'opt_out_date',
          type: 'TIMESTAMPTZ',
          nullable: true,
          description: 'Fecha de opt-out para WhatsApp'
        },
        {
          name: 'telegram_opt_in_status',
          type: 'opt_in_status',
          nullable: true,
          description: 'Estado de opt-in para Telegram: "pending", "opted_in", "opted_out"'
        },
        {
          name: 'timezone',
          type: 'VARCHAR',
          nullable: true,
          description: 'Zona horaria del contacto'
        },
        {
          name: 'preferred_language',
          type: 'VARCHAR',
          nullable: true,
          description: 'Idioma preferido (default: "es")'
        },
        {
          name: 'metadata',
          type: 'JSONB',
          nullable: true,
          description: 'Metadata adicional del contacto'
        },
        {
          name: 'created_at',
          type: 'TIMESTAMPTZ',
          nullable: false,
          description: 'Fecha de creación'
        },
        {
          name: 'updated_at',
          type: 'TIMESTAMPTZ',
          nullable: false,
          description: 'Fecha de última actualización'
        }
      ],
      primaryKey: 'id',
      foreignKeys: [
        {
          column: 'tenant_id',
          references: 'tenants(id)',
          description: 'Relación con el tenant'
        },
        {
          column: 'contact_profile_id',
          references: 'contact_profiles(id)',
          description: 'Perfil global del contacto'
        }
      ]
    },
    contact_profiles: {
      name: 'contact_profiles',
      description: 'Perfiles globales de contactos (compartidos entre tenants)',
      columns: [
        {
          name: 'id',
          type: 'UUID',
          nullable: false,
          description: 'ID único del perfil'
        },
        {
          name: 'phone_e164',
          type: 'VARCHAR',
          nullable: true,
          description: 'Teléfono en formato E.164 (+56912345678)'
        },
        {
          name: 'telegram_id',
          type: 'VARCHAR',
          nullable: true,
          description: 'ID de usuario de Telegram'
        },
        {
          name: 'telegram_username',
          type: 'VARCHAR',
          nullable: true,
          description: 'Username de Telegram (@usuario)'
        },
        {
          name: 'telegram_first_name',
          type: 'VARCHAR',
          nullable: true,
          description: 'Nombre en Telegram'
        },
        {
          name: 'telegram_last_name',
          type: 'VARCHAR',
          nullable: true,
          description: 'Apellido en Telegram'
        },
        {
          name: 'first_name',
          type: 'VARCHAR',
          nullable: true,
          description: 'Nombre del contacto'
        },
        {
          name: 'last_name',
          type: 'VARCHAR',
          nullable: true,
          description: 'Apellido del contacto'
        },
        {
          name: 'email',
          type: 'VARCHAR',
          nullable: true,
          description: 'Email del contacto'
        },
        {
          name: 'bank_accounts',
          type: 'JSONB',
          nullable: true,
          description: 'Array de cuentas bancarias con campos: rut, bank_name, account_type, account_number, account_holder_name'
        },
        {
          name: 'verified',
          type: 'BOOLEAN',
          nullable: true,
          description: 'Si el perfil está verificado'
        },
        {
          name: 'created_at',
          type: 'TIMESTAMPTZ',
          nullable: false,
          description: 'Fecha de creación'
        },
        {
          name: 'updated_at',
          type: 'TIMESTAMPTZ',
          nullable: false,
          description: 'Fecha de última actualización'
        }
      ],
      primaryKey: 'id',
      foreignKeys: []
    }
  };

  // 3. RLS Policies (reglas que DEBE respetar el SQL generado)
  const rlsPolicies = [
    `CRÍTICO: TODAS las queries DEBEN filtrar por tenant_id = '${tenantId}'`,
    `El usuario actual es el contacto con ID = '${contactId}'`,
    `Para préstamos donde YO PRESTÉ (me deben): lender_tenant_contact_id = '${contactId}'`,
    `Para préstamos donde YO RECIBÍ (debo): tenant_contact_id = '${contactId}'`,
    `Solo se pueden consultar tablas: agreements, tenant_contacts, contact_profiles`,
    `NO se pueden hacer JOINs con: users, tenants, whatsapp_messages, auth.*`,
    `STATUS de préstamos - IMPORTANTE:`,
    `  - 'active': Préstamo activo, sin devolver, no vencido, confirmado`,
    `  - 'overdue': Vencido sin devolver (actualizado automáticamente por función de BD)`,
    `  - 'due_soon': Vence en < 24h (actualizado automáticamente)`,
    `  - 'pending_confirmation': Esperando confirmación del borrower`,
    `  - 'rejected': Rechazado por borrower (mostrar SOLO si se pregunta explícitamente)`,
    `  - 'completed'/'returned': Devuelto/pagado completamente`,
    `  - 'cancelled': Cancelado por acuerdo mutuo`,
    `Para balance: filtrar por status IN ('active', 'overdue', 'due_soon', 'pending_confirmation')`,
    `Para vencidos: usar status = 'overdue' (NO usar due_date < CURRENT_DATE con status='active')`,
    `type = 'loan' para filtrar solo préstamos (no servicios)`
  ];

  // 4. Ejemplos de queries (few-shot learning)
  const examples: SQLExample[] = [
    {
      question: 'cuánto me deben en total',
      sql: `SELECT SUM(amount) as total_owed
FROM agreements
WHERE tenant_id = '${tenantId}'
  AND type = 'loan'
  AND status = 'active'
  AND lender_tenant_contact_id = '${contactId}'`,
      explanation: 'Suma de préstamos activos donde yo soy el prestamista (lender)'
    },
    {
      question: 'cuánto le debo a Caty',
      sql: `SELECT SUM(a.amount) as total_owed
FROM agreements a
JOIN tenant_contacts tc ON tc.id = a.lender_tenant_contact_id
WHERE a.tenant_id = '${tenantId}'
  AND a.type = 'loan'
  AND a.status = 'active'
  AND a.tenant_contact_id = '${contactId}'
  AND tc.name ILIKE '%caty%'`,
      explanation: 'Suma de préstamos donde Caty es prestamista y yo soy prestatario'
    },
    {
      question: 'préstamos vencidos',
      sql: `SELECT a.id, a.amount, a.due_date,
       tc_borrower.name as borrower_name,
       tc_lender.name as lender_name
FROM agreements a
JOIN tenant_contacts tc_borrower ON tc_borrower.id = a.tenant_contact_id
JOIN tenant_contacts tc_lender ON tc_lender.id = a.lender_tenant_contact_id
WHERE a.tenant_id = '${tenantId}'
  AND a.type = 'loan'
  AND a.status = 'active'
  AND a.due_date < CURRENT_DATE
  AND (a.lender_tenant_contact_id = '${contactId}' OR a.tenant_contact_id = '${contactId}')
ORDER BY a.due_date ASC`,
      explanation: 'Préstamos vencidos donde participo como prestamista o prestatario'
    },
    {
      question: 'contactos con más de 2 préstamos activos',
      sql: `SELECT tc.name, COUNT(a.id) as loan_count, SUM(a.amount) as total_amount
FROM tenant_contacts tc
JOIN agreements a ON (a.tenant_contact_id = tc.id OR a.lender_tenant_contact_id = tc.id)
WHERE a.tenant_id = '${tenantId}'
  AND a.type = 'loan'
  AND a.status = 'active'
  AND (a.lender_tenant_contact_id = '${contactId}' OR a.tenant_contact_id = '${contactId}')
  AND tc.id != '${contactId}'
GROUP BY tc.id, tc.name
HAVING COUNT(a.id) > 2
ORDER BY loan_count DESC`,
      explanation: 'Contactos con múltiples préstamos activos conmigo'
    },
    {
      question: 'balance detallado categorizado por vencimiento y confirmación',
      sql: `-- Préstamos otorgados (me deben) categorizados
WITH lent_categorized AS (
  SELECT
    CASE
      WHEN status = 'overdue' THEN 'vencidos'
      WHEN status = 'due_soon' THEN 'por_vencer_24h'
      WHEN status = 'pending_confirmation' THEN 'sin_confirmar'
      WHEN status = 'active' THEN 'al_dia'
    END as categoria,
    SUM(amount) as total,
    COUNT(*) as cantidad
  FROM agreements
  WHERE tenant_id = '${tenantId}'
    AND type = 'loan'
    AND lender_tenant_contact_id = '${contactId}'
    AND status IN ('active', 'overdue', 'due_soon', 'pending_confirmation')
  GROUP BY categoria
),
-- Préstamos recibidos (debo) categorizados
borrowed_categorized AS (
  SELECT
    CASE
      WHEN status = 'overdue' THEN 'vencidos'
      WHEN status = 'due_soon' THEN 'por_vencer_24h'
      WHEN status = 'active' THEN 'al_dia'
    END as categoria,
    SUM(amount) as total,
    COUNT(*) as cantidad
  FROM agreements
  WHERE tenant_id = '${tenantId}'
    AND type = 'loan'
    AND tenant_contact_id = '${contactId}'
    AND status IN ('active', 'overdue', 'due_soon')
  GROUP BY categoria
)
-- Combinar ambos resultados
SELECT 'prestado' as direccion, categoria, total, cantidad FROM lent_categorized
UNION ALL
SELECT 'recibido' as direccion, categoria, total, cantidad FROM borrowed_categorized
ORDER BY direccion,
  CASE categoria
    WHEN 'vencidos' THEN 1
    WHEN 'por_vencer_24h' THEN 2
    WHEN 'sin_confirmar' THEN 3
    WHEN 'al_dia' THEN 4
  END`,
      explanation: 'Balance detallado con categorización por status: vencidos (overdue), por vencer (due_soon), sin confirmar (pending_confirmation), al día (active). Separado por dirección (prestado/recibido).'
    },
    {
      question: 'préstamos pendientes de confirmación',
      sql: `SELECT a.id, a.amount, a.start_date, a.due_date,
       tc_borrower.name as borrower_name
FROM agreements a
JOIN tenant_contacts tc_borrower ON tc_borrower.id = a.tenant_contact_id
WHERE a.tenant_id = '${tenantId}'
  AND a.type = 'loan'
  AND a.status = 'pending_confirmation'
  AND a.lender_tenant_contact_id = '${contactId}'
ORDER BY a.created_at DESC`,
      explanation: 'Préstamos que YO CREÉ pero están esperando confirmación del borrower (status = pending_confirmation)'
    }
  ];

  return {
    tables,
    rlsPolicies,
    userContext: {
      tenantId,
      contactId,
      contactsList
    },
    examples,
    currentDate: new Date().toISOString().split('T')[0] // YYYY-MM-DD
  };
}
