// Edge Function: API de Notificaciones para Dueños
// Permite a los dueños consultar y gestionar sus notificaciones

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

serve(async (req: Request) => {
  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    const url = new URL(req.url)
    const path = url.pathname.split('/').pop()

    // Inicializar Supabase
    const authHeader = req.headers.get('Authorization')!
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Obtener tenant del usuario
    const { data: userRecord } = await supabase
      .from('users')
      .select('tenant_id, role')
      .eq('auth_user_id', user.id)
      .single()

    if (!userRecord || !['owner', 'admin'].includes(userRecord.role)) {
      return new Response(
        JSON.stringify({ error: 'Acceso denegado' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const tenantId = userRecord.tenant_id

    // Routing
    switch (req.method) {
      case 'GET':
        if (path === 'stats') {
          return await getNotificationStats(supabase, tenantId)
        } else {
          return await getNotifications(supabase, tenantId, url.searchParams)
        }

      case 'PUT':
        return await updateNotification(supabase, tenantId, url.searchParams.get('id'), req)

      case 'DELETE':
        return await deleteNotification(supabase, tenantId, url.searchParams.get('id'))

      case 'POST':
        if (path === 'mark-all-read') {
          return await markAllAsRead(supabase, tenantId)
        }
        break

      default:
        return new Response(
          JSON.stringify({ error: 'Método no permitido' }),
          { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

  } catch (error) {
    console.error('Error en owner_notifications:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Obtener notificaciones del dueño
async function getNotifications(supabase: any, tenantId: string, searchParams: URLSearchParams) {
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const unreadOnly = searchParams.get('unread_only') === 'true'
  const type = searchParams.get('type')
  const priority = searchParams.get('priority')

  const offset = (page - 1) * limit

  let query = supabase
    .from('owner_notifications')
    .select(`
      *,
      agreements(id, title, status),
      contacts(id, name, phone_e164)
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (unreadOnly) {
    query = query.is('read_at', null)
  }

  if (type) {
    query = query.eq('notification_type', type)
  }

  if (priority) {
    query = query.eq('priority', priority)
  }

  const { data: notifications, error, count } = await query

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: notifications,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// Obtener estadísticas de notificaciones
async function getNotificationStats(supabase: any, tenantId: string) {
  const { data: stats, error } = await supabase
    .rpc('get_owner_notification_stats', { p_tenant_id: tenantId })

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Obtener distribución por tipo
  const { data: typeDistribution } = await supabase
    .from('owner_notifications')
    .select('notification_type, priority')
    .eq('tenant_id', tenantId)
    .is('read_at', null)

  const typeStats = typeDistribution?.reduce((acc: any, notification: any) => {
    const type = notification.notification_type
    const priority = notification.priority

    if (!acc[type]) {
      acc[type] = { total: 0, high: 0, normal: 0, low: 0 }
    }

    acc[type].total++
    acc[type][priority]++

    return acc
  }, {}) || {}

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        ...stats[0],
        type_distribution: typeStats
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// Actualizar notificación (marcar como leída)
async function updateNotification(supabase: any, tenantId: string, notificationId: string | null, req: Request) {
  if (!notificationId) {
    return new Response(
      JSON.stringify({ error: 'ID de notificación requerido' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const body = await req.json()
  const { read } = body

  const updateData: any = { updated_at: new Date().toISOString() }

  if (read !== undefined) {
    updateData.read_at = read ? new Date().toISOString() : null
  }

  const { data, error } = await supabase
    .from('owner_notifications')
    .update(updateData)
    .eq('id', notificationId)
    .eq('tenant_id', tenantId)
    .select()

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ success: true, data }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// Eliminar notificación
async function deleteNotification(supabase: any, tenantId: string, notificationId: string | null) {
  if (!notificationId) {
    return new Response(
      JSON.stringify({ error: 'ID de notificación requerido' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const { error } = await supabase
    .from('owner_notifications')
    .delete()
    .eq('id', notificationId)
    .eq('tenant_id', tenantId)

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// Marcar todas como leídas
async function markAllAsRead(supabase: any, tenantId: string) {
  const { data, error } = await supabase
    .from('owner_notifications')
    .update({
      read_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('tenant_id', tenantId)
    .is('read_at', null)
    .select('id')

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({
      success: true,
      marked_count: data?.length || 0
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}