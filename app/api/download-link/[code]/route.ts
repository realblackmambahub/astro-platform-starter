import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params
    const supabase = createClient()

    // Buscar o link
    const { data: downloadLink, error: linkError } = await supabase
      .from('download_links')
      .select('*')
      .eq('code', code)
      .eq('active', true)
      .single()

    if (linkError || !downloadLink) {
      return NextResponse.json({ error: 'Link não encontrado' }, { status: 404 })
    }

    // Buscar o arquivo
    const { data: file } = await supabase
      .from('files')
      .select('*')
      .eq('id', downloadLink.file_id)
      .eq('active', true)
      .single()

    // Buscar o destinatário
    const { data: recipient } = await supabase
      .from('recipients')
      .select('id, name, email')
      .eq('id', downloadLink.recipient_id)
      .single()

    return NextResponse.json({
      file,
      recipient,
      link: downloadLink,
    })
  } catch (error) {
    console.error('[v0] Download link lookup error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
