import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('[v0] Files GET error:', error)
    return NextResponse.json({ error: 'Erro ao buscar arquivos' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { original_name, mime_type, size, storage_path } = await request.json()

    if (!original_name || !mime_type || !storage_path) {
      return NextResponse.json(
        { error: 'Nome, tipo MIME e caminho de armazenamento são obrigatórios' },
        { status: 400 }
      )
    }

    const supabase = createClient()
    
    // Deactivate all other files
    await supabase.from('files').update({ active: false }).neq('id', 'null')
    
    // Insert new file as active
    const { data, error } = await supabase
      .from('files')
      .insert({
        original_name,
        mime_type,
        size: size || 0,
        storage_path,
        active: true,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('[v0] Files POST error:', error)
    return NextResponse.json({ error: 'Erro ao criar arquivo' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
    }

    const supabase = createClient()
    const { error } = await supabase.from('files').delete().eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] Files DELETE error:', error)
    return NextResponse.json({ error: 'Erro ao deletar arquivo' }, { status: 500 })
  }
}
