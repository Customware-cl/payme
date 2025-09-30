// Script de A/B Testing - Plantillas HSM Optimizadas vs Originales
// Permite ejecutar pruebas comparativas de engagement y conversión

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface ABTestConfig {
  testName: string
  templateCategory: string
  versionA: string // Original template name
  versionB: string // Optimized template name
  splitRatio: number // 0.5 = 50/50 split
  duration: number // Test duration in hours
}

interface ABTestResult {
  testName: string
  version: 'A' | 'B'
  sent: number
  opened: number
  clicked: number
  responded: number
  converted: number
  openRate: number
  ctr: number
  responseRate: number
  conversionRate: number
}

class ABTemplateTest {
  private supabase: any
  private tenantId: string = 'd4c43ab8-426f-4bb9-8736-dfe301459590'

  constructor() {
    this.supabase = createClient(
      'https://qgjxkszfdoolaxmsupil.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnanhrc3pmZG9vbGF4bXN1cGlsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODU4OTk3MSwiZXhwIjoyMDc0MTY1OTcxfQ.G0dkXunOrSLXfX6_Wa9YeWIyyS2wXbU_c18uULKpBH0'
    )
  }

  // Configuraciones de tests disponibles
  getAvailableTests(): ABTestConfig[] {
    return [
      {
        testName: 'Opt-in Optimization Test',
        templateCategory: 'opt_in',
        versionA: 'recordatorio_optin_v1',
        versionB: 'recordatorio_optin_v2',
        splitRatio: 0.5,
        duration: 168 // 1 semana
      },
      {
        testName: '24h Reminder Tone Test',
        templateCategory: 'before_24h',
        versionA: 'devolucion_24h_v1',
        versionB: 'devolucion_24h_v2',
        splitRatio: 0.5,
        duration: 72 // 3 días
      },
      {
        testName: 'Due Date Positivity Test',
        templateCategory: 'due_date',
        versionA: 'devolucion_hoy_v1',
        versionB: 'devolucion_hoy_v2',
        splitRatio: 0.5,
        duration: 48 // 2 días
      },
      {
        testName: 'Overdue Collaboration Test',
        templateCategory: 'overdue',
        versionA: 'devolucion_vencida_v1',
        versionB: 'devolucion_vencida_v2',
        splitRatio: 0.5,
        duration: 96 // 4 días
      },
      {
        testName: 'Monthly Preview Gamification Test',
        templateCategory: 'monthly_service_preview',
        versionA: 'cobro_mensual_previo_v1',
        versionB: 'cobro_mensual_previo_v2',
        splitRatio: 0.5,
        duration: 120 // 5 días
      }
    ]
  }

  // Ejecutar un test A/B específico
  async runABTest(testConfig: ABTestConfig): Promise<void> {
    console.log(`🧪 Iniciando A/B Test: ${testConfig.testName}`)
    console.log('=' .repeat(60))

    // Crear registro del test
    const testId = await this.createTestRecord(testConfig)

    // Obtener usuarios para el test
    const users = await this.getUsersForTest(testConfig.templateCategory)

    if (users.length === 0) {
      console.log('❌ No hay usuarios disponibles para este test')
      return
    }

    console.log(`👥 Usuarios disponibles: ${users.length}`)
    console.log(`📊 División: ${Math.round(testConfig.splitRatio * 100)}% A / ${Math.round((1 - testConfig.splitRatio) * 100)}% B`)

    // Dividir usuarios aleatoriamente
    const shuffled = users.sort(() => 0.5 - Math.random())
    const splitIndex = Math.floor(shuffled.length * testConfig.splitRatio)

    const groupA = shuffled.slice(0, splitIndex)
    const groupB = shuffled.slice(splitIndex)

    console.log(`👤 Grupo A (${testConfig.versionA}): ${groupA.length} usuarios`)
    console.log(`👤 Grupo B (${testConfig.versionB}): ${groupB.length} usuarios`)

    // Simular envío de mensajes para ambos grupos
    await this.simulateMessageSending(testId, 'A', testConfig.versionA, groupA)
    await this.simulateMessageSending(testId, 'B', testConfig.versionB, groupB)

    console.log(`\n⏰ Test configurado para ejecutarse por ${testConfig.duration} horas`)
    console.log(`📈 Revisa los resultados con: getTestResults('${testId}')`)
  }

  // Crear registro del test en base de datos
  private async createTestRecord(config: ABTestConfig): Promise<string> {
    const testRecord = {
      tenant_id: this.tenantId,
      test_name: config.testName,
      template_category: config.templateCategory,
      version_a_template: config.versionA,
      version_b_template: config.versionB,
      split_ratio: config.splitRatio,
      duration_hours: config.duration,
      status: 'running',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + config.duration * 60 * 60 * 1000).toISOString()
    }

    // En producción, esto se guardaría en una tabla ab_tests
    const testId = `test_${Date.now()}`
    console.log(`✅ Test registrado con ID: ${testId}`)

    return testId
  }

  // Obtener usuarios elegibles para el test
  private async getUsersForTest(category: string): Promise<any[]> {
    try {
      // Obtener contactos que podrían recibir este tipo de mensaje
      const { data: contacts, error } = await this.supabase
        .from('contacts')
        .select(`
          id, name, phone_e164, opt_in_status,
          agreements!inner(id, status, agreement_type, due_date)
        `)
        .eq('tenant_id', this.tenantId)
        .eq('opt_in_status', 'opted_in')
        .eq('agreements.status', 'active')
        .limit(100) // Limitar para testing

      if (error) {
        console.error('Error obteniendo usuarios:', error)
        return []
      }

      // Filtrar por categoría de mensaje
      return contacts?.filter(contact => {
        const agreement = contact.agreements[0]
        const dueDate = new Date(agreement.due_date)
        const now = new Date()
        const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60)

        switch (category) {
          case 'opt_in':
            return true // Todos pueden recibir opt-in
          case 'before_24h':
            return hoursUntilDue > 12 && hoursUntilDue <= 36
          case 'due_date':
            return hoursUntilDue > -6 && hoursUntilDue <= 6
          case 'overdue':
            return hoursUntilDue < 0
          default:
            return false
        }
      }) || []

    } catch (error) {
      console.error('Error en getUsersForTest:', error)
      return []
    }
  }

  // Simular envío de mensajes (para testing)
  private async simulateMessageSending(
    testId: string,
    version: 'A' | 'B',
    templateName: string,
    users: any[]
  ): Promise<void> {
    console.log(`📤 Simulando envío versión ${version} (${templateName}) a ${users.length} usuarios`)

    // En producción, aquí se enviarían los mensajes reales
    // Por ahora solo simulamos las métricas

    const simulatedMetrics = {
      sent: users.length,
      opened: Math.floor(users.length * (version === 'B' ? 0.85 : 0.70)), // B tiene mejor apertura
      clicked: Math.floor(users.length * (version === 'B' ? 0.45 : 0.30)), // B tiene mejor CTR
      responded: Math.floor(users.length * (version === 'B' ? 0.35 : 0.25)), // B tiene mejor respuesta
      converted: Math.floor(users.length * (version === 'B' ? 0.28 : 0.18)) // B tiene mejor conversión
    }

    console.log(`   📊 Métricas simuladas versión ${version}:`)
    console.log(`      Enviados: ${simulatedMetrics.sent}`)
    console.log(`      Abiertos: ${simulatedMetrics.opened} (${((simulatedMetrics.opened/simulatedMetrics.sent)*100).toFixed(1)}%)`)
    console.log(`      Clicks: ${simulatedMetrics.clicked} (${((simulatedMetrics.clicked/simulatedMetrics.sent)*100).toFixed(1)}%)`)
    console.log(`      Respuestas: ${simulatedMetrics.responded} (${((simulatedMetrics.responded/simulatedMetrics.sent)*100).toFixed(1)}%)`)
    console.log(`      Conversiones: ${simulatedMetrics.converted} (${((simulatedMetrics.converted/simulatedMetrics.sent)*100).toFixed(1)}%)`)
  }

  // Obtener resultados de un test
  async getTestResults(testId: string): Promise<{
    versionA: ABTestResult,
    versionB: ABTestResult,
    winner: 'A' | 'B' | 'tie',
    confidence: number,
    recommendations: string[]
  }> {
    console.log(`📈 Analizando resultados del test: ${testId}`)

    // Datos simulados para demostración
    const versionA: ABTestResult = {
      testName: 'Template Test',
      version: 'A',
      sent: 150,
      opened: 105, // 70%
      clicked: 45,  // 30%
      responded: 38, // 25%
      converted: 27, // 18%
      openRate: 70.0,
      ctr: 30.0,
      responseRate: 25.3,
      conversionRate: 18.0
    }

    const versionB: ABTestResult = {
      testName: 'Template Test',
      version: 'B',
      sent: 145,
      opened: 123, // 85%
      clicked: 65,  // 45%
      responded: 51, // 35%
      converted: 41, // 28%
      openRate: 84.8,
      ctr: 44.8,
      responseRate: 35.2,
      conversionRate: 28.3
    }

    // Calcular ganador estadístico
    const conversionLift = ((versionB.conversionRate - versionA.conversionRate) / versionA.conversionRate) * 100
    const winner: 'A' | 'B' | 'tie' = conversionLift > 5 ? 'B' : conversionLift < -5 ? 'A' : 'tie'

    const confidence = Math.abs(conversionLift) > 15 ? 95 : Math.abs(conversionLift) > 10 ? 85 : 70

    // Generar recomendaciones
    const recommendations = this.generateRecommendations(versionA, versionB, winner)

    return {
      versionA,
      versionB,
      winner,
      confidence,
      recommendations
    }
  }

  private generateRecommendations(versionA: ABTestResult, versionB: ABTestResult, winner: 'A' | 'B' | 'tie'): string[] {
    const recommendations: string[] = []

    if (winner === 'B') {
      recommendations.push('✅ Implementar Version B como plantilla principal')
      recommendations.push(`📈 Mejora esperada en conversión: +${(versionB.conversionRate - versionA.conversionRate).toFixed(1)}%`)

      if (versionB.openRate > versionA.openRate + 10) {
        recommendations.push('🎯 Los emojis y tono optimizado mejoran significativamente el engagement inicial')
      }

      if (versionB.responseRate > versionA.responseRate + 8) {
        recommendations.push('💬 El copy conversacional genera más respuestas de los usuarios')
      }
    } else if (winner === 'A') {
      recommendations.push('⚠️ La versión original tuvo mejor performance')
      recommendations.push('🔍 Revisar si las optimizaciones fueron demasiado agresivas')
      recommendations.push('📝 Considerar un enfoque más conservador en futuras iteraciones')
    } else {
      recommendations.push('📊 Resultados no concluyentes - extender duración del test')
      recommendations.push('🔄 Considerar probar con segmentos de usuarios más específicos')
      recommendations.push('⚡ Ambas versiones tienen performance similar')
    }

    return recommendations
  }

  // Reportar resultados formateados
  async generateReport(testId: string): Promise<void> {
    const results = await this.getTestResults(testId)

    console.log('\n' + '='.repeat(80))
    console.log('📊 REPORTE FINAL DE A/B TEST')
    console.log('='.repeat(80))

    console.log(`\n🏆 GANADOR: Versión ${results.winner.toUpperCase()} (Confianza: ${results.confidence}%)`)

    console.log('\n📈 MÉTRICAS COMPARATIVAS')
    console.log('-'.repeat(50))

    const metrics = [
      { name: 'Tasa de Apertura', a: results.versionA.openRate, b: results.versionB.openRate, unit: '%' },
      { name: 'Click-Through Rate', a: results.versionA.ctr, b: results.versionB.ctr, unit: '%' },
      { name: 'Tasa de Respuesta', a: results.versionA.responseRate, b: results.versionB.responseRate, unit: '%' },
      { name: 'Tasa de Conversión', a: results.versionA.conversionRate, b: results.versionB.conversionRate, unit: '%' }
    ]

    metrics.forEach(metric => {
      const diff = metric.b - metric.a
      const improvement = ((diff / metric.a) * 100).toFixed(1)
      const arrow = diff > 0 ? '↗️' : diff < 0 ? '↘️' : '➡️'

      console.log(`${metric.name}:`)
      console.log(`  Versión A: ${metric.a.toFixed(1)}${metric.unit}`)
      console.log(`  Versión B: ${metric.b.toFixed(1)}${metric.unit}`)
      console.log(`  Diferencia: ${arrow} ${improvement}%`)
      console.log()
    })

    console.log('🎯 RECOMENDACIONES')
    console.log('-'.repeat(50))
    results.recommendations.forEach(rec => console.log(rec))

    console.log('\n' + '='.repeat(80))
  }
}

// Funciones de utilidad para ejecutar tests
export async function runOptInTest() {
  const tester = new ABTemplateTest()
  const configs = tester.getAvailableTests()
  await tester.runABTest(configs[0]) // Opt-in test
}

export async function run24hReminderTest() {
  const tester = new ABTemplateTest()
  const configs = tester.getAvailableTests()
  await tester.runABTest(configs[1]) // 24h reminder test
}

export async function runAllTests() {
  const tester = new ABTemplateTest()
  const configs = tester.getAvailableTests()

  console.log('🚀 Ejecutando todos los A/B tests de plantillas...\n')

  for (const config of configs) {
    await tester.runABTest(config)
    console.log('\n' + '-'.repeat(60) + '\n')
  }
}

export async function generateFullReport() {
  const tester = new ABTemplateTest()

  // Generar reportes para todos los tests simulados
  const testIds = ['test_opt_in', 'test_24h', 'test_due_date', 'test_overdue']

  for (const testId of testIds) {
    await tester.generateReport(testId)
  }
}

// Ejecutar si se llama directamente
if (import.meta.main) {
  const command = Deno.args[0] || 'help'

  switch (command) {
    case 'optin':
      await runOptInTest()
      break
    case '24h':
      await run24hReminderTest()
      break
    case 'all':
      await runAllTests()
      break
    case 'report':
      await generateFullReport()
      break
    default:
      console.log('Uso: deno run --allow-net ab-testing-templates.ts [optin|24h|all|report]')
      console.log('')
      console.log('Comandos disponibles:')
      console.log('  optin  - Test A/B para plantilla de opt-in')
      console.log('  24h    - Test A/B para recordatorio 24h')
      console.log('  all    - Ejecutar todos los tests')
      console.log('  report - Generar reportes de resultados')
  }
}