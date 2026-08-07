import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const results: Record<string, any> = {
    supabaseConnected: false,
    tables: {
      download_events: false,
      download_links: false,
      files: false,
      recipients: false,
    },
    columns: {
      eventTypeColumn: null,
      hasDownloadLinkId: false,
      hasFileId: false,
      hasRecipientId: false,
      hasIpAddress: false,
    },
    counts: {
      events: 0,
      accessEvents: 0,
      downloadEvents: 0,
      links: 0,
    },
    rpc: {
      incrementAccessAvailable: false,
      incrementDownloadAvailable: false,
    },
    lastEvent: null,
    errors: [],
  }

  try {
    const supabase = createClient()
    results.supabaseConnected = true

    // Test table access
    const { error: eventsError, count: eventsCount } = await supabase
      .from('download_events')
      .select('*', { count: 'exact' })
      .limit(0)

    if (!eventsError) {
      results.tables.download_events = true
      results.counts.events = eventsCount || 0
    } else {
      results.errors.push(`download_events: ${eventsError.message}`)
    }

    const { error: linksError, count: linksCount } = await supabase
      .from('download_links')
      .select('*', { count: 'exact' })
      .limit(0)

    if (!linksError) {
      results.tables.download_links = true
      results.counts.links = linksCount || 0
    } else {
      results.errors.push(`download_links: ${linksError.message}`)
    }

    const { error: filesError } = await supabase
      .from('files')
      .select('id')
      .limit(0)

    if (!filesError) {
      results.tables.files = true
    } else {
      results.errors.push(`files: ${filesError.message}`)
    }

    const { error: recipientsError } = await supabase
      .from('recipients')
      .select('id')
      .limit(0)

    if (!recipientsError) {
      results.tables.recipients = true
    } else {
      results.errors.push(`recipients: ${recipientsError.message}`)
    }

    // Check download_events columns
    if (results.tables.download_events) {
      const { data: sampleEvent, error: sampleError } = await supabase
        .from('download_events')
        .select('*')
        .limit(1)
        .single()

      if (!sampleError && sampleEvent) {
        // Detect event_type column
        if ('event_type' in sampleEvent) {
          results.columns.eventTypeColumn = 'event_type'
        } else if ('type' in sampleEvent) {
          results.columns.eventTypeColumn = 'type'
        }

        // Check other columns
        results.columns.hasDownloadLinkId = 'download_link_id' in sampleEvent
        results.columns.hasFileId = 'file_id' in sampleEvent
        results.columns.hasRecipientId = 'recipient_id' in sampleEvent
        results.columns.hasIpAddress = 'ip_address' in sampleEvent
      }

      // Get event counts by type
      const { data: events } = await supabase
        .from('download_events')
        .select('event_type', { count: 'exact' })

      if (events) {
        results.counts.accessEvents = events.filter((e) => e.event_type === 'access').length
        results.counts.downloadEvents = events.filter((e) => e.event_type === 'download').length
      }

      // Get last event
      const { data: lastEvents } = await supabase
        .from('download_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)

      if (lastEvents && lastEvents.length > 0) {
        results.lastEvent = {
          id: lastEvents[0].id,
          type: lastEvents[0].event_type,
          created_at: lastEvents[0].created_at,
          ip: lastEvents[0].ip_address,
        }
      }
    }

    // Test RPC functions
    const { error: accessRpcError } = await supabase.rpc('increment_access_count', {
      link_id: '00000000-0000-0000-0000-000000000000',
    })

    // Error expected (invalid ID), so if it's a function error, RPC exists
    if (!accessRpcError || accessRpcError.message?.includes('violates')) {
      results.rpc.incrementAccessAvailable = true
    }

    const { error: downloadRpcError } = await supabase.rpc('increment_download_count', {
      link_id: '00000000-0000-0000-0000-000000000000',
    })

    if (!downloadRpcError || downloadRpcError.message?.includes('violates')) {
      results.rpc.incrementDownloadAvailable = true
    }
  } catch (error) {
    results.errors.push(error instanceof Error ? error.message : String(error))
  }

  return NextResponse.json(results, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
