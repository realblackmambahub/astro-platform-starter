import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const TIME_ZONE = 'America/Sao_Paulo'

export async function GET() {
  try {
    const supabase = createClient()
    // Buscar todos os dados necessários
    const { data: links } = await supabase.from('download_links').select('*')
    const { data: events } = await supabase.from('download_events').select('*')
    const { data: recipients } = await supabase.from('recipients').select('*')
    const { data: files } = await supabase.from('files').select('*')

    // Calcular estatísticas globais
    const totalDownloads = links?.reduce((sum, l) => sum + l.download_count, 0) || 0
    const totalAccesses = links?.reduce((sum, l) => sum + l.access_count, 0) || 0
    const uniqueIPs = new Set(events?.map((e) => e.ip_address) || []).size

    // Downloads Hoje (usando timezone São Paulo)
    const now = new Date()
    const saoPauloNow = toZonedTime(now, TIME_ZONE)
    
    const startLocal = new Date(saoPauloNow)
    startLocal.setHours(0, 0, 0, 0)
    
    const endLocal = new Date(saoPauloNow)
    endLocal.setHours(23, 59, 59, 999)
    
    const startUtc = fromZonedTime(startLocal, TIME_ZONE)
    const endUtc = fromZonedTime(endLocal, TIME_ZONE)
    
    const todayDownloads =
      events?.filter((e) => {
        const eventTime = new Date(e.created_at)
        return (
          e.event_type === 'download' &&
          eventTime >= startUtc &&
          eventTime <= endUtc
        )
      }).length || 0

    // Por tipo de dispositivo
    const deviceStats: Record<string, number> = {}
    events?.forEach((e) => {
      if (e.device_type) {
        deviceStats[e.device_type] = (deviceStats[e.device_type] || 0) + 1
      }
    })

    // iOS vs Desktop vs Mobile
    const iosCount = deviceStats['mobile'] || 0
    const desktopCount = deviceStats['desktop'] || 0
    const mobileCount = deviceStats['mobile'] || 0
    const totalEvents = events?.length || 0
    const iosPercent = totalEvents > 0 ? ((iosCount / totalEvents) * 100).toFixed(1) : '0'
    const desktopPercent = totalEvents > 0 ? ((desktopCount / totalEvents) * 100).toFixed(1) : '0'
    const mobilePercent = totalEvents > 0 ? ((mobileCount / totalEvents) * 100).toFixed(1) : '0'

    // Últimos 7 dias
    const last7Days: Record<string, number> = {}
    for (let i = 0; i < 7; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toLocaleDateString('pt-BR')
      last7Days[key] = 0
    }

    events?.forEach((e) => {
      const eventDate = new Date(e.created_at)
      const key = eventDate.toLocaleDateString('pt-BR')
      if (key in last7Days && e.event_type === 'download_delivered') {
        last7Days[key]++
      }
    })

    // Top países
    const countriesCount: Record<string, number> = {}
    events?.forEach((e) => {
      if (e.country) {
        countriesCount[e.country] = (countriesCount[e.country] || 0) + 1
      }
    })
    const topCountries = Object.entries(countriesCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([country, count]) => ({ country, count }))

    // Navegadores
    const browsersCount: Record<string, number> = {}
    events?.forEach((e) => {
      if (e.browser) {
        browsersCount[e.browser] = (browsersCount[e.browser] || 0) + 1
      }
    })
    const topBrowsers = Object.entries(browsersCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([browser, count]) => ({ browser, count }))

    // Por destinatário
    const recipientStats = recipients?.map((r) => {
      const recipientLinks = links?.filter((l) => l.recipient_id === r.id) || []
      const recipientAccesses = recipientLinks.reduce((sum, l) => sum + l.access_count, 0)
      const recipientDownloads = recipientLinks.reduce((sum, l) => sum + l.download_count, 0)
      const recipientEvents = events?.filter((e) => e.recipient_id === r.id) || []

      return {
        id: r.id,
        name: r.name,
        email: r.email,
        active: r.active,
        accesses: recipientAccesses,
        downloads: recipientDownloads,
        events: recipientEvents.length,
        lastEvent: recipientEvents.length > 0 ? recipientEvents[0].created_at : null,
      }
    })

    // Log detalhado (apenas downloads, últimos 100 eventos)
    const detailedLog = (events || [])
      .filter((e) => e.event_type === 'download')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 100)
      .map((e) => {
        const recipient = recipients?.find((r) => r.id === e.recipient_id)
        const file = files?.find((f) => f.id === e.file_id)
        return {
          id: e.id,
          created_at: e.created_at,
          recipientName: recipient?.name || '-',
          recipientEmail: recipient?.email || '-',
          fileName: file?.original_name || '-',
          ip_address: e.ip_address,
          city: e.city,
          region: e.region,
          country: e.country,
          provider: e.provider,
          device_type: e.device_type || 'Unknown',
          browser: e.browser || 'Unknown',
        }
      })

    return NextResponse.json(
      {
        totalDownloads,
        totalAccesses,
        uniqueIPs,
        todayDownloads,
        iosPercent,
        desktopPercent,
        mobilePercent,
        deviceStats,
        last7Days,
        topCountries,
        topBrowsers,
        recipientStats: recipientStats || [],
        detailedLog,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    )
  } catch {
    return NextResponse.json({ error: 'Erro ao buscar estatísticas' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const supabase = createClient()

    // 1. Apagar todos os eventos - usar not() para não ter na cláusula WHERE
    const { error: deleteError } = await supabase
      .from('download_events')
      .delete()
      .not('id', 'is', null) // Deleta todos onde id NOT null

    if (deleteError) {
      throw new Error(`Erro ao deletar eventos: ${deleteError.message}`)
    }

    // 2. Zerar counters em download_links
    const { error: linksError } = await supabase
      .from('download_links')
      .update({ access_count: 0, download_count: 0 })
      .not('id', 'is', null)

    if (linksError) {
      throw new Error(`Erro ao zerar links: ${linksError.message}`)
    }

    // 3. Zerar contadores em recipients se existirem
    const { data: recipients, error: getRecipientsError } = await supabase
      .from('recipients')
      .select()
      .limit(1)

    if (!getRecipientsError && recipients && recipients.length > 0) {
      const sample = recipients[0]
      if ('access_count' in sample || 'download_count' in sample) {
        const { error: recipientsError } = await supabase
          .from('recipients')
          .update({ access_count: 0, download_count: 0 })
          .not('id', 'is', null)

        if (recipientsError) {
          console.warn('[v0] Erro ao zerar recipients:', recipientsError)
        }
      }
    }

    return NextResponse.json({ success: true, message: 'Todos os dados foram zerados com sucesso' })
  } catch (error) {
    console.error('[v0] Error resetting stats:', error)
    return NextResponse.json(
      { error: 'Erro ao zerar dados', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
