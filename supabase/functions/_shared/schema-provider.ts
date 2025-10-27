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
          nullable: false,
          description: 'ID del contacto que recibe el préstamo (borrower/prestatario)'
        },
        {
          name: 'lender_tenant_contact_id',
          type: 'UUID',
          nullable: false,
          description: 'ID del contacto que otorga el préstamo (lender/prestamista)'
        },
        {
          name: 'type',
          type: 'agreement_type',
          nullable: false,
          description: 'Tipo de acuerdo: "loan" (préstamo) o "service" (servicio)'
        },
        {
          name: 'status',
          type: 'agreement_status',
          nullable: false,
          description: 'Estado: "active" (activo), "completed" (completado), "cancelled" (cancelado)'
        },
        {
          name: 'amount',
          type: 'NUMERIC',
          nullable: false,
          description: 'Monto del préstamo en pesos chilenos'
        },
        {
          name: 'due_date',
          type: 'DATE',
          nullable: true,
          description: 'Fecha de vencimiento del préstamo'
        },
        {
          name: 'description',
          type: 'TEXT',
          nullable: true,
          description: 'Descripción o notas del préstamo'
        },
        {
          name: 'created_at',
          type: 'TIMESTAMPTZ',
          nullable: false,
          description: 'Fecha de creación del registro'
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
          name: 'opt_in_status',
          type: 'opt_in_status',
          nullable: false,
          description: 'Estado de opt-in para WhatsApp'
        },
        {
          name: 'created_at',
          type: 'TIMESTAMPTZ',
          nullable: false,
          description: 'Fecha de creación'
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
          type: 'BIGINT',
          nullable: true,
          description: 'ID de Telegram'
        },
        {
          name: 'created_at',
          type: 'TIMESTAMPTZ',
          nullable: false,
          description: 'Fecha de creación'
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
    `status = 'active' indica préstamos activos (sin devolver)`,
    `status = 'completed' indica préstamos devueltos/completados`,
    `due_date < CURRENT_DATE indica préstamos vencidos`,
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
