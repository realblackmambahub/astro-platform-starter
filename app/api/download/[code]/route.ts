import { createClient } from '@/lib/supabase/server'
import { registerDownloadEvent } from '@/lib/register-download-event'
import { NextResponse, NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params
    const supabase = createClient()

    // 1. Validar o código
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
    }

    // 2. Buscar o link de download
    const { data: downloadLink, error: linkError } = await supabase
      .from('download_links')
      .select('*')
      .eq('code', code)
      .single()

    if (linkError || !downloadLink) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 })
    }

    // 3. Verificar se o link está ativo
    if (!downloadLink.active) {
      return NextResponse.json({ error: 'Link inactive' }, { status: 403 })
    }

    // 4. Buscar o arquivo
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('*')
      .eq('id', downloadLink.file_id)
      .single()

    if (fileError || !file || !file.active) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // 5. Buscar o arquivo no Supabase Storage
    const { data: fileBuffer, error: downloadError } = await supabase.storage
      .from('downloads')
      .download(file.storage_path)

    if (downloadError || !fileBuffer) {
      return NextResponse.json({ error: 'Download error' }, { status: 500 })
    }

    // 6. Registrar evento de download ANTES de entregar o arquivo
    const eventResult = await registerDownloadEvent({
      linkId: downloadLink.id,
      recipientId: downloadLink.recipient_id,
      fileId: downloadLink.file_id,
      eventType: 'download',
      request,
    })

    // Log evento (mas não falhar o download)
    if (!eventResult.success) {
      console.error('[DOWNLOAD EVENT FAILED]', eventResult.error)
    }

    // 7. Determinar Content-Type apropriado para o arquivo
    let contentType = file.mime_type || 'application/octet-stream'
    
    // Para .exe, usar o MIME type apropriado se o arquivo salvo for genérico
    const fileName = file.original_name.toLowerCase()
    if (fileName.endsWith('.exe')) {
      // Se o MIME type é genérico, usar o específico para executável
      if (contentType === 'application/octet-stream') {
        contentType = 'application/vnd.microsoft.portable-executable'
      }
    }

    // 8. Entregar arquivo
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.original_name)}`,
      'Cache-Control': 'private, no-store, max-age=0',
    }

    if (file.size) {
      headers['Content-Length'] = file.size.toString()
    }

    return new NextResponse(fileBuffer, {
      headers,
    })
  } catch (error) {
    console.error('[DOWNLOAD ERROR]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


