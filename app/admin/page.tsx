'use client'

import { useState, useEffect } from 'react'
import { BarChart3, Users, FileText, Link, TrendingUp, Settings, Trash2, Plus, Copy, Check, Edit2, ToggleRight, ToggleLeft } from 'lucide-react'
import useSWR from 'swr'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { UploadFile } from '@/components/upload-file'
import { EditRecipientModal } from '@/components/admin/recipient-edit-modal'
import { DeleteConfirmationModal } from '@/components/admin/delete-confirmation-modal'

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((res) => res.json())

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [copied, setCopied] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetSuccess, setResetSuccess] = useState<string | null>(null)
  const [diagnostics, setDiagnostics] = useState<any | null>(null)
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false)
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null)

  const { data: stats, mutate: mutateStats } = useSWR('/api/stats', fetcher, { refreshInterval: 5000 })
  const { data: recipients, mutate: mutateRecipients } = useSWR('/api/recipients', fetcher, { refreshInterval: 30000 })
  const { data: files, mutate: mutateFiles } = useSWR('/api/files', fetcher, { refreshInterval: 30000 })
  const { data: downloadLinks, mutate: mutateDownloadLinks } = useSWR('/api/download-links', fetcher, { refreshInterval: 30000 })
  const { mutate: mutateEvents } = useSWR('/api/events', fetcher, { refreshInterval: 30000 })

  const tabs = [
    { id: 'overview', label: 'Visão Geral', icon: BarChart3 },
    { id: 'recipients', label: 'Destinatários', icon: Users },
    { id: 'files', label: 'Arquivo', icon: FileText },
    { id: 'analytics', label: 'Análise', icon: TrendingUp },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ]

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const runDiagnostics = async () => {
    setDiagnosticsLoading(true)
    setDiagnosticsError(null)
    try {
      const response = await fetch('/api/debug/events')
      const result = await response.json()
      setDiagnostics(result)
    } catch (error) {
      setDiagnosticsError(error instanceof Error ? error.message : 'Failed to run diagnostics')
    } finally {
      setDiagnosticsLoading(false)
    }
  }

  const createTestEvent = async () => {
    try {
      const response = await fetch('/api/events/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: '2c28e1bff1904f868ecfe08b1d69da19' }),
      })
      const result = await response.json()
      if (response.ok && result.success) {
        alert('Evento de teste criado com sucesso!')
      } else {
        alert(`Erro: ${result.error}`)
      }
    } catch (error) {
      alert(`Erro: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleConfirmReset = async () => {
    setResetLoading(true)
    try {
      const response = await fetch('/api/stats', { method: 'DELETE' })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao zerar dados')
      }

      setResetSuccess('Todos os dados foram zerados com sucesso.')
      setShowResetConfirm(false)

      // Aguardar 500ms para garantir que o banco foi atualizado
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Atualizar todas as queries em paralelo
      await Promise.all([
        mutateStats(),
        mutateEvents(),
        mutateRecipients(),
        mutateDownloadLinks(),
        mutateFiles(),
      ])

      // Limpar toast após 3 segundos
      setTimeout(() => setResetSuccess(null), 3000)
    } catch (error) {
      console.error('[v0] Error resetting data:', error)
      alert(error instanceof Error ? error.message : 'Erro ao zerar dados')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-border overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 font-medium border-b-2 transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total de downloads" value={stats?.totalDownloads || 0} />
            <StatCard label="Downloads hoje" value={stats?.todayDownloads || 0} />
            <StatCard label="IPs únicos" value={stats?.uniqueIPs || 0} />
            <StatCard label="Total de acessos" value={stats?.totalAccesses || 0} />
          </div>

          {/* Device Percentages */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label="iOS" value={`${stats?.iosPercent || 0}%`} />
            <StatCard label="Desktop" value={`${stats?.desktopPercent || 0}%`} />
            <StatCard label="Celular" value={`${stats?.mobilePercent || 0}%`} />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Downloads Last 7 Days */}
            {stats?.last7Days && (
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Downloads últimos 7 dias</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={Object.entries(stats.last7Days).map(([date, count]) => ({ date, count }))} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="date" width={80} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Devices Pie Chart */}
            {stats?.deviceStats && (
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Distribuição de dispositivos</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={Object.entries(stats.deviceStats).map(([name, value]) => ({ name, value }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {Object.entries(stats.deviceStats).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Top Countries */}
          {stats?.topCountries && stats.topCountries.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Top países</h3>
              <div className="space-y-2">
                {stats.topCountries.map((item) => (
                  <div key={item.country} className="flex justify-between items-center">
                    <span className="text-foreground">{item.country}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{
                            width: `${(item.count / (stats.topCountries[0]?.count || 1)) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-muted-foreground text-sm">{item.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Browsers */}
          {stats?.topBrowsers && stats.topBrowsers.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Navegadores</h3>
              <div className="space-y-2">
                {stats.topBrowsers.map((item) => (
                  <div key={item.browser} className="flex justify-between items-center">
                    <span className="text-foreground">{item.browser}</span>
                    <span className="text-muted-foreground text-sm">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recipient Stats Table */}
          {stats?.recipientStats && (
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Por destinatário</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-2 text-sm font-semibold text-foreground">Nome</th>
                      <th className="text-center py-2 px-2 text-sm font-semibold text-foreground">Acessos</th>
                      <th className="text-center py-2 px-2 text-sm font-semibold text-foreground">Downloads</th>
                      <th className="text-center py-2 px-2 text-sm font-semibold text-foreground">Eventos</th>
                      <th className="text-right py-2 px-2 text-sm font-semibold text-foreground">Último</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recipientStats.map((r) => (
                      <tr key={r.id} className="border-b border-border hover:bg-secondary/20">
                        <td className="py-2 px-2 text-sm text-foreground">{r.name}</td>
                        <td className="py-2 px-2 text-sm text-center text-foreground">{r.accesses}</td>
                        <td className="py-2 px-2 text-sm text-center text-foreground">{r.downloads}</td>
                        <td className="py-2 px-2 text-sm text-center text-foreground">{r.events}</td>
                        <td className="py-2 px-2 text-sm text-right text-muted-foreground">
                          {r.lastEvent ? formatDate(new Date(r.lastEvent)) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Detailed Log */}
          {stats?.detailedLog && (
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Log detalhado</h3>
              <div className="overflow-x-auto border border-border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-secondary/40 backdrop-blur-sm">
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground whitespace-nowrap w-32">Data/Hora (SP)</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Nome</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Arquivo</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">IP</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Local</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Provedor</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Dispositivo</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Navegador</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {stats.detailedLog.map((log) => {
                      const locationParts = [log.city, log.region, log.country].filter(Boolean)
                      const locationText = locationParts.length > 0 ? locationParts.join(', ') : 'Local não identificado'
                      
                      return (
                        <tr key={log.id} className="hover:bg-secondary/20 transition-colors align-middle">
                          <td className="py-4 px-4 text-xs text-muted-foreground whitespace-nowrap w-32">
                            {log.created_at ? new Date(log.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '-'}
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex flex-col gap-0.5 max-w-xs truncate">
                              <p className="font-semibold text-foreground text-sm truncate">{log.recipientName || '-'}</p>
                              <p className="text-xs text-muted-foreground truncate">{log.recipientEmail || ''}</p>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <a href={`#${log.fileName}`} className="text-primary hover:underline text-sm font-medium truncate max-w-xs">
                              {log.fileName || '-'}
                            </a>
                          </td>
                          <td className="py-4 px-4 font-mono text-xs text-muted-foreground">{log.ip_address || '-'}</td>
                          <td className="py-4 px-4">
                            <div className="text-sm text-foreground flex flex-col gap-0.5 max-w-xs">
                              <span>{locationText}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="text-xs text-muted-foreground max-w-xs break-words">
                              {log.provider || 'Não identificado'}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-primary/10 text-primary whitespace-nowrap">
                              {log.device_type || 'Desktop'}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <div className="text-sm text-foreground flex items-center truncate">
                              {log.browser || '-'}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recipients Tab */}
      {activeTab === 'recipients' && (
        <RecipientsTab
          recipients={recipients}
          downloadLinks={downloadLinks}
          files={files}
          copyToClipboard={copyToClipboard}
          copied={copied}
          mutateRecipients={mutateRecipients}
          mutateDownloadLinks={mutateDownloadLinks}
          mutatFiles={mutateDownloadLinks}
        />
      )}

      {/* Files Tab */}
      {activeTab === 'files' && <FilesTab files={files} mutateFiles={mutateFiles} />}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && <AnalyticsTab stats={stats} />}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-4">
          {/* Diagnostic Section */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Diagnóstico do Sistema</h3>
            <div className="space-y-3 mb-4">
              <button
                onClick={runDiagnostics}
                disabled={diagnosticsLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 font-medium transition disabled:opacity-50"
              >
                {diagnosticsLoading ? '⏳ ' : ''}
                {diagnosticsLoading ? 'Rodando...' : 'Executar Diagnóstico'}
              </button>
              <button
                onClick={createTestEvent}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 font-medium transition"
              >
                ➕ Criar Evento de Teste
              </button>
            </div>
            
            {diagnosticsError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 text-sm">
                Erro: {diagnosticsError}
              </div>
            )}

            {diagnostics && (
              <div className="space-y-3 text-sm">
                <div className={`p-2 rounded ${diagnostics.supabaseConnected ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                  Supabase: {diagnostics.supabaseConnected ? '✓ Conectado' : '✗ Desconectado'}
                </div>
                <div className={`p-2 rounded ${diagnostics.tables.download_events ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                  Tabela download_events: {diagnostics.tables.download_events ? '✓ Acessível' : '✗ Inacessível'}
                </div>
                <div className={`p-2 rounded ${diagnostics.columns.eventTypeColumn ? 'bg-green-500/10 text-green-600' : 'bg-yellow-500/10 text-yellow-600'}`}>
                  Coluna event_type: {diagnostics.columns.eventTypeColumn ? `✓ ${diagnostics.columns.eventTypeColumn}` : '⚠ Não detectada'}
                </div>
                <div className={`p-2 rounded ${diagnostics.columns.hasIpAddress ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                  Coluna ip_address: {diagnostics.columns.hasIpAddress ? '✓ Sim' : '✗ Não'}
                </div>
                <div className="p-2 rounded bg-blue-500/10 text-blue-600">
                  Eventos: {diagnostics.counts.events} total ({diagnostics.counts.accessEvents} access, {diagnostics.counts.downloadEvents} download)
                </div>
                <div className={`p-2 rounded ${diagnostics.rpc.incrementAccessAvailable ? 'bg-green-500/10 text-green-600' : 'bg-yellow-500/10 text-yellow-600'}`}>
                  RPC increment_access_count: {diagnostics.rpc.incrementAccessAvailable ? '✓ Disponível' : '⚠ Indisponível (usará fallback)'}
                </div>
                <div className={`p-2 rounded ${diagnostics.rpc.incrementDownloadAvailable ? 'bg-green-500/10 text-green-600' : 'bg-yellow-500/10 text-yellow-600'}`}>
                  RPC increment_download_count: {diagnostics.rpc.incrementDownloadAvailable ? '✓ Disponível' : '⚠ Indisponível (usará fallback)'}
                </div>
                {diagnostics.lastEvent && (
                  <div className="p-2 rounded bg-gray-500/10 text-gray-600 text-xs">
                    Último evento: {diagnostics.lastEvent.type} em {new Date(diagnostics.lastEvent.created_at).toLocaleString('pt-BR')}
                  </div>
                )}
                {diagnostics.errors.length > 0 && (
                  <div className="p-2 rounded bg-orange-500/10 text-orange-600 text-xs">
                    <div className="font-semibold mb-1">Erros encontrados:</div>
                    {diagnostics.errors.map((err: string, i: number) => (
                      <div key={i}>• {err}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Data Section */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Dados</h3>
            {resetSuccess && (
              <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-600 text-sm">
                {resetSuccess}
              </div>
            )}
            <div className="space-y-3">
              <button
                onClick={() => setShowResetConfirm(true)}
                disabled={resetLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive font-medium transition disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Zerar dados (eventos e contadores)
              </button>
              <button
                onClick={async () => {
                  try {
                    const response = await fetch('/api/events/cleanup-duplicates', { method: 'POST' })
                    const result = await response.json()
                    if (response.ok) {
                      setSuccess(result.message || 'Duplicados removidos com sucesso')
                      setTimeout(() => setSuccess(null), 3000)
                      await mutateStats()
                    } else {
                      setError(result.error || 'Erro ao remover duplicados')
                    }
                  } catch (err) {
                    setError('Erro ao remover duplicados')
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 font-medium transition"
              >
                <Trash2 className="h-4 w-4" />
                Remover eventos duplicados
              </button>
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmationModal
        isOpen={showResetConfirm}
        title="Zerar todos os dados"
        message="Tem certeza que deseja apagar todos os eventos e zerar todos os contadores? Esta ação não pode ser desfeita."
        confirmText="Zerar tudo"
        cancelText="Cancelar"
        isDangerous={true}
        isLoading={resetLoading}
        onConfirm={handleConfirmReset}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <p className="text-sm text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  )
}

function RecipientsTab({
  recipients,
  downloadLinks,
  files,
  copyToClipboard,
  copied,
  mutateRecipients,
  mutateDownloadLinks,
  mutatFiles,
}: {
  recipients: any
  downloadLinks: any
  files: any
  copyToClipboard: (text: string, id: string) => void
  copied: string | null
  mutateRecipients: () => void
  mutateDownloadLinks: () => void
  mutatFiles: () => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', fileId: '' })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [generatedLink, setGeneratedLink] = useState<{ code: string; url: string } | null>(null)
  const [editingRecipient, setEditingRecipient] = useState<any | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [modalLoading, setModalLoading] = useState(false)

  const recipientList = Array.isArray(recipients) ? recipients : []
  const linksList = Array.isArray(downloadLinks) ? downloadLinks : []

  const getLinkForRecipient = (recipientId: string) => {
    return linksList.find((l: any) => l.recipient_id === recipientId)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      const response = await fetch('/api/recipients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.details || data.error || 'Erro ao criar destinatário')
        setLoading(false)
        return
      }

      const code = data.code
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')
      const url = `${appUrl.replace(/\/$/, '')}/d/${code}`
      setGeneratedLink({ code, url })
      setSuccess(`Link gerado para ${form.name}`)
      setForm({ name: '', email: '', fileId: '' })

      await mutateRecipients()
      await mutateDownloadLinks()

      setTimeout(() => {
        setSuccess(null)
        setGeneratedLink(null)
        setShowForm(false)
      }, 5000)
    } catch (error) {
      console.error('[v0] Error creating recipient:', error)
      setError('Erro ao criar destinatário')
    } finally {
      setLoading(false)
    }
  }

  const handleEditRecipient = (recipient: any) => {
    const link = getLinkForRecipient(recipient.id)
    setEditingRecipient({
      ...recipient,
      currentFileId: link?.file_id,
      currentActive: link?.active,
      linkId: link?.id,
    })
    setShowEditModal(true)
  }

  const handleSaveRecipient = async (data: { name: string; email: string; fileId: string; active: boolean }) => {
    if (!editingRecipient) return

    setModalLoading(true)
    try {
      const response = await fetch(`/api/recipients/${editingRecipient.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao salvar')
      }

      setSuccess('Destinatário atualizado com sucesso')
      setShowEditModal(false)
      setEditingRecipient(null)

      await mutateRecipients()
      await mutateDownloadLinks()

      setTimeout(() => setSuccess(null), 3000)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erro ao salvar')
    } finally {
      setModalLoading(false)
    }
  }

  const handleDeleteRecipient = async () => {
    if (!showDeleteConfirm) return

    setModalLoading(true)
    try {
      const response = await fetch(`/api/recipients/${showDeleteConfirm}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Erro ao excluir')
      }

      setSuccess('Destinatário excluído com sucesso')
      setShowDeleteConfirm(null)

      await mutateRecipients()
      await mutateDownloadLinks()

      setTimeout(() => setSuccess(null), 3000)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erro ao excluir')
    } finally {
      setModalLoading(false)
    }
  }

  const handleToggleLinkStatus = async (linkId: string, currentActive: boolean) => {
    try {
      const response = await fetch(`/api/download-links/${linkId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !currentActive }),
      })

      if (!response.ok) {
        throw new Error('Erro ao atualizar status do link')
      }

      setSuccess(currentActive ? 'Link desativado' : 'Link ativado')
      await mutateDownloadLinks()

      setTimeout(() => setSuccess(null), 3000)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erro ao atualizar')
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex justify-between items-center">
          <p className="text-sm text-destructive">{error}</p>
          <button onClick={() => setError(null)} className="text-destructive hover:text-destructive/80">✕</button>
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
          <p className="text-sm text-green-500 font-medium">{success}</p>
        </div>
      )}

      {generatedLink && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Link gerado com sucesso!</p>
          <div className="flex items-center gap-2 bg-secondary p-2 rounded border border-border">
            <code className="text-xs text-muted-foreground flex-1 break-all">{generatedLink.url}</code>
            <button
              onClick={() => copyToClipboard(generatedLink.url, 'generated-link')}
              className="p-1 text-muted-foreground hover:text-foreground transition flex-shrink-0"
            >
              {copied === 'generated-link' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setShowForm(!showForm)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition disabled:opacity-50"
        disabled={loading}
      >
        <Plus className="h-4 w-4" />
        Cadastrar e gerar link
      </button>

      {showForm && (
        <div className="bg-card border border-border rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Nome</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground placeholder-muted-foreground disabled:opacity-50"
                placeholder="Nome do destinatário"
                required
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">E-mail</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground placeholder-muted-foreground disabled:opacity-50"
                placeholder="email@exemplo.com"
                required
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Arquivo para o cliente</label>
              <select
                value={form.fileId}
                onChange={(e) => setForm({ ...form, fileId: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-foreground disabled:opacity-50 cursor-pointer"
                required
                disabled={loading}
              >
                <option value="">Selecione um arquivo</option>
                {Array.isArray(files) && files.map((file: any) => (
                  <option key={file.id} value={file.id}>
                    {file.original_name} — {(file.size / 1024 / 1024).toFixed(2)} MB {file.active ? '— Ativo' : '— Inativo'}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={loading || !form.fileId}
              className="w-full px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition disabled:opacity-50"
            >
              {loading ? 'Gerando...' : 'Cadastrar e gerar link'}
            </button>
          </form>
        </div>
      )}

      {recipientList.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-6 text-center">
          <p className="text-muted-foreground">Nenhum destinatário cadastrado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recipientList.map((recipient: any) => {
            const link = getLinkForRecipient(recipient.id)
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')
            const linkUrl = link ? `${appUrl.replace(/\/$/, '')}/d/${link.code}` : null
            const linkedFile = link?.file
            return (
              <div key={recipient.id} className="bg-card border border-border rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{recipient.name}</p>
                    <p className="text-sm text-muted-foreground">{recipient.email}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleEditRecipient(recipient)}
                      title="Editar"
                      className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(recipient.id)}
                      title="Excluir"
                      className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-secondary rounded transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {link && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 bg-secondary p-2 rounded border border-border">
                      <code className="text-xs text-muted-foreground flex-1 break-all">{linkUrl}</code>
                      <button
                        onClick={() => copyToClipboard(linkUrl!, `link-${recipient.id}`)}
                        className="p-1 text-muted-foreground hover:text-foreground transition flex-shrink-0"
                      >
                        {copied === `link-${recipient.id}` ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {linkedFile && (
                      <div className="bg-secondary p-2 rounded border border-border">
                        <p className="text-xs text-muted-foreground mb-1">Arquivo vinculado</p>
                        <p className="text-xs font-medium text-foreground break-all">{linkedFile.original_name}</p>
                      </div>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div className="bg-secondary p-2 rounded">
                    <p className="text-muted-foreground">Acessos</p>
                    <p className="font-semibold text-foreground">{link?.access_count || 0}</p>
                  </div>
                  <div className="bg-secondary p-2 rounded">
                    <p className="text-muted-foreground">Downloads</p>
                    <p className="font-semibold text-foreground">{link?.download_count || 0}</p>
                  </div>
                  <div className={`p-2 rounded ${link?.active ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                    <p className={`text-xs font-semibold ${link?.active ? 'text-green-600' : 'text-red-600'}`}>
                      {link?.active ? 'Ativo' : 'Inativo'}
                    </p>
                  </div>
                  <button
                    onClick={() => link && handleToggleLinkStatus(link.id, link.active)}
                    title={link?.active ? 'Desativar link' : 'Ativar link'}
                    className="p-1 rounded hover:bg-secondary transition text-muted-foreground hover:text-foreground"
                  >
                    {link?.active ? (
                      <ToggleRight className="h-4 w-4" />
                    ) : (
                      <ToggleLeft className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <EditRecipientModal
        isOpen={showEditModal}
        recipient={editingRecipient}
        allFiles={Array.isArray(files) ? files : []}
        onClose={() => {
          setShowEditModal(false)
          setEditingRecipient(null)
        }}
        onSave={handleSaveRecipient}
      />

      <DeleteConfirmationModal
        isOpen={showDeleteConfirm !== null}
        title="Excluir Destinatário"
        message="Tem certeza que deseja excluir este destinatário? O link de download vinculado também será removido."
        confirmText="Excluir"
        cancelText="Cancelar"
        isDangerous={true}
        isLoading={modalLoading}
        onConfirm={handleDeleteRecipient}
        onCancel={() => setShowDeleteConfirm(null)}
      />
    </div>
  )
}

function FilesTab({ files, mutateFiles }: { files: any; mutateFiles?: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState<string | null>(null)
  const [modalLoading, setModalLoading] = useState(false)

  const fileList = Array.isArray(files) ? files : Array.isArray(files?.files) ? files.files : []
  const activeFile = fileList.find((f: any) => f.active)

  const handleUploadSuccess = (file: any) => {
    setSuccess(`${file.original_name} enviado com sucesso!`)
    setTimeout(() => {
      setSuccess(null)
      if (mutateFiles) mutateFiles()
      else window.location.reload()
    }, 2000)
  }

  const handleUploadError = (error: string) => {
    setError(error)
    setTimeout(() => setError(null), 5000)
  }

  const handleToggleFileStatus = async (fileId: string, currentActive: boolean) => {
    if (!currentActive) {
      setShowDeactivateConfirm(fileId)
      return
    }

    setModalLoading(true)
    try {
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false }),
      })

      if (!response.ok) {
        throw new Error('Erro ao desativar arquivo')
      }

      setSuccess('Arquivo desativado')
      if (mutateFiles) await mutateFiles()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao desativar')
    } finally {
      setModalLoading(false)
    }
  }

  const handleConfirmDeactivate = async () => {
    if (!showDeactivateConfirm) return
    setModalLoading(true)
    try {
      const response = await fetch(`/api/files/${showDeactivateConfirm}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false }),
      })

      if (!response.ok) {
        throw new Error('Erro ao desativar arquivo')
      }

      setSuccess('Arquivo desativado. Os links vinculados não permitirão mais downloads.')
      setShowDeactivateConfirm(null)
      if (mutateFiles) await mutateFiles()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao desativar')
    } finally {
      setModalLoading(false)
    }
  }

  const handleDeleteFile = async () => {
    if (!showDeleteConfirm) return
    setModalLoading(true)
    try {
      const response = await fetch(`/api/files/${showDeleteConfirm}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok) {
        if (response.status === 409) {
          throw new Error(`${result.error}. Este arquivo está vinculado a ${result.linkedCount} destinatário(s).`)
        }
        throw new Error(result.error || 'Erro ao excluir arquivo')
      }

      setSuccess('Arquivo excluído com sucesso')
      setShowDeleteConfirm(null)
      if (mutateFiles) await mutateFiles()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir')
    } finally {
      setModalLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-start justify-between">
          <p className="text-sm text-destructive">{error}</p>
          <button onClick={() => setError(null)} className="text-destructive hover:text-destructive/80">
            ✕
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
          <p className="text-sm text-green-500">{success}</p>
        </div>
      )}

      {activeFile && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <p className="text-xs text-blue-500 font-medium mb-1">ARQUIVO ATIVO</p>
          <p className="text-sm font-medium text-foreground">{activeFile.original_name}</p>
          <p className="text-xs text-muted-foreground mt-1">{formatFileSize(activeFile.size)}</p>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg p-6">
        <UploadFile onSuccess={handleUploadSuccess} onError={handleUploadError} />
      </div>

      {fileList.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-6 text-center">
          <p className="text-muted-foreground">Nenhum arquivo cadastrado.</p>
        </div>
      ) : (
        fileList.map((file) => (
          <div key={file.id} className={`rounded-lg p-4 border ${file.active ? 'bg-primary/10 border-primary/30' : 'bg-card border-border'}`}>
            <div className="flex justify-between items-start gap-2 mb-3">
              <div className="flex-1">
                <p className="font-medium text-foreground">{file.original_name}</p>
                <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
                <p className="text-xs text-muted-foreground">{file.mime_type}</p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => handleToggleFileStatus(file.id, file.active)}
                  title={file.active ? 'Desativar arquivo' : 'Ativar arquivo'}
                  disabled={modalLoading}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition disabled:opacity-50"
                >
                  {file.active ? (
                    <ToggleRight className="h-4 w-4" />
                  ) : (
                    <ToggleLeft className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(file.id)}
                  title="Excluir arquivo"
                  disabled={modalLoading}
                  className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-secondary rounded transition disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className={`text-xs font-medium px-2 py-1 rounded-full w-fit ${file.active ? 'bg-primary/20 text-primary' : 'bg-red-500/10 text-red-600'}`}>
              {file.active ? 'Ativo' : 'Inativo'}
            </div>
          </div>
        ))
      )}

      <DeleteConfirmationModal
        isOpen={showDeactivateConfirm !== null}
        title="Desativar Arquivo"
        message="Os links vinculados a este arquivo deixarão de permitir downloads. Você ainda poderá ativá-lo novamente depois. Deseja continuar?"
        confirmText="Desativar"
        cancelText="Cancelar"
        isDangerous={false}
        isLoading={modalLoading}
        onConfirm={handleConfirmDeactivate}
        onCancel={() => setShowDeactivateConfirm(null)}
      />

      <DeleteConfirmationModal
        isOpen={showDeleteConfirm !== null}
        title="Excluir Arquivo"
        message={
          fileList.find((f: any) => f.id === showDeleteConfirm)?.linkedCount > 0
            ? `Este arquivo está vinculado a destinatários. Para excluí-lo, primeiro altere ou exclua esses destinatários.`
            : 'Tem certeza que deseja excluir este arquivo? O arquivo será removido do armazenamento.'
        }
        confirmText="Excluir"
        cancelText="Cancelar"
        isDangerous={true}
        isLoading={modalLoading}
        onConfirm={handleDeleteFile}
        onCancel={() => setShowDeleteConfirm(null)}
      />
    </div>
  )
}

function AnalyticsTab({ stats }: { stats: any }) {
  if (!stats) return <p className="text-muted-foreground">Carregando...</p>

  return (
    <div className="space-y-6">
      <div className="text-sm text-muted-foreground">Veja os gráficos na aba "Visão Geral"</div>
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

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(date)
}
