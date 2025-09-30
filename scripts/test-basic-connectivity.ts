// Prueba básica de conectividad y estructura de base de datos

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

async function testBasicConnectivity() {
  console.log('🔍 Diagnosticando conectividad y estructura de BD...')

  const supabase = createClient(
    'https://qgjxkszfdoolaxmsupil.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnanhrc3pmZG9vbGF4bXN1cGlsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODU4OTk3MSwiZXhwIjoyMDc0MTY1OTcxfQ.G0dkXunOrSLXfX6_Wa9YeWIyyS2wXbU_c18uULKpBH0'
  )

  try {
    // 1. Verificar conexión básica
    console.log('\n1. Verificando conexión básica...')
    const { data: healthCheck, error: healthError } = await supabase
      .from('tenants')
      .select('count')
      .limit(1)

    if (healthError) {
      console.log('❌ Error de conexión:', healthError.message)
      return
    }
    console.log('✅ Conexión establecida')

    // 2. Verificar tenant existente
    console.log('\n2. Verificando tenant PrestaBot Chile...')
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('name', 'PrestaBot Chile')
      .single()

    if (tenantError) {
      console.log('❌ Error obteniendo tenant:', tenantError.message)
      console.log('   Creando tenant de prueba...')

      const { data: newTenant, error: createError } = await supabase
        .from('tenants')
        .insert({
          name: 'PrestaBot Chile',
          timezone: 'America/Santiago',
          whatsapp_phone_number_id: '778143428720890',
          whatsapp_business_account_id: '773972555504544',
          whatsapp_access_token: 'EAFU9IECsZBf0BPhU9vqt3jD9tZCeTu45HkCbjyXI02pKilI2XPMbqSY0y7tKBMsJSjOcqXd3rLndeteJJMDYP8kh1FkGK2tdpEdbx53m30MQPINvOsfsgMFu3Icf2ekRZCx2UVwEpJOC9G1GKOSeWzRN7qsAr19dPrjZC3f0ZBebseEowZCAWMEPh1Ys0alYjS7aSWlnp2mFtXwZAn0gtSVjbR0pEieItZBQihKlLJCX',
          webhook_verify_token: 'token_prestabot_2025',
          settings: {
            auto_create_contacts: true,
            default_reminder_config: {
              enabled: true,
              before_24h: true,
              due_date: true,
              overdue: true
            },
            conversation_timeout_minutes: 30,
            currency: 'CLP',
            language: 'es_CL'
          }
        })
        .select()
        .single()

      if (createError) {
        console.log('❌ Error creando tenant:', createError.message)
        return
      }
      console.log('✅ Tenant creado:', newTenant.name)
    } else {
      console.log('✅ Tenant encontrado:', tenant.name, tenant.id)
    }

    const tenantId = tenant?.id || newTenant?.id

    // 3. Verificar estructura de tablas
    console.log('\n3. Verificando estructura de tablas...')

    const tables = ['contacts', 'agreements', 'templates', 'owner_notifications']

    for (const table of tables) {
      try {
        const { error } = await supabase
          .from(table)
          .select('*')
          .limit(1)

        if (error) {
          console.log(`❌ Tabla ${table}:`, error.message)
        } else {
          console.log(`✅ Tabla ${table}: OK`)
        }
      } catch (err) {
        console.log(`❌ Tabla ${table}: Error de acceso`)
      }
    }

    // 4. Probar creación de contacto simple
    console.log('\n4. Probando creación de contacto...')
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .insert({
        tenant_id: tenantId,
        phone_e164: '+56999999999',
        name: 'Test Contact',
        opt_in_status: 'pending',
        preferred_language: 'es',
        timezone: 'America/Santiago'
      })
      .select()
      .single()

    if (contactError) {
      console.log('❌ Error creando contacto:', contactError.message)
      console.log('   Detalles:', contactError)
    } else {
      console.log('✅ Contacto creado:', contact.name, contact.id)

      // Limpiar contacto de prueba
      await supabase.from('contacts').delete().eq('id', contact.id)
      console.log('✅ Contacto de prueba eliminado')
    }

    // 5. Verificar plantillas HSM
    console.log('\n5. Verificando plantillas HSM...')
    const { data: templates, error: templatesError } = await supabase
      .from('templates')
      .select('name, category, meta_template_name')
      .is('tenant_id', null)

    if (templatesError) {
      console.log('❌ Error obteniendo plantillas:', templatesError.message)
    } else {
      console.log(`✅ Plantillas encontradas: ${templates.length}`)
      templates.forEach(t => {
        console.log(`   - ${t.name} (${t.category}) -> ${t.meta_template_name}`)
      })
    }

    // 6. Probar función RPC
    console.log('\n6. Probando función RPC...')
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('update_agreement_status_by_time')

    if (rpcError) {
      console.log('❌ Error en RPC:', rpcError.message)
    } else {
      console.log('✅ RPC ejecutada correctamente, acuerdos actualizados:', rpcResult || 0)
    }

    console.log('\n🎉 Diagnóstico completado')

  } catch (error) {
    console.log('💥 Error general:', error.message)
  }
}

if (import.meta.main) {
  await testBasicConnectivity()
}