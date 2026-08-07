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
    const { active } = await request.json()

    if (typeof active !== 'boolean') {
      return NextResponse.json(
        { error: 'active deve ser booleano' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('files')
      .update({ active })
      .eq('id', id)
      .select()
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: 'Arquivo não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[v0] PATCH file error:', error)
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

    // Contar links vinculados a este arquivo
    const { data: linkedLinks, error: countError } = await supabase
      .from('download_links')
      .select('id', { count: 'exact' })
      .eq('file_id', id)

    if (countError) {
      return NextResponse.json(
        { error: 'Erro ao verificar links' },
        { status: 500 }
      )
    }

    const linkedCount = linkedLinks?.length || 0

    if (linkedCount > 0) {
      return NextResponse.json(
        {
          error: 'Arquivo possui links vinculados',
          linkedCount,
        },
        { status: 409 }
      )
    }

    // Buscar arquivo para obter storage_path
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('storage_path')
      .eq('id', id)
      .single()

    if (fileError || !file) {
      return NextResponse.json(
        { error: 'Arquivo não encontrado' },
        { status: 404 }
      )
    }

    // Deletar arquivo do storage
    if (file.storage_path) {
      const storageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const { error: storageError } = await supabase.storage
        .from('downloads')
        .remove([file.storage_path])

      if (storageError) {
        console.error('[v0] Error deleting file from storage:', storageError)
        // Continuar mesmo com erro no storage
      }
    }

    // Deletar registro do arquivo
    const { error: deleteError } = await supabase
      .from('files')
      .delete()
      .eq('id', id)

    if (deleteError) {
      return NextResponse.json(
        { error: 'Erro ao excluir arquivo' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] DELETE file error:', error)
    return NextResponse.json(
      { error: 'Erro interno' },
      { status: 500 }
    )
  }
}
