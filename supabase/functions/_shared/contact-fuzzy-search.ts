/**
 * Búsqueda fuzzy de contactos
 * Permite encontrar contactos aunque el nombre esté escrito de forma aproximada
 *
 * v2.6.0: Agregado soporte para búsqueda fonética en transcripciones de audio
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { generatePhoneticVariants } from './phonetic-variants.ts';

export interface ContactMatch {
  id: string;
  name: string;
  phone_e164: string;
  similarity: number;
  match_type: 'exact' | 'fuzzy' | 'partial';
}

/**
 * Calcular distancia de Levenshtein entre dos strings
 * Usado para fuzzy matching
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  // Inicializar matriz
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Calcular distancia
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Calcular similaridad entre dos strings (0-1)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const normalized1 = str1.toLowerCase().trim();
  const normalized2 = str2.toLowerCase().trim();

  // Exact match
  if (normalized1 === normalized2) {
    return 1.0;
  }

  // Partial match (uno contiene al otro)
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    return 0.8;
  }

  // Fuzzy match usando Levenshtein
  const distance = levenshteinDistance(normalized1, normalized2);
  const maxLength = Math.max(normalized1.length, normalized2.length);

  if (maxLength === 0) return 1.0;

  const similarity = 1 - (distance / maxLength);
  return similarity;
}

/**
 * Normalizar texto para búsqueda
 * Remueve acentos, convierte a minúsculas, etc.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .replace(/[^a-z0-9\s]/g, '') // Remover caracteres especiales
    .trim();
}

/**
 * Buscar contactos por nombre (fuzzy search)
 * v2.6.0: Agregado soporte para búsqueda fonética adaptativa
 */
export async function findContactByName(
  supabase: SupabaseClient,
  tenantId: string,
  searchName: string,
  minSimilarity: number = 0.6,
  usePhoneticVariants: boolean = false  // ← NUEVO: Activar búsqueda fonética
): Promise<{
  success: boolean;
  matches?: ContactMatch[];
  error?: string;
}> {
  try {
    console.log('[ContactFuzzySearch] Searching for:', {
      tenantId,
      searchName,
      minSimilarity,
      usePhoneticVariants
    });

    // Obtener todos los contactos del tenant (con JOIN a contact_profiles)
    const { data: contacts, error } = await supabase
      .from('tenant_contacts')
      .select('id, name, contact_profile_id, contact_profiles(phone_e164)')
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('[ContactFuzzySearch] Error fetching contacts:', error);
      return {
        success: false,
        error: error.message
      };
    }

    if (!contacts || contacts.length === 0) {
      return {
        success: true,
        matches: []
      };
    }

    // Generar variantes fonéticas si está habilitado
    const normalizedSearch = normalizeText(searchName);
    const searchVariants = usePhoneticVariants
      ? generatePhoneticVariants(searchName)
      : [normalizedSearch];

    if (usePhoneticVariants) {
      console.log('[ContactFuzzySearch] Generated phonetic variants:', searchVariants.slice(0, 10));
    }

    const matches: ContactMatch[] = [];

    // Calcular similaridad para cada contacto
    for (const contact of contacts) {
      if (!contact.name) continue;

      const normalizedContactName = normalizeText(contact.name);

      // Buscar mejor match entre todas las variantes fonéticas
      let bestSimilarity = 0;
      let matchedVariant = normalizedSearch;

      for (const variant of searchVariants) {
        const similarity = calculateSimilarity(variant, normalizedContactName);
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          matchedVariant = variant;
        }
      }

      // Determinar tipo de match
      let matchType: 'exact' | 'fuzzy' | 'partial' = 'fuzzy';
      if (bestSimilarity === 1.0) {
        matchType = 'exact';
      } else if (bestSimilarity >= 0.8) {
        matchType = 'partial';
      }

      // Solo incluir si supera el threshold
      if (bestSimilarity >= minSimilarity) {
        matches.push({
          id: contact.id,
          name: contact.name,
          phone_e164: (contact as any).contact_profiles?.phone_e164 || '',
          similarity: bestSimilarity,
          match_type: matchType
        });

        if (usePhoneticVariants && matchedVariant !== normalizedSearch) {
          console.log(`[ContactFuzzySearch] Phonetic match: "${searchName}" → "${contact.name}" via variant "${matchedVariant}" (${(bestSimilarity * 100).toFixed(0)}%)`);
        }
      }
    }

    // Ordenar por similaridad (mayor a menor)
    matches.sort((a, b) => b.similarity - a.similarity);

    console.log('[ContactFuzzySearch] Found matches:', matches.length);

    return {
      success: true,
      matches
    };

  } catch (error) {
    console.error('[ContactFuzzySearch] Exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Buscar contacto por teléfono
 */
export async function findContactByPhone(
  supabase: SupabaseClient,
  tenantId: string,
  phoneE164: string
): Promise<{
  success: boolean;
  contact?: {
    id: string;
    name: string;
    phone_e164: string;
  };
  error?: string;
}> {
  try {
    console.log('[ContactFuzzySearch] Searching by phone:', {
      tenantId,
      phoneE164
    });

    // Buscar por phone_e164 en contact_profiles (con JOIN)
    const { data: contact, error } = await supabase
      .from('tenant_contacts')
      .select('id, name, contact_profile_id, contact_profiles(phone_e164)')
      .eq('tenant_id', tenantId)
      .eq('contact_profiles.phone_e164', phoneE164)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // Not found
        return {
          success: true,
          contact: undefined
        };
      }
      console.error('[ContactFuzzySearch] Error fetching contact:', error);
      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: true,
      contact: contact ? {
        id: contact.id,
        name: contact.name,
        phone_e164: (contact as any).contact_profiles?.phone_e164 || ''
      } : undefined
    };

  } catch (error) {
    console.error('[ContactFuzzySearch] Exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Obtener todos los contactos del usuario (para contexto de IA)
 */
export async function getAllContacts(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{
  success: boolean;
  contacts?: Array<{
    id: string;
    name: string;
    phone_e164: string;
  }>;
  error?: string;
}> {
  try {
    const { data: contacts, error } = await supabase
      .from('tenant_contacts')
      .select('id, name, contact_profile_id, contact_profiles(phone_e164)')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    if (error) {
      console.error('[ContactFuzzySearch] Error fetching all contacts:', error);
      return {
        success: false,
        error: error.message
      };
    }

    // Mapear a la estructura esperada
    const mappedContacts = (contacts || []).map(c => ({
      id: c.id,
      name: c.name,
      phone_e164: (c as any).contact_profiles?.phone_e164 || ''
    }));

    return {
      success: true,
      contacts: mappedContacts
    };

  } catch (error) {
    console.error('[ContactFuzzySearch] Exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Helper para formatear resultados de búsqueda
 */
export function formatMatchResults(matches: ContactMatch[]): string {
  if (matches.length === 0) {
    return 'No se encontraron contactos con ese nombre.';
  }

  if (matches.length === 1) {
    const match = matches[0];
    return `Encontrado: ${match.name} (${match.phone_e164})`;
  }

  // Múltiples matches
  const list = matches.slice(0, 5).map((m, i) =>
    `${i + 1}. ${m.name} (${m.phone_e164})`
  ).join('\n');

  return `Se encontraron varios contactos:\n${list}\n\n¿A cuál te refieres?`;
}

/**
 * Crear contacto nuevo si no existe
 */
export async function createContactIfNotExists(
  supabase: SupabaseClient,
  tenantId: string,
  name: string,
  phoneE164?: string
): Promise<{
  success: boolean;
  contactId?: string;
  isNew?: boolean;
  error?: string;
}> {
  try {
    // Primero intentar encontrar por nombre
    const searchResult = await findContactByName(supabase, tenantId, name, 0.9);

    if (!searchResult.success) {
      return {
        success: false,
        error: searchResult.error
      };
    }

    // Si hay match exacto, retornar
    if (searchResult.matches && searchResult.matches.length > 0) {
      const bestMatch = searchResult.matches[0];
      if (bestMatch.match_type === 'exact' || bestMatch.similarity >= 0.95) {
        return {
          success: true,
          contactId: bestMatch.id,
          isNew: false
        };
      }
    }

    // Si hay teléfono, verificar si existe
    if (phoneE164) {
      const phoneResult = await findContactByPhone(supabase, tenantId, phoneE164);
      if (phoneResult.success && phoneResult.contact) {
        return {
          success: true,
          contactId: phoneResult.contact.id,
          isNew: false
        };
      }
    }

    // Crear nuevo contacto
    const { data: newContact, error } = await supabase
      .from('tenant_contacts')
      .insert({
        tenant_id: tenantId,
        name,
        phone_e164: phoneE164
      })
      .select('id')
      .single();

    if (error) {
      console.error('[ContactFuzzySearch] Error creating contact:', error);
      return {
        success: false,
        error: error.message
      };
    }

    console.log('[ContactFuzzySearch] Created new contact:', newContact.id);

    return {
      success: true,
      contactId: newContact.id,
      isNew: true
    };

  } catch (error) {
    console.error('[ContactFuzzySearch] Exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
