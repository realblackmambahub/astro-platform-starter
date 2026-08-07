import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// This route now only registers file metadata after upload via tus-js-client
export async function POST(request: Request) {
  try {
    // Validate environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseSecretKey) {
      return NextResponse.json(
        { error: 'Erro ao configurar', details: 'Variáveis Supabase não configuradas' },
        { status: 500 }
      )
    }

    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    // Parse request - only metadata, no file content
    const { original_name, storage_path, mime_type, size } = await request.json()

    if (!original_name || !storage_path || !size) {
      return NextResponse.json(
        { error: 'Dados incompletos', details: 'Forneça: original_name, storage_path, size' },
        { status: 400 }
      )
    }

    // Insert file record in database
    console.log('[v0] Registering file metadata:', original_name)
    const { data: fileRecord, error: dbError } = await supabaseAdmin
      .from('files')
      .insert({
        original_name,
        storage_path,
        mime_type,
        size,
        active: true,
      })
      .select()
      .single()

    if (dbError) {
      console.error('[v0] Insert files error:', dbError)
      return NextResponse.json(
        { error: 'Erro ao registrar arquivo', details: dbError.message },
        { status: 500 }
      )
    }

    console.log('[v0] File metadata registered:', original_name)
    return NextResponse.json(fileRecord, { status: 201 })
  } catch (error) {
    console.error('[v0] Upload route error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    return NextResponse.json(
      { error: 'Erro interno', details: errorMessage },
      { status: 500 }
    )
  }
}
