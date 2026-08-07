import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

export async function GET() {
  try {
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

    const { data, error } = await supabase
      .from('recipients')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message || 'Erro ao buscar destinatários' }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (error) {
    console.error('[v0] Recipients GET error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(request: Request) {
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
    const { name, email, fileId } = await request.json()

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

    // Determinar arquivo a usar
    let selectedFile: any
    
    if (fileId) {
      // Usar arquivo especificado
      const { data: file, error: fileError } = await supabase
        .from('files')
        .select('id')
        .eq('id', fileId)
        .single()

      if (fileError || !file) {
        return NextResponse.json(
          { error: 'Arquivo não encontrado' },
          { status: 404 }
        )
      }
      selectedFile = file
    } else {
      // Fallback: buscar arquivo ativo
      const { data: activeFile, error: fileError } = await supabase
        .from('files')
        .select('id')
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (fileError || !activeFile) {
        return NextResponse.json(
          { error: 'Nenhum arquivo disponível' },
          { status: 404 }
        )
      }
      selectedFile = activeFile
    }

    // Create recipient
    const { data: recipient, error: recipientError } = await supabase
      .from('recipients')
      .insert({ name, email, active: true })
      .select()
      .single()

    if (recipientError) {
      return NextResponse.json(
        { error: 'Erro ao criar destinatário', details: recipientError.message },
        { status: 500 }
      )
    }

    // Generate secure code
    const code = randomUUID().replaceAll('-', '')

    // Create download link
    const { data: downloadLink, error: linkError } = await supabase
      .from('download_links')
      .insert({
        code,
        recipient_id: recipient.id,
        file_id: selectedFile.id,
        active: true,
        access_count: 0,
        download_count: 0,
      })
      .select()
      .single()

    if (linkError) {
      // Rollback: delete recipient
      await supabase.from('recipients').delete().eq('id', recipient.id)

      return NextResponse.json(
        { error: 'Erro ao gerar link', details: linkError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      recipient,
      downloadLink,
      code,
    })
  } catch (error) {
    console.error('[v0] Recipients POST error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    return NextResponse.json(
      { error: 'Erro interno', details: errorMessage },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const { id, name, email, active } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
    }

    const supabase = createClient()

    const { data, error } = await supabase
      .from('recipients')
      .update({ name, email, active, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[v0] Recipients PUT error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
    }

    const supabase = createClient()

    const { error } = await supabase.from('recipients').delete().eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] Recipients DELETE error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
