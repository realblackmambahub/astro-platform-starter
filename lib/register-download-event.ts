import { createClient } from '@/lib/supabase/server'
import { getClientIP, getDeviceInfo, getGeolocation } from '@/lib/utils/download'
import type { NextRequest } from 'next/server'

export interface EventResult {
  success: boolean
  created: boolean
  duplicated: boolean
  error?: string
  eventId?: string
}

async function incrementCounter(
  linkId: string,
  type: 'access' | 'download'
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()
    const rpcName = type === 'access' ? 'increment_access_count' : 'increment_download_count'
    const column = type === 'access' ? 'access_count' : 'download_count'

    // 1. Tentar RPC primeiro
    const { error: rpcError } = await supabase.rpc(rpcName, { link_id: linkId })

    if (!rpcError) {
      return { success: true }
    }

    // 2. Se RPC falhar, fazer fallback manual
    console.warn(`[COUNTER FALLBACK] RPC ${rpcName} unavailable, using manual update`, rpcError?.message)

    const { data: currentLink, error: readError } = await supabase
      .from('download_links')
      .select(`id, ${column}`)
      .eq('id', linkId)
      .single()

    if (readError || !currentLink) {
      return { success: false, error: `Failed to read counter: ${readError?.message}` }
    }

    const currentValue = Number(currentLink[column]) || 0

    const { error: updateError } = await supabase
      .from('download_links')
      .update({
        [column]: currentValue + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', linkId)

    if (updateError) {
      return { success: false, error: `Failed to update counter: ${updateError.message}` }
    }

    return { success: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`[COUNTER ERROR] ${msg}`)
    return { success: false, error: msg }
  }
}

export async function registerDownloadEvent({
  linkId,
  recipientId,
  fileId,
  eventType,
  request,
}: {
  linkId: string
  recipientId: string
  fileId: string
  eventType: 'access' | 'download'
  request: NextRequest
}): Promise<EventResult> {
  try {
    const supabase = createClient()
    const userAgent = request.headers.get('user-agent') || ''
    const clientIP = getClientIP(request)

    // 1. Verificar duplicidade apenas se IP não for nulo
    let isDuplicate = false
    if (clientIP) {
      const fiveSecondsAgo = new Date(Date.now() - 5000).toISOString()

      const { data: duplicate, error: duplicateError } = await supabase
        .from('download_events')
        .select('id, created_at')
        .eq('download_link_id', linkId)
        .eq('event_type', eventType)
        .eq('ip_address', clientIP)
        .gte('created_at', fiveSecondsAgo)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (duplicateError) {
        console.error('[EVENT CHECK ERROR]', { eventType, linkId, error: duplicateError.message })
      }

      if (duplicate) {
        isDuplicate = true
      }
    }

    if (isDuplicate) {
      return {
        success: true,
        created: false,
        duplicated: true,
      }
    }

    // 2. Coletar dados de rastreamento
    const deviceInfo = getDeviceInfo(userAgent)
    const geoInfo = await getGeolocation(clientIP)

    // 3. Preparar dados para inserção
    const insertData: Record<string, any> = {
      download_link_id: linkId,
      recipient_id: recipientId,
      file_id: fileId,
      event_type: eventType,
      ip_address: clientIP || null,
      device_type: deviceInfo.device_type || null,
      browser: deviceInfo.browser || null,
      browser_version: deviceInfo.browser_version || null,
      operating_system: deviceInfo.operating_system || null,
      user_agent: userAgent || null,
      city: geoInfo.city || null,
      region: geoInfo.region || null,
      country: geoInfo.country || null,
      timezone: geoInfo.timezone || null,
      provider: geoInfo.provider || null,
      organization: geoInfo.organization || null,
    }

    // 4. Inserir evento
    const { data: event, error: insertError } = await supabase
      .from('download_events')
      .insert(insertData)
      .select('id')
      .single()

    if (insertError || !event) {
      console.error('[EVENT INSERT ERROR]', {
        eventType,
        linkId,
        fileId,
        recipientId,
        ip: clientIP,
        error: insertError?.message,
      })
      return {
        success: false,
        created: false,
        duplicated: false,
        error: insertError?.message || 'Insert failed',
      }
    }

    // 5. Incrementar contador (com fallback)
    const counterResult = await incrementCounter(linkId, eventType)
    if (!counterResult.success) {
      console.error('[COUNTER FAILED]', { eventType, linkId, error: counterResult.error })
      // Não falhar - evento foi criado, contador é secundário
    }

    return {
      success: true,
      created: true,
      duplicated: false,
      eventId: event.id,
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[EVENT REGISTER ERROR]', msg)
    return {
      success: false,
      created: false,
      duplicated: false,
      error: msg,
    }
  }
}
