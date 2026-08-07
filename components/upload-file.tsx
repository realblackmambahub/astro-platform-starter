'use client'

import { useState, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Upload as UploadIcon } from 'lucide-react'

export interface UploadFileProps {
  onSuccess: (file: { original_name: string; storage_path: string; mime_type: string; size: number }) => void
  onError: (error: string) => void
}

export function UploadFile({ onSuccess, onError }: UploadFileProps) {
  const [uploading, setUploading] = useState(false)
  const [fileName, setFileName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file extension only (case insensitive)
    const lowerName = file.name.toLowerCase()
    const allowedExtensions = ['.exe', '.rar', '.zip']
    const isValidExtension = allowedExtensions.some((ext) => lowerName.endsWith(ext))

    if (!isValidExtension) {
      onError('Tipo de arquivo não permitido. Use um arquivo .exe, .rar ou .zip')
      return
    }

    const maxSize = 100 * 1024 * 1024 // 100MB

    if (file.size > maxSize) {
      onError('Arquivo muito grande. Máximo 100MB')
      return
    }

    setFileName(file.name)
    setUploading(true)

    try {
      // Step 1: Request signed token from backend
      console.log('[v0] Requesting signed upload token...')
      const signResponse = await fetch('/api/upload/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalName: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
        }),
      })

      const contentType = signResponse.headers.get('content-type')
      const signResult = contentType?.includes('application/json')
        ? await signResponse.json()
        : { error: await signResponse.text() }

      if (!signResponse.ok) {
        throw new Error(
          signResult.details ||
          signResult.error ||
          `Erro HTTP ${signResponse.status}`
        )
      }

      // Validate response
      if (typeof signResult.token !== 'string' || signResult.token.length < 20) {
        throw new Error('Token de upload assinado inválido ou ausente')
      }

      if (typeof signResult.storagePath !== 'string' || !signResult.storagePath) {
        throw new Error('Caminho do arquivo inválido ou ausente')
      }

      console.log('[v0] Got signed token, uploading directly to Supabase...')

      // Step 2: Upload directly to Supabase using signed URL
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
      )

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('downloads')
        .uploadToSignedUrl(
          signResult.storagePath,
          signResult.token,
          file,
          {
            contentType: file.type || 'application/octet-stream',
            cacheControl: '3600',
          }
        )

      if (uploadError) {
        throw new Error(`Erro no Storage: ${uploadError.message}`)
      }

      console.log('[v0] Upload successful, registering metadata...')

      // Step 3: Register file metadata in database
      const metadataResponse = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original_name: file.name,
          storage_path: signResult.storagePath,
          mime_type: file.type || 'application/octet-stream',
          size: file.size,
        }),
      })

      if (!metadataResponse.ok) {
        const errorData = await metadataResponse.json()
        throw new Error(errorData.details || errorData.error || 'Erro ao registrar arquivo')
      }

      const fileRecord = await metadataResponse.json()
      console.log('[v0] File metadata registered:', fileRecord)

      setUploading(false)
      setFileName('')
      if (inputRef.current) {
        inputRef.current.value = ''
      }
      onSuccess(fileRecord)
    } catch (error) {
      console.error('[v0] Upload error:', error)
      setUploading(false)
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      onError(errorMessage)
    }
  }

  return (
    <div>
      <label className="flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-dashed border-primary/50 hover:border-primary cursor-pointer transition">
        <UploadIcon className="h-5 w-5 text-primary flex-shrink-0" />
        <span className="text-sm font-medium text-foreground">
          {uploading ? 'Enviando arquivo...' : 'Clique para selecionar arquivo (.exe, .rar ou .zip)'}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept=".exe,.rar,.zip"
          onChange={handleFileSelect}
          disabled={uploading}
          className="hidden"
        />
      </label>
    </div>
  )
}
