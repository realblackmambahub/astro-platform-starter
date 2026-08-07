import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseSecretKey) {
    return NextResponse.json(
      { error: 'Erro ao configurar banco de dados' },
      { status: 500 }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const { id } = await params
    const { name, email, fileId, active } = await request.json()

    if (!name || !email) {
      return NextResponse.json(
        { error: 'Nome e email são obrigatórios' },
        { status: 400 }
      )
    }

    if (!email.includes('@')) {
      return NextResponse.json(
        { error: 'Email inválido' },
        { status: 400 }
      )
    }

    // Atualizar recipient
    const { data: updatedRecipient, error: recipientError } = await supabase
      .from('recipients')
      .update({ name, email })
      .eq('id', id)
      .select()
      .single()

    if (recipientError || !updatedRecipient) {
      return NextResponse.json(
        { error: 'Destinatário não encontrado' },
        { status: 404 }
      )
    }

    // Buscar o download link do destinatário
    const { data: downloadLink } = await supabase
      .from('download_links')
      .select('id')
      .eq('recipient_id', id)
      .single()

    if (downloadLink) {
      // Preparar update do link
      const linkUpdate: any = {}
      if (fileId !== undefined) {
        linkUpdate.file_id = fileId
      }
      if (active !== undefined) {
        linkUpdate.active = active
      }

      if (Object.keys(linkUpdate).length > 0) {
        const { data: updatedLink, error: linkError } = await supabase
          .from('download_links')
          .update(linkUpdate)
          .eq('id', downloadLink.id)
          .select()
          .single()

        if (linkError) {
          console.error('[v0] Error updating download link:', linkError)
          return NextResponse.json(
            { error: 'Erro ao atualizar link' },
            { status: 500 }
          )
        }

        return NextResponse.json({
          recipient: updatedRecipient,
          link: updatedLink,
        })
      }
    }

    return NextResponse.json({
      recipient: updatedRecipient,
      link: downloadLink,
    })
  } catch (error) {
    console.error('[v0] PATCH recipient error:', error)
    return NextResponse.json(
      { error: 'Erro interno' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseSecretKey) {
    return NextResponse.json(
      { error: 'Erro ao configurar banco de dados' },
      { status: 500 }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const { id } = await params

    // Buscar download links do destinatário
    const { data: links } = await supabase
      .from('download_links')
      .select('id')
      .eq('recipient_id', id)

    // Excluir eventos de download vinculados aos links
    if (links && links.length > 0) {
      const linkIds = links.map((l: any) => l.id)
      const { error: eventsError } = await supabase
        .from('download_events')
        .delete()
        .in('link_id', linkIds)

      if (eventsError) {
        console.error('[v0] Error deleting events:', eventsError)
      }

      // Excluir download links
      const { error: linksError } = await supabase
        .from('download_links')
        .delete()
        .in('id', linkIds)

      if (linksError) {
        return NextResponse.json(
          { error: 'Erro ao excluir links' },
          { status: 500 }
        )
      }
    }

    // Excluir recipient
    const { error: recipientError } = await supabase
      .from('recipients')
      .delete()
      .eq('id', id)

    if (recipientError) {
      return NextResponse.json(
        { error: 'Erro ao excluir destinatário' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] DELETE recipient error:', error)
    return NextResponse.json(
      { error: 'Erro interno' },
      { status: 500 }
    )
  }
}
