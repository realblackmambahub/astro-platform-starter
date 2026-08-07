import { createClient } from '@/lib/supabase/server'
import { registerDownloadEvent } from '@/lib/register-download-event'
import { NextResponse, NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code } = body

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ success: false, error: 'Code is required' }, { status: 400 })
    }

    const supabase = createClient()

    // 1. Localizar o link pelo code
    const { data: downloadLink, error: linkError } = await supabase
      .from('download_links')
      .select('id, active, recipient_id')
      .eq('code', code)
      .single()

    if (linkError || !downloadLink) {
      return NextResponse.json(
        { success: false, error: 'Link not found' },
        { status: 404 }
      )
    }

    // 2. Validar se link está ativo
    if (!downloadLink.active) {
      return NextResponse.json(
        { success: false, error: 'Link is inactive' },
        { status: 403 }
      )
    }

    // 3. Buscar arquivo para validação
    const { data: link, error: fullLinkError } = await supabase
      .from('download_links')
      .select('file_id, recipient_id')
      .eq('id', downloadLink.id)
      .single()

    if (fullLinkError || !link) {
      return NextResponse.json(
        { success: false, error: 'Failed to load link details' },
        { status: 500 }
      )
    }

    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('id, active')
      .eq('id', link.file_id)
      .single()

    if (fileError || !file || !file.active) {
      return NextResponse.json(
        { success: false, error: 'File not found or inactive' },
        { status: 404 }
      )
    }

    // 4. Registrar acesso
    const result = await registerDownloadEvent({
      eventType: 'access',
      linkId: downloadLink.id,
      recipientId: link.recipient_id,
      fileId: file.id,
      request,
    })

    return NextResponse.json(result, {
      status: result.success ? 200 : 500,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (error) {
    console.error('[ACCESS EVENT ERROR]', error)
    return NextResponse.json(
      {
        success: false,
        created: false,
        duplicated: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
