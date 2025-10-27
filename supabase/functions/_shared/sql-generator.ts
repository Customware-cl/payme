/**
 * SQL Generator (GPT-5-nano)
 * Convierte lenguaje natural a SQL seguro
 */

import { OpenAIClient } from './openai-client.ts';
import type { SchemaInfo } from './schema-provider.ts';
import { estimateQueryComplexity } from './sql-parser-validator.ts';

export interface GeneratedSQL {
  sql: string;
  explanation: string;
  estimatedComplexity: 'simple' | 'moderate' | 'complex';
}

/**
 * Generar SQL desde lenguaje natural usando GPT-5-nano
 */
export async function generateSQL(
  openai: OpenAIClient,
  question: string,
  schema: SchemaInfo
): Promise<GeneratedSQL> {
  const prompt = createGeneratorPrompt(question, schema);

  try {
    const result = await openai.chatCompletion({
      model: 'gpt-5-nano',
      messages: [
        {
          role: 'system',
          content: GENERATOR_SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_completion_tokens: 800,
      verbosity: 'low',
      reasoning_effort: 'low'
      // temperature omitido - gpt-5-nano solo acepta default (1)
    });

    if (!result.success || !result.data) {
      throw new Error('Error llamando a OpenAI: ' + result.error);
    }

    const responseText = result.data.choices[0]?.message?.content || '';

    // Intentar parsear respuesta JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Respuesta del generador no contiene JSON válido');
    }

    const generated = JSON.parse(jsonMatch[0]);

    if (!generated.sql) {
      throw new Error('Respuesta del generador no contiene campo "sql"');
    }

    // Estimar complejidad
    const complexity = estimateQueryComplexity(generated.sql);

    return {
      sql: generated.sql.trim(),
      explanation: generated.explanation || 'SQL generado',
      estimatedComplexity: complexity
    };

  } catch (error) {
    console.error('[SQL Generator] Error:', error);
    throw new Error(`Error generando SQL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

const GENERATOR_SYSTEM_PROMPT = `Eres un experto en SQL para PostgreSQL especializado en generar queries SEGURAS para un sistema de gestión de préstamos.

TU TAREA:
Convertir preguntas en lenguaje natural a queries SQL válidas y seguras.

REGLAS OBLIGATORIAS AL GENERAR SQL:

1. ✅ SIEMPRE empezar con SELECT
2. ✅ SIEMPRE incluir filtro: WHERE tenant_id = '...'
3. ✅ NUNCA usar: DROP, DELETE, UPDATE, INSERT, ALTER, CREATE, TRUNCATE, GRANT
4. ✅ NUNCA usar funciones peligrosas: pg_sleep, pg_read_file, dblink, COPY
5. ✅ SOLO usar tablas permitidas: agreements, tenant_contacts, contact_profiles
6. ✅ MÁXIMO 3 JOINs
7. ✅ Usar ILIKE para búsquedas de texto (case insensitive)
8. ✅ Siempre filtrar por type = 'loan' en agreements (no servicios)
9. ✅ status = 'active' para préstamos sin devolver
10. ✅ Para fechas usar CURRENT_DATE en lugar de NOW()

CONTEXTO DE PRÉSTAMOS:

- **Yo presté (me deben)**: lender_tenant_contact_id = contacto_actual
- **Yo recibí (debo)**: tenant_contact_id = contacto_actual
- **Vencidos**: due_date < CURRENT_DATE AND status = 'active'
- **Próximos a vencer**: due_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '7 days')

JOINS COMUNES:

\`\`\`sql
-- Obtener nombre del prestatario (borrower)
JOIN tenant_contacts tc_borrower ON tc_borrower.id = a.tenant_contact_id

-- Obtener nombre del prestamista (lender)
JOIN tenant_contacts tc_lender ON tc_lender.id = a.lender_tenant_contact_id

-- Perfil global del contacto
JOIN contact_profiles cp ON cp.id = tc.contact_profile_id
\`\`\`

AGREGACIONES:

- Si usas SUM, COUNT, AVG, MAX, MIN → considera si necesitas GROUP BY
- Para totales globales NO uses GROUP BY
- Para totales por contacto SÍ usa GROUP BY con tc.id, tc.name

FORMATO DE RESPUESTA:

Responde EXCLUSIVAMENTE con JSON (sin markdown, sin \`\`\`sql):

{
  "sql": "SELECT ... FROM ... WHERE ...",
  "explanation": "Explicación breve de qué hace la query y por qué responde a la pregunta"
}

IMPORTANTE:
- Genera SQL limpio, bien formateado
- Usa alias descriptivos (a, tc, cp)
- Ordena resultados cuando sea relevante
- Limita resultados si es necesario (LIMIT)`;

/**
 * Crear prompt para el generador
 */
function createGeneratorPrompt(
  question: string,
  schema: SchemaInfo
): string {
  return `PREGUNTA DEL USUARIO:
"${question}"

SCHEMA DE BASE DE DATOS:

${Object.values(schema.tables).map(table => `
📋 Tabla: **${table.name}**
${table.description}

Columnas:
${table.columns.map(c => `  - ${c.name}: ${c.type}${c.nullable ? ' (nullable)' : ''} - ${c.description}`).join('\n')}

Foreign Keys:
${table.foreignKeys.map(fk => `  - ${fk.column} → ${fk.references} (${fk.description})`).join('\n')}
`).join('\n')}

CONTEXTO DEL USUARIO:
- **Tenant ID**: ${schema.userContext.tenantId} (OBLIGATORIO en WHERE)
- **Usuario actual**: ${schema.userContext.contactId}
- **Contactos disponibles**:
${schema.userContext.contactsList.slice(0, 10).map(c => `  - ${c.name}: ${c.id}`).join('\n')}
${schema.userContext.contactsList.length > 10 ? `  ... y ${schema.userContext.contactsList.length - 10} más` : ''}
- **Fecha actual**: ${schema.currentDate}

RLS POLICIES (DEBES RESPETAR):
${schema.rlsPolicies.map((p, i) => `${i + 1}. ${p}`).join('\n')}

EJEMPLOS DE QUERIES SIMILARES:

${schema.examples.map((ex, i) => `
Ejemplo ${i + 1}:
Pregunta: "${ex.question}"
SQL:
\`\`\`sql
${ex.sql}
\`\`\`
Explicación: ${ex.explanation}
`).join('\n')}

Ahora genera el SQL para responder a la pregunta del usuario. Responde en JSON.`;
}
