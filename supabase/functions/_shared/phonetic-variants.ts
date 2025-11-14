/**
 * Phonetic Variants Generator
 *
 * Genera variantes fonéticas de nombres para mejorar búsqueda en transcripciones de audio.
 * Útil cuando Whisper transcribe nombres con ortografía incorrecta pero fonéticamente correcta.
 *
 * Ejemplos:
 * - "Katy" → ["Katy", "Caty", "Kathy", "Cathi"]
 * - "José" → ["José", "Jose", "Hosé", "Hose"]
 * - "María" → ["María", "Maria", "Marya", "Marlla"]
 */

/**
 * Normaliza texto removiendo acentos, caracteres especiales y convirtiendo a minúsculas
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .replace(/[^a-z0-9\s]/g, '')     // Remover caracteres especiales
    .trim();
}

/**
 * Genera variantes con K/C/Qu intercambiables
 * Útil para: Katy→Caty, Carlos→Karlos, Quique→Kike
 */
function applyKCQVariants(text: string): string[] {
  const variants = new Set<string>([text]);

  // C → K (antes de a, o, u)
  if (text.includes('ca') || text.includes('co') || text.includes('cu')) {
    variants.add(text.replace(/ca/g, 'ka').replace(/co/g, 'ko').replace(/cu/g, 'ku'));
  }

  // K → C
  if (text.includes('ka') || text.includes('ko') || text.includes('ku')) {
    variants.add(text.replace(/ka/g, 'ca').replace(/ko/g, 'co').replace(/ku/g, 'cu'));
  }

  // Qu → K (antes de e, i)
  if (text.includes('que') || text.includes('qui')) {
    variants.add(text.replace(/que/g, 'ke').replace(/qui/g, 'ki'));
  }

  // K → Qu (antes de e, i)
  if (text.includes('ke') || text.includes('ki')) {
    variants.add(text.replace(/ke/g, 'que').replace(/ki/g, 'qui'));
  }

  // C → Qu (antes de e, i)
  if (text.includes('ce') || text.includes('ci')) {
    variants.add(text.replace(/ce/g, 'que').replace(/ci/g, 'qui'));
  }

  return Array.from(variants);
}

/**
 * Genera variantes con Y/LL/I intercambiables (yeísmo)
 * Útil para: Yenny→Jenny, Willy→Wili, Cayetano→Calletano
 */
function applyYLLIVariants(text: string): string[] {
  const variants = new Set<string>([text]);

  // Y → LL (en medio o al final)
  if (text.includes('y')) {
    variants.add(text.replace(/y/g, 'll'));
    // Y → I (al final)
    if (text.endsWith('y')) {
      variants.add(text.slice(0, -1) + 'i');
    }
  }

  // LL → Y
  if (text.includes('ll')) {
    variants.add(text.replace(/ll/g, 'y'));
  }

  // I → Y (al final)
  if (text.endsWith('i')) {
    variants.add(text.slice(0, -1) + 'y');
  }

  return Array.from(variants);
}

/**
 * Genera variantes con H silenciosa
 * Útil para: José→Hosé, Elena→Helena, Hernán→Ernán
 */
function applyHSilentVariants(text: string): string[] {
  const variants = new Set<string>([text]);

  // H al inicio → omitir
  if (text.startsWith('h')) {
    variants.add(text.substring(1));
  } else {
    // Sin H al inicio → agregar
    variants.add('h' + text);
  }

  // H en medio → omitir (ej: ahora → aora)
  if (text.includes('h')) {
    variants.add(text.replace(/h/g, ''));
  }

  return Array.from(variants);
}

/**
 * Genera variantes sin acentos
 * Útil para: María→Maria, José→Jose, Ramón→Ramon
 */
function applyAccentVariants(text: string): string[] {
  const variants = new Set<string>([text]);

  // La normalización ya removió los acentos, pero guardamos ambas versiones
  const withAccents = text
    .replace(/a/g, 'á').replace(/e/g, 'é').replace(/i/g, 'í')
    .replace(/o/g, 'ó').replace(/u/g, 'ú');

  variants.add(text);        // Sin acentos
  variants.add(withAccents); // Con acentos

  return Array.from(variants);
}

/**
 * Genera variantes con S/Z intercambiables (seseo)
 * Útil para: Susana→Zuzana, González→Gonzales
 */
function applySZVariants(text: string): string[] {
  const variants = new Set<string>([text]);

  // S → Z
  if (text.includes('s')) {
    variants.add(text.replace(/s/g, 'z'));
  }

  // Z → S
  if (text.includes('z')) {
    variants.add(text.replace(/z/g, 's'));
  }

  return Array.from(variants);
}

/**
 * Genera variantes con B/V intercambiables (betacismo)
 * Útil para: Victoria→Bictoria, Víctor→Bictor
 */
function applyBVVariants(text: string): string[] {
  const variants = new Set<string>([text]);

  // B → V
  if (text.includes('b')) {
    variants.add(text.replace(/b/g, 'v'));
  }

  // V → B
  if (text.includes('v')) {
    variants.add(text.replace(/v/g, 'b'));
  }

  return Array.from(variants);
}

/**
 * Genera TODAS las variantes fonéticas posibles de un nombre
 *
 * @param name Nombre a generar variantes
 * @returns Array de variantes fonéticas únicas
 *
 * @example
 * generatePhoneticVariants("Katy")
 * // → ["katy", "caty", "kathi", "cathi", "kathy", "cathy", ...]
 */
export function generatePhoneticVariants(name: string): string[] {
  const normalized = normalizeText(name);

  // Empezar con el nombre normalizado
  let variants = new Set<string>([normalized]);

  // Aplicar cada transformación fonética
  const transformations = [
    applyKCQVariants,
    applyYLLIVariants,
    applyHSilentVariants,
    applySZVariants,
    applyBVVariants
  ];

  // Para cada variante actual, aplicar todas las transformaciones
  for (const transform of transformations) {
    const currentVariants = Array.from(variants);
    for (const variant of currentVariants) {
      const newVariants = transform(variant);
      newVariants.forEach(v => variants.add(v));
    }
  }

  // Limitar el número de variantes para evitar explosión combinatoria
  // Priorizamos las variantes más cortas (menos transformaciones)
  const variantsArray = Array.from(variants);
  variantsArray.sort((a, b) => {
    // Primero ordenar por diferencia de longitud con el original
    const diffA = Math.abs(a.length - normalized.length);
    const diffB = Math.abs(b.length - normalized.length);
    if (diffA !== diffB) return diffA - diffB;

    // Luego por longitud total
    return a.length - b.length;
  });

  // Retornar máximo 20 variantes más probables
  return variantsArray.slice(0, 20);
}

/**
 * Verifica si dos nombres son fonéticamente similares
 *
 * @param name1 Primer nombre
 * @param name2 Segundo nombre
 * @returns true si son fonéticamente similares
 */
export function arePhoneticallySimilar(name1: string, name2: string): boolean {
  const variants1 = generatePhoneticVariants(name1);
  const normalized2 = normalizeText(name2);

  return variants1.includes(normalized2);
}
