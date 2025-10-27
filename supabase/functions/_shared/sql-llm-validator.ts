/**
 * SQL LLM Validator (Validación con GPT-5-nano)
 * Segunda capa: valida lógica de negocio y seguridad semántica
 */

import { OpenAIClient } from './openai-client.ts';
import type { SchemaInfo } from './schema-provider.ts';

export interface LLMValidationResult {
  approved: boolean;
  confidence: number; // 0-100
  issues: string[];
  suggestedFix?: string;
  reasoning: string;
}

/**
 * Validar SQL usando GPT-5-nano como security reviewer
 */
export async function validateSQLWithLLM(
  openai: OpenAIClient,
  sql: string,
  schema: SchemaInfo,
  originalQuestion: string
): Promise<LLMValidationResult> {
  const prompt = createValidatorPrompt(sql, schema, originalQuestion);

  try {
    const result = await openai.chatCompletion({
      model: 'gpt-5-nano',
      messages: [
        {
          role: 'system',
          content: VALIDATOR_SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_completion_tokens: 500,
      verbosity: 'low',
      reasoning_effort: 'low',
      temperature: 0.1 // Muy determinístico para validación
    });

    if (!result.success || !result.data) {
      throw new Error('Error llamando a OpenAI: ' + result.error);
    }

    const responseText = result.data.choices[0]?.message?.content || '';

    // Intentar parsear respuesta JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Respuesta del validador no contiene JSON válido');
    }

    const validation = JSON.parse(jsonMatch[0]);

    return {
      approved: validation.approved === true && validation.confidence >= 95,
      confidence: validation.confidence || 0,
      issues: validation.issues || [],
      suggestedFix: validation.suggested_fix,
      reasoning: validation.reasoning || ''
    };

  } catch (error) {
    console.error('[LLM Validator] Error:', error);
    return {
      approved: false,
      confidence: 0,
      issues: [`Error en validación LLM: ${error instanceof Error ? error.message : 'Unknown error'}`],
      reasoning: 'Falló la validación por error técnico'
    };
  }
}

const VALIDATOR_SYSTEM_PROMPT = `Eres un SECURITY REVIEWER especializado en SQL para PostgreSQL.

Tu ÚNICA tarea es validar si una query SQL es SEGURA y CORRECTA.

REGLAS OBLIGATORIAS - Marca como NO APPROVED si falla CUALQUIERA:

1. ✅ DEBE empezar con SELECT (case insensitive)
2. ✅ DEBE contener "WHERE ... tenant_id = '...' "
3. ✅ NO DEBE contener keywords: DROP, DELETE, UPDATE, INSERT, ALTER, CREATE, TRUNCATE, GRANT, REVOKE, EXECUTE
4. ✅ NO DEBE usar funciones: pg_sleep, pg_read_file, pg_write_file, dblink, lo_*, COPY
5. ✅ NO DEBE tener múltiples statements (no debe haber ; seguido de otra query)
6. ✅ MÁXIMO 3 JOINs
7. ✅ SOLO tablas permitidas: agreements, tenant_contacts, contact_profiles
8. ✅ NO DEBE acceder a schemas del sistema: pg_catalog, information_schema, auth.*
9. ✅ La lógica DEBE responder correctamente a la pregunta original del usuario
10. ✅ Los JOINs DEBEN usar las foreign keys correctas según el schema

VALIDACIONES ADICIONALES:

- Si usa tenant_contact_id o lender_tenant_contact_id, verificar que la lógica sea correcta según el contexto
- Si la pregunta menciona "me deben", debe usar lender_tenant_contact_id = usuario_actual
- Si la pregunta menciona "debo" o "me prestaron", debe usar tenant_contact_id = usuario_actual
- Verificar que agregaciones (SUM, COUNT) tengan sentido con los GROUP BY
- Detectar timing attacks potenciales (eg: queries muy lentas a propósito)

CRITERIOS DE CONFIDENCE:

- 100: Query perfecta, segura, responde exactamente a la pregunta
- 90-99: Query correcta pero podría optimizarse
- 80-89: Query funcional pero tiene pequeños problemas (puedes sugerir fix)
- 70-79: Query con problemas lógicos o de seguridad menores
- < 70: Query rechazada por problemas graves

THRESHOLD: Solo apruebas si confidence >= 95%

RESPONDE EXCLUSIVAMENTE CON JSON (sin markdown, sin explicaciones extra):

{
  "approved": true/false,
  "confidence": 0-100,
  "issues": ["lista de problemas encontrados, vacío si no hay"],
  "suggested_fix": "SQL corregido SOLO si confidence entre 80-94, null si no aplica",
  "reasoning": "breve explicación de tu decisión (máx 100 palabras)"
}`;

/**
 * Crear prompt para el validator
 */
function createValidatorPrompt(
  sql: string,
  schema: SchemaInfo,
  originalQuestion: string
): string {
  return `PREGUNTA ORIGINAL DEL USUARIO:
"${originalQuestion}"

SQL GENERADO A VALIDAR:
\`\`\`sql
${sql}
\`\`\`

SCHEMA DE BASE DE DATOS:

Tablas permitidas: ${Object.keys(schema.tables).join(', ')}

${Object.values(schema.tables).map(table => `
Tabla: ${table.name}
Descripción: ${table.description}
Columnas: ${table.columns.map(c => `${c.name} (${c.type})`).join(', ')}
`).join('\n')}

RLS POLICIES QUE DEBE RESPETAR:
${schema.rlsPolicies.map((p, i) => `${i + 1}. ${p}`).join('\n')}

CONTEXTO DEL USUARIO:
- Tenant ID: ${schema.userContext.tenantId}
- Usuario actual (contact_id): ${schema.userContext.contactId}
- Contactos disponibles: ${schema.userContext.contactsList.map(c => `${c.name} (${c.id})`).join(', ')}
- Fecha actual: ${schema.currentDate}

VALIDA ESTA QUERY Y RESPONDE EN JSON.`;
}
