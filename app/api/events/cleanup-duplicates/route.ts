import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabase = createClient()

    // Buscar eventos agrupados para encontrar duplicados
    const { data: events, error: eventsError } = await supabase
      .from('download_events')
      .select('id, download_link_id, event_type, ip_address, created_at')
      .order('download_link_id, event_type, ip_address, created_at')

    if (eventsError) {
      throw eventsError
    }

    if (!events || events.length === 0) {
      return NextResponse.json({ success: true, removed: 0, message: 'Nenhum evento para limpar' })
    }

    // Identificar duplicados (mesmo link, tipo e IP dentro de 10 segundos)
    const toDelete: string[] = []
    let i = 0

    while (i < events.length) {
      const event = events[i]
      let j = i + 1

      // Agrupar eventos iguais
      while (
        j < events.length &&
        events[j].download_link_id === event.download_link_id &&
        events[j].event_type === event.event_type &&
        events[j].ip_address === event.ip_address
      ) {
        const timeDiff = new Date(events[j].created_at).getTime() - new Date(event.created_at).getTime()

        // Se intervalo for menor que 10 segundos, marcar para deleção
        if (timeDiff < 10000) {
          toDelete.push(events[j].id)
        }

        j++
      }

      i = j
    }

    // Deletar eventos duplicados
    if (toDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('download_events')
        .delete()
        .in('id', toDelete)

      if (deleteError) {
        throw deleteError
      }
    }

    return NextResponse.json({
      success: true,
      removed: toDelete.length,
      message: `${toDelete.length} evento(s) duplicado(s) removido(s)`,
    })
  } catch (error) {
    console.error('[v0] Cleanup duplicates error:', error)
    return NextResponse.json(
      { error: 'Erro ao limpar duplicados', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
