// Sistema de Detección de Intenciones
// Analiza texto de entrada para determinar la intención del usuario

type FlowType = 'new_loan' | 'new_service' | 'reschedule' | 'confirm_return' | 'confirm_payment' | 'general_inquiry';

interface IntentResult {
  intent: FlowType;
  confidence: number;
  entities?: Record<string, any>;
  reasoning?: string;
}

interface KeywordPattern {
  keywords: string[];
  weight: number;
  required?: boolean;
}

interface IntentDefinition {
  name: FlowType;
  patterns: KeywordPattern[];
  examples: string[];
  minConfidence: number;
}

export class IntentDetector {
  private intents: IntentDefinition[];

  constructor() {
    this.intents = this.initializeIntents();
  }

  private initializeIntents(): IntentDefinition[] {
    return [
      {
        name: 'new_loan',
        minConfidence: 0.15,
        patterns: [
          { keywords: ['prestamo'], weight: 1.0, required: true }, // Simplificado para mejor score
          { keywords: ['nuevo', 'crear', 'registrar'], weight: 0.3 },
          { keywords: ['dinero', 'plata', 'efectivo', 'pesos'], weight: 0.1 }
        ],
        examples: [
          'quiero crear un nuevo préstamo',
          'voy a prestar dinero',
          'necesito registrar un préstamo',
          'le voy a prestar mi herramienta',
          'quiero anotar que presté',
          'crear préstamo nuevo'
        ]
      },
      {
        name: 'reschedule',
        minConfidence: 0.7,
        patterns: [
          { keywords: ['reprogramar', 'cambiar', 'mover', 'posponer'], weight: 0.9, required: true },
          { keywords: ['fecha', 'día', 'cuando', 'tiempo'], weight: 0.4 },
          { keywords: ['otro', 'diferente', 'nueva'], weight: 0.2 },
          { keywords: ['no puedo', 'imposible', 'problema'], weight: 0.1 }
        ],
        examples: [
          'quiero reprogramar',
          'cambiar la fecha',
          'mover para otro día',
          'posponer el pago',
          'no puedo el día acordado',
          'nueva fecha por favor'
        ]
      },
      {
        name: 'new_service',
        minConfidence: 0.6,
        patterns: [
          { keywords: ['servicio', 'cobro', 'mensual', 'recurrente'], weight: 0.8, required: true },
          { keywords: ['suscripción', 'abono', 'renta'], weight: 0.6 },
          { keywords: ['cada', 'todos', 'frecuencia'], weight: 0.3 },
          { keywords: ['mes', 'semana', 'quincena'], weight: 0.2 },
          { keywords: ['automático', 'programar', 'configurar'], weight: 0.2 }
        ],
        examples: [
          'configurar un servicio mensual',
          'cobro recurrente',
          'quiero crear una suscripción',
          'servicio que se cobre cada mes',
          'renta mensual',
          'abono semanal automático'
        ]
      },
      {
        name: 'confirm_return',
        minConfidence: 0.8,
        patterns: [
          { keywords: ['devolvieron', 'regresaron', 'entregaron'], weight: 1.0, required: true },
          { keywords: ['ya', 'completado', 'listo', 'terminado'], weight: 0.3 },
          { keywords: ['recibí', 'tengo', 'llegó'], weight: 0.4 },
          { keywords: ['gracias', 'perfecto', 'bien'], weight: 0.1 }
        ],
        examples: [
          'ya me devolvieron',
          'me regresaron el dinero',
          'ya me entregaron',
          'recibí mi herramienta',
          'ya tengo mi préstamo de vuelta',
          'me devolvieron todo'
        ]
      },
      {
        name: 'confirm_payment',
        minConfidence: 0.8,
        patterns: [
          { keywords: ['pagué', 'pagado', 'pago', 'transferí'], weight: 1.0, required: true },
          { keywords: ['ya', 'completado', 'listo', 'hecho'], weight: 0.3 },
          { keywords: ['deposité', 'envié', 'mandé'], weight: 0.4 },
          { keywords: ['efectivo', 'transferencia', 'tarjeta'], weight: 0.2 }
        ],
        examples: [
          'ya pagué',
          'hice el pago',
          'transferí el dinero',
          'pagué en efectivo',
          'ya está pagado',
          'completé el pago'
        ]
      },
      {
        name: 'general_inquiry',
        minConfidence: 0.3,
        patterns: [
          { keywords: ['ayuda', 'help', 'qué', 'cómo', 'duda'], weight: 0.5 },
          { keywords: ['estado', 'status', 'información'], weight: 0.4 },
          { keywords: ['hola', 'buenos', 'buenas', 'saludos'], weight: 0.3 },
          { keywords: ['consulta', 'pregunta', 'información'], weight: 0.4 }
        ],
        examples: [
          'hola',
          'necesito ayuda',
          'qué puedo hacer',
          'cómo funciona',
          'tengo una duda',
          'estado de mis préstamos'
        ]
      }
    ];
  }

  // Detectar intención principal
  detectIntent(text: string): IntentResult {
    const normalizedText = this.normalizeText(text);
    const scores = this.calculateIntentScores(normalizedText);

    // Encontrar la intención con mayor score
    const bestMatch = Object.entries(scores)
      .map(([intent, score]) => ({ intent: intent as FlowType, score }))
      .sort((a, b) => b.score - a.score)[0];

    const intentDef = this.intents.find(i => i.name === bestMatch.intent);
    const confidence = bestMatch.score;

    // Verificar si cumple el umbral mínimo de confianza
    if (confidence < (intentDef?.minConfidence || 0.5)) {
      return {
        intent: 'general_inquiry',
        confidence: 0.9,
        reasoning: `Confianza insuficiente para ${bestMatch.intent} (${confidence.toFixed(2)})`
      };
    }

    // Extraer entidades básicas
    const entities = this.extractEntities(normalizedText, bestMatch.intent);

    return {
      intent: bestMatch.intent,
      confidence,
      entities,
      reasoning: `Matched with ${confidence.toFixed(2)} confidence`
    };
  }

  // Calcular scores para todas las intenciones
  private calculateIntentScores(text: string): Record<string, number> {
    const scores: Record<string, number> = {};

    for (const intent of this.intents) {
      let totalScore = 0;
      let requiredMatched = true;

      for (const pattern of intent.patterns) {
        const matchCount = this.countKeywordMatches(text, pattern.keywords);
        const matchRatio = matchCount / pattern.keywords.length;
        const patternScore = matchRatio * pattern.weight;

        totalScore += patternScore;

        // Verificar patrones requeridos
        if (pattern.required && matchCount === 0) {
          requiredMatched = false;
        }
      }

      // Si no se cumplieron patrones requeridos, score = 0
      scores[intent.name] = requiredMatched ? Math.min(totalScore, 1.0) : 0;
    }

    return scores;
  }

  // Contar coincidencias de palabras clave
  private countKeywordMatches(text: string, keywords: string[]): number {
    let matches = 0;
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        matches++;
      }
    }
    return matches;
  }

  // Normalizar texto para análisis
  private normalizeText(text: string): string {
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

  // Extraer entidades básicas del texto
  private extractEntities(text: string, intent: FlowType): Record<string, any> {
    const entities: Record<string, any> = {};

    // Extraer números (montos, fechas numéricas)
    const numbers = text.match(/\d+/g);
    if (numbers) {
      entities.numbers = numbers.map(n => parseInt(n));
    }

    // Extraer fechas relativas
    const dateKeywords = ['mañana', 'hoy', 'ayer', 'semana', 'mes', 'año'];
    const foundDates = dateKeywords.filter(keyword => text.includes(keyword));
    if (foundDates.length > 0) {
      entities.dateReferences = foundDates;
    }

    // Extraer referencias de frecuencia para servicios
    if (intent === 'new_service') {
      const frequencies = ['diario', 'semanal', 'quincenal', 'mensual'];
      const foundFreqs = frequencies.filter(freq => text.includes(freq));
      if (foundFreqs.length > 0) {
        entities.frequency = foundFreqs[0];
      }
    }

    // Extraer moneda
    if (text.includes('peso') || text.includes('$') || text.includes('mxn')) {
      entities.currency = 'MXN';
    }

    return entities;
  }

  // Obtener ejemplos de una intención específica
  getExamples(intent: FlowType): string[] {
    const intentDef = this.intents.find(i => i.name === intent);
    return intentDef?.examples || [];
  }

  // Obtener todas las intenciones disponibles
  getAvailableIntents(): FlowType[] {
    return this.intents.map(i => i.name);
  }

  // Validar si un texto es ambiguo entre intenciones
  isAmbiguous(text: string, threshold: number = 0.1): boolean {
    const scores = this.calculateIntentScores(this.normalizeText(text));
    const sortedScores = Object.values(scores).sort((a, b) => b - a);

    if (sortedScores.length < 2) return false;

    const topScore = sortedScores[0];
    const secondScore = sortedScores[1];

    return (topScore - secondScore) < threshold;
  }

  // Obtener sugerencias cuando la intención no es clara
  getSuggestions(text: string): string[] {
    const scores = this.calculateIntentScores(this.normalizeText(text));

    return Object.entries(scores)
      .filter(([_, score]) => score > 0.3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([intent, _]) => {
        const intentDef = this.intents.find(i => i.name === intent);
        return intentDef?.examples[0] || intent;
      });
  }

  // Análisis detallado para debugging
  analyzeText(text: string): {
    originalText: string;
    normalizedText: string;
    scores: Record<string, number>;
    bestMatch: IntentResult;
    isAmbiguous: boolean;
    suggestions: string[];
  } {
    const normalizedText = this.normalizeText(text);
    const scores = this.calculateIntentScores(normalizedText);
    const bestMatch = this.detectIntent(text);
    const isAmbiguous = this.isAmbiguous(text);
    const suggestions = this.getSuggestions(text);

    return {
      originalText: text,
      normalizedText,
      scores,
      bestMatch,
      isAmbiguous,
      suggestions
    };
  }
}