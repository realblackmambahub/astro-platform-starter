'use client'

import { useEffect, useState, use, useRef } from 'react'
import { Download } from 'lucide-react'

export default function DownloadPage({ params }: { params: Promise<{ code: string }> }) {
  const [linkData, setLinkData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloadStarted, setDownloadStarted] = useState(false)
  const downloadStartedRef = useRef(false)
  const accessRegisteredRef = useRef(false)
  
  const resolvedParams = use(params)
  const code = resolvedParams.code

  useEffect(() => {
    if (!code) {
      setError('Código inválido')
      setLoading(false)
      return
    }

    const loadLink = async () => {
      try {
        const response = await fetch(
          `/api/download-link/${encodeURIComponent(code)}`,
          { cache: 'no-store' }
        )

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Link não encontrado')
        }

        if (!data.link || data.link.active !== true) {
          throw new Error('Link não encontrado ou inativo')
        }

        if (!data.file) {
          throw new Error('Arquivo não encontrado')
        }

        if (data.file.active !== true) {
          throw new Error('Este arquivo não está disponível no momento')
        }

        setLinkData(data)
        setLoading(false)

        // Registrar acesso apenas uma vez usando sessionStorage
        const accessKey = `access-recorded-${code}`
        if (typeof window !== 'undefined' && !sessionStorage.getItem(accessKey)) {
          try {
            const response = await fetch('/api/events/access', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code }),
            })

            const result = await response.json()

            if (response.ok && result.success) {
              sessionStorage.setItem(accessKey, 'true')
            }
          } catch (err) {
            console.error('[v0] Failed to record access:', err)
          }
        }
      } catch (err) {
        console.error('[v0] Error loading link:', err)
        setError(
          err instanceof Error
            ? err.message
            : 'Erro ao carregar link'
        )
        setLoading(false)
      }
    }

    loadLink()
  }, [code])

  // Dispara download automático após dados serem carregados
  useEffect(() => {
    if (!linkData || !code || downloadStartedRef.current) {
      return
    }

    downloadStartedRef.current = true
    setDownloadStarted(true)

    const timer = window.setTimeout(() => {
      window.location.href = `/api/download/${encodeURIComponent(code)}`
    }, 500)

    return () => window.clearTimeout(timer)
  }, [linkData, code])

  const handleDownload = () => {
    window.location.href = `/api/download/${encodeURIComponent(code)}`
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-foreground">Carregando arquivo...</p>
        </div>
      </div>
    )
  }

  if (downloadStarted && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-foreground mb-2">Preparando seu download...</p>
          <p className="text-sm text-muted-foreground">O download começou automaticamente.</p>
          <p className="text-xs text-muted-foreground mt-4">Se não começar, clique no botão abaixo:</p>
        </div>
      </div>
    )
  }

  if (error || !linkData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-foreground mb-2">Erro</h1>
          <p className="text-muted-foreground">{error || 'Link não encontrado ou inativo'}</p>
        </div>
      </div>
    )
  }

  const file = linkData.file
  const recipient = linkData.recipient

  if (downloadStarted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-card border border-border rounded-lg p-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="h-16 w-16 bg-primary/10 rounded-lg flex items-center justify-center">
              <Download className="h-8 w-8 text-primary" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-2">{file.original_name}</h1>
          <p className="text-muted-foreground mb-2">{formatFileSize(file.size)}</p>

          {recipient && (
            <p className="text-sm text-muted-foreground mb-6">Destinatário: {recipient.name}</p>
          )}

          <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <div className="animate-spin h-8 w-8 border-b-2 border-primary mx-auto mb-3" />
            <p className="text-sm text-foreground font-medium">Preparando seu download...</p>
            <p className="text-xs text-muted-foreground mt-2">O download começou automaticamente.</p>
          </div>

          <p className="text-xs text-muted-foreground mb-4">Se o download não começar, clique no botão abaixo:</p>

          <button
            onClick={handleDownload}
            className="w-full px-6 py-3 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition"
          >
            <Download className="inline-block h-5 w-5 mr-2" />
            Baixar arquivo manualmente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-lg p-8 text-center">
        <div className="flex justify-center mb-6">
          <div className="h-16 w-16 bg-primary/10 rounded-lg flex items-center justify-center">
            <Download className="h-8 w-8 text-primary" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">{file.original_name}</h1>
        <p className="text-muted-foreground mb-6">{formatFileSize(file.size)}</p>

        {recipient && (
          <p className="text-sm text-muted-foreground mb-6">Destinatário: {recipient.name}</p>
        )}

        <button
          onClick={handleDownload}
          className="w-full px-6 py-3 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition"
        >
          <Download className="inline-block h-5 w-5 mr-2" />
          Baixar arquivo
        </button>
      </div>
    </div>
  )
}

function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`
}
