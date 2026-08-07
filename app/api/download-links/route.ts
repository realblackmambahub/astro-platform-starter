import { createClient } from '@/lib/supabase/server'
import { generateSecureCode } from '@/lib/utils/download'
import { NextResponse } from 'next/server'

function verifyAdminToken(request: Request): boolean {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  const expectedToken = Buffer.from(
    `${process.env.ADMIN_USERNAME || 'admin'}:${process.env.ADMIN_PASSWORD || 'admin123'}`
  ).toString('base64')
  return token === expectedToken
}

export async function GET() {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('download_links')
      .select('*, recipient:recipients(*), file:files(*)')
      .eq('active', true)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json(data || [])
  } catch {
    return NextResponse.json({ error: 'Erro ao buscar links de download' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { recipient_id, file_id } = await request.json()

    if (!recipient_id || !file_id) {
      return NextResponse.json(
        { error: 'ID do destinatário e ID do arquivo são obrigatórios' },
        { status: 400 }
      )
    }

    const code = generateSecureCode()
    const supabase = createClient()

    const { data, error } = await supabase
      .from('download_links')
      .insert([
        {
          code,
          recipient_id,
          file_id,
          active: true,
        },
      ])
      .select('*, recipient:recipients(*), file:files(*)')

    if (error) throw error

    return NextResponse.json(data?.[0], { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro ao criar link de download' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { id, active } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
    }

    const supabase = createClient()
    const { data, error } = await supabase
      .from('download_links')
      .update({ active })
      .eq('id', id)
      .select('*, recipient:recipients(*), file:files(*)')

    if (error) throw error

    return NextResponse.json(data?.[0])
  } catch {
    return NextResponse.json({ error: 'Erro ao atualizar link de download' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
    }

    const supabase = createClient()
    const { error } = await supabase.from('download_links').delete().eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro ao deletar link de download' }, { status: 500 })
  }
}
