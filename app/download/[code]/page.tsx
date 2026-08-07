'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Download, AlertCircle, CheckCircle } from 'lucide-react'
import type { DownloadLink, File } from '@/lib/types'

export default function DownloadPage() {
  const params = useParams()
  const code = params.code as string
  const [link, setLink] = useState<DownloadLink | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadedFlag, setDownloadedFlag] = useState(false)

  useEffect(() => {
    const fetchLink = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/download-link/${code}`)
        if (!response.ok) {
          setError('Link de download não encontrado ou expirado')
          return
        }

        const data = await response.json()
        setLink(data)
        setFile(data.file)

        // Track link open
        await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            download_link_id: data.id,
            recipient_id: data.recipient_id,
            file_id: data.file_id,
            event_type: 'link_open',
            referer: document.referrer,
          }),
        })
      } catch {
        setError('Erro ao carregar link de download')
      } finally {
        setLoading(false)
      }
    }

    if (code) {
      fetchLink()
    }
  }, [code])

  const handleDownload = async () => {
    if (!link || !file || downloading) return

    try {
      setDownloading(true)

      // Track button click
      await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          download_link_id: link.id,
          recipient_id: link.recipient_id,
          file_id: link.file_id,
          event_type: 'button_click',
          referer: document.referrer,
        }),
      })

      // Track download start
      await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          download_link_id: link.id,
          recipient_id: link.recipient_id,
          file_id: link.file_id,
          event_type: 'download_start',
          referer: document.referrer,
        }),
      })

      // Trigger download
      const downloadUrl = `/api/download/${link.id}`
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = file.original_name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      // Track download complete
      await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          download_link_id: link.id,
          recipient_id: link.recipient_id,
          file_id: link.file_id,
          event_type: 'download_complete',
          referer: document.referrer,
        }),
      })

      setDownloadedFlag(true)
    } catch {
      setError('Erro ao fazer download do arquivo')
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-foreground">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-background/80 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {error ? (
          <div className="bg-card border border-border rounded-lg p-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h1 className="text-lg font-semibold text-foreground mb-2">Erro</h1>
            <p className="text-muted-foreground">{error}</p>
          </div>
        ) : !link || !file ? (
          <div className="bg-card border border-border rounded-lg p-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h1 className="text-lg font-semibold text-foreground mb-2">Link não encontrado</h1>
            <p className="text-muted-foreground">O link de download pode ter expirado ou ser inválido</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg p-6">
            <h1 className="text-2xl font-bold text-foreground mb-4">Seu download está pronto</h1>
            <div className="bg-secondary/30 rounded-lg p-4 mb-6">
              <p className="text-sm text-muted-foreground mb-1">Arquivo:</p>
              <p className="font-semibold text-foreground truncate">{file.original_name}</p>
            </div>

            {downloadedFlag && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-4 flex gap-2">
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-green-500">Download iniciado</p>
                  <p className="text-sm text-green-500/80">Se o download não começar, use o botão abaixo</p>
                </div>
              </div>
            )}

            <button
              onClick={handleDownload}
              disabled={downloading}
              className="w-full bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-primary-foreground font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2"
            >
              <Download className="h-5 w-5" />
              {downloading ? 'Processando...' : 'Baixar arquivo'}
            </button>

            <p className="text-xs text-muted-foreground text-center mt-4">
              Seu download será rastreado para fins de análise
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
