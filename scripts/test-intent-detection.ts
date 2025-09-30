#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

// Test de detección de intenciones localmente

// Copiar la lógica del IntentDetector
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[áà]/g, 'a')
    .replace(/[éè]/g, 'e')
    .replace(/[íì]/g, 'i')
    .replace(/[óò]/g, 'o')
    .replace(/[úù]/g, 'u')
    .replace(/ñ/g, 'n')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Test cases
const testCases = [
  { input: 'nuevo préstamo', expected: 'new_loan' },
  { input: 'nuevo prestamo', expected: 'new_loan' },
  { input: 'NUEVO PRÉSTAMO', expected: 'new_loan' },
  { input: 'quiero hacer un nuevo préstamo', expected: 'new_loan' },
  { input: 'crear préstamo', expected: 'new_loan' },
  { input: 'prestar dinero', expected: 'new_loan' },
  { input: 'estado', expected: 'general_inquiry' },
  { input: 'ayuda', expected: 'general_inquiry' },
];

console.log('🧪 Pruebas de normalización de texto:\n');

for (const testCase of testCases) {
  const normalized = normalizeText(testCase.input);
  const hasPrestar = normalized.includes('prestar');
  const hasPrestamo = normalized.includes('prestamo');
  const hasNuevo = normalized.includes('nuevo');

  console.log(`Input: "${testCase.input}"`);
  console.log(`  Normalizado: "${normalized}"`);
  console.log(`  Contiene "prestar": ${hasPrestar}`);
  console.log(`  Contiene "prestamo": ${hasPrestamo}`);
  console.log(`  Contiene "nuevo": ${hasNuevo}`);

  // Detectar según las reglas del IntentDetector
  let detected = 'general_inquiry';
  if (hasPrestar || hasPrestamo || normalized.includes('nuevo prestamo')) {
    detected = 'new_loan';
  }

  console.log(`  Esperado: ${testCase.expected}`);
  console.log(`  Detectado: ${detected}`);
  console.log(`  ${detected === testCase.expected ? '✅' : '❌'}`);
  console.log('');
}