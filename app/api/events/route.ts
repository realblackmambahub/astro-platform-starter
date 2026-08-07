import { createClient } from '@/lib/supabase/server'
import { NextResponse, NextRequest } from 'next/server'
import { registerDownloadEvent } from '@/lib/register-download-event'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { code, eventType } = await request.json()

    if (!code || !eventType) {
      return NextResponse.json({ error: 'Código e tipo de evento são obrigatórios' }, { status: 400 })
    }

    if (!['access', 'download'].includes(eventType)) {
      return NextResponse.json({ error: 'Tipo de evento inválido' }, { status: 400 })
    }

    const supabase = createClient()

    // Buscar o link
    const { data: downloadLink, error: linkError } = await supabase
      .from('download_links')
      .select('*')
      .eq('code', code)
      .single()

    if (linkError || !downloadLink) {
      return NextResponse.json({ error: 'Link não encontrado' }, { status: 404 })
    }

    if (!downloadLink.active) {
      return NextResponse.json({ error: 'Link inativo' }, { status: 403 })
    }

    // Usar função compartilhada
    const result = await registerDownloadEvent({
      linkId: downloadLink.id,
      recipientId: downloadLink.recipient_id,
      fileId: downloadLink.file_id,
      eventType,
      request,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[v0] Events POST error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = createClient()

    // Buscar apenas eventos de download com join
    const { data: events, error } = await supabase
      .from('download_events')
      .select(
        `id,
        created_at,
        event_type,
        ip_address,
        city,
        region,
        country,
        provider,
        device_type,
        browser,
        download_link_id,
        file_id,
        recipient_id,
        download_link:download_links(
          id,
          recipient:recipients(name, email),
          file:files(original_name)
        )`
      )
      .eq('event_type', 'download')
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      console.error('[EVENTS QUERY ERROR]', error)
      throw error
    }

    // Mapear para formato esperado
    const mapped = (events || []).map((event: any) => ({
      id: event.id,
      created_at: event.created_at,
      ip_address: event.ip_address,
      city: event.city,
      region: event.region,
      country: event.country,
      provider: event.provider,
      device_type: event.device_type,
      browser: event.browser,
      recipientName: event.download_link?.recipient?.name || '-',
      recipientEmail: event.download_link?.recipient?.email || '-',
      fileName:
        event.download_link?.file?.original_name || 'Unknown file',
    }))

    return NextResponse.json(mapped, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (error) {
    console.error('[EVENTS GET ERROR]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Query error' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    const supabase = createClient()

    // Apagar todos os eventos
    const { error: deleteError } = await supabase
      .from('download_events')
      .delete()
      .not('id', 'is', null)

    if (deleteError) {
      throw deleteError
    }

    // Zerar contadores
    const { error: updateError } = await supabase
      .from('download_links')
      .update({
        access_count: 0,
        download_count: 0,
        updated_at: new Date().toISOString(),
      })
      .not('id', 'is', null)

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] Events DELETE error:', error)
    return NextResponse.json({ error: 'Erro ao deletar eventos' }, { status: 500 })
  }
}
