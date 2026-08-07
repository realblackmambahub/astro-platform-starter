'use client'

import { useState } from 'react'
import { X, AlertCircle } from 'lucide-react'

export interface EditRecipientModalProps {
  isOpen: boolean
  recipient: any
  allFiles: any[]
  onClose: () => void
  onSave: (data: { name: string; email: string; fileId: string; active: boolean }) => Promise<void>
}

export function EditRecipientModal({
  isOpen,
  recipient,
  allFiles,
  onClose,
  onSave,
}: EditRecipientModalProps) {
  const [name, setName] = useState(recipient?.name || '')
  const [email, setEmail] = useState(recipient?.email || '')
  const [fileId, setFileId] = useState(recipient?.currentFileId || '')
  const [active, setActive] = useState(recipient?.currentActive !== false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showInactiveWarning, setShowInactiveWarning] = useState(false)

  if (!isOpen) return null

  const selectedFile = allFiles?.find((f: any) => f.id === fileId)
  const isInactiveFile = selectedFile?.active === false

  const handleFileChange = (newFileId: string) => {
    const file = allFiles?.find((f: any) => f.id === newFileId)
    if (file?.active === false) {
      setShowInactiveWarning(true)
    } else {
      setShowInactiveWarning(false)
    }
    setFileId(newFileId)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name || !email || !fileId) {
      setError('Preencha todos os campos')
      return
    }

    setLoading(true)
    try {
      await onSave({
        name,
        email,
        fileId,
        active,
      })
      setName('')
      setEmail('')
      setFileId('')
      setActive(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-foreground">Editar Destinatário</h2>
              <button
                onClick={onClose}
                disabled={loading}
                className="p-1 text-muted-foreground hover:text-foreground transition disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 mb-4 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground placeholder-muted-foreground disabled:opacity-50"
                  placeholder="Nome do destinatário"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  E-mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground placeholder-muted-foreground disabled:opacity-50"
                  placeholder="email@exemplo.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Arquivo vinculado
                </label>
                <select
                  value={fileId}
                  onChange={(e) => handleFileChange(e.target.value)}
                  disabled={loading}
                  className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground disabled:opacity-50 cursor-pointer"
                  required
                >
                  <option value="">Selecione um arquivo</option>
                  {allFiles?.map((file: any) => (
                    <option key={file.id} value={file.id}>
                      {file.original_name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      {file.active === false ? ' — Inativo' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {showInactiveWarning && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-700">
                    Este arquivo está inativo. O link não permitirá downloads até que o arquivo seja ativado novamente.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  disabled={loading}
                  className="rounded border-border"
                />
                <label htmlFor="active" className="text-sm text-foreground cursor-pointer">
                  Link ativo
                </label>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 px-4 py-2 rounded-lg border border-border text-foreground hover:bg-secondary transition disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition disabled:opacity-50"
                >
                  {loading ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
