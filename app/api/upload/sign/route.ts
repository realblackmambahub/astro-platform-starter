import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

export async function POST(request: Request) {
  try {
    // Validate environment variables
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      'https://tjdnktlorloqjhydsnvq.supabase.co'

    const supabaseSecretKey =
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl) {
      return NextResponse.json(
        { error: 'Erro ao configurar upload', details: 'Supabase URL não configurada' },
        { status: 500 }
      )
    }

    if (!supabaseSecretKey) {
      return NextResponse.json(
        { error: 'Erro ao configurar upload', details: 'Supabase Secret Key não configurada' },
        { status: 500 }
      )
    }

    // Parse request
    const { originalName, mimeType, size } = await request.json()

    if (!originalName || !size) {
      return NextResponse.json(
        { error: 'Dados incompletos', details: 'Forneça: originalName, size' },
        { status: 400 }
      )
    }

    // Validate file extension only (case insensitive)
    const normalizedName = originalName.toLowerCase()
    const allowedExtensions = ['.exe', '.rar', '.zip']
    const isValidExtension = allowedExtensions.some((ext) => normalizedName.endsWith(ext))

    if (!isValidExtension) {
      return NextResponse.json(
        {
          error: 'Tipo de arquivo não permitido',
          details: 'Envie um arquivo com extensão .exe, .rar ou .zip'
        },
        { status: 400 }
      )
    }

    if (size > 100 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Arquivo muito grande', details: 'Máximo 100 MB por arquivo' },
        { status: 400 }
      )
    }

    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    // Generate unique storage path with correct extension
    let extension = '.zip'
    if (normalizedName.endsWith('.exe')) {
      extension = '.exe'
    } else if (normalizedName.endsWith('.rar')) {
      extension = '.rar'
    }
    const storagePath = `${Date.now()}-${randomUUID()}${extension}`

    console.log('[v0] Generating signed upload URL for:', storagePath)

    // Create signed upload URL
    const { data, error } = await supabaseAdmin.storage
      .from('downloads')
      .createSignedUploadUrl(storagePath, { 
        upsert: false 
      })

    if (error) {
      console.error('[v0] Supabase signed URL error:', error)
      return NextResponse.json(
        { error: 'Erro ao gerar token assinado', details: error.message },
        { status: 500 }
      )
    }

    // Validate token exists
    if (typeof data.token !== 'string' || data.token.length < 20) {
      console.error('[v0] Invalid token from Supabase:', data)
      return NextResponse.json(
        { error: 'Erro ao gerar token', details: 'Token inválido ou ausente' },
        { status: 500 }
      )
    }

    console.log('[v0] Signed upload URL generated successfully')

    // Return only storage path and token
    return NextResponse.json({
      storagePath,
      token: data.token
    })
  } catch (error) {
    console.error('[v0] Sign upload error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    return NextResponse.json(
      { error: 'Erro interno', details: errorMessage },
      { status: 500 }
    )
  }
}
