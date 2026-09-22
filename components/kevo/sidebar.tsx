'use client'

import useSWR from 'swr'
import {
  Activity,
  BarChart3,
  CalendarDays,
  Cloud,
  Download,
  FolderKanban,
  Gem,
  Landmark,
  LayoutDashboard,
  Link2,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Settings2,
  Sparkles,
  Table2,
  Tags,
  Target,
  Upload,
  Wallet,
  X,
} from 'lucide-react'
import { navGroups } from '@/lib/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const icons: Record<string, typeof LayoutDashboard> = {
  layout: LayoutDashboard,
  movimentações: Receipt,
  categorias: Tags,
  orçamentos: Wallet,
  metas: Target,
  contas: Landmark,
  relatórios: BarChart3,
  agenda: CalendarDays,
  projetos: FolderKanban,
  drive: Cloud,
  sparkles: Sparkles,
  timeline: Activity,
  planilhas: Table2,
  importar: Upload,
  exportar: Download,
  plano: Gem,
  integrações: Link2,
  configurações: Settings2,
}

function useProfile() {
  return useSWR('kevo-profile', async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null
    const result = await supabase.from('profiles').select('first_name,last_name').eq('id', user.id).maybeSingle()
    return { email: user.email ?? '', firstName: result.data?.first_name ?? '', lastName: result.data?.last_name ?? '' }
  })
}

export function KevoSidebar({
  active,
  onSelect,
  mobileOpen,
  onCloseMobile,
  collapsed,
  onToggleCollapsed,
}: {
  active: string
  onSelect: (value: string) => void
  mobileOpen: boolean
  onCloseMobile: () => void
  collapsed: boolean
  onToggleCollapsed: () => void
}) {
  const { data: profile } = useProfile()
  const router = useRouter()
  const displayName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || profile?.email || ''
  const initial = displayName ? displayName.charAt(0).toUpperCase() : '·'

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/auth/login')
  }

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}
      <aside
        data-collapsed={collapsed}
        className={`group/sidebar fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-sidebar-border bg-sidebar transition-[width,transform] duration-200 lg:translate-x-0 ${
          collapsed ? 'lg:w-[76px]' : 'lg:w-[248px]'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex h-[68px] shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4 lg:group-data-[collapsed=true]/sidebar:justify-center lg:group-data-[collapsed=true]/sidebar:px-0">
          <div className="flex h-8 w-[108px] items-center lg:group-data-[collapsed=true]/sidebar:hidden">
            <img
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/ChatGPT%20Image%2022%20de%20set.%20de%202026%2C%2016_36_02-mHql1sMtp2lHgx3aCUKVe1uR3Xipyv.png"
              alt="KEVO"
              className="h-full w-full object-contain object-left"
            />
          </div>
          <button
            className="ml-auto rounded-lg p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground lg:hidden"
            onClick={onCloseMobile}
            aria-label="Fechar menu"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4" aria-label="Navegação principal">
          {navGroups.map((group) => (
            <div key={group.label || 'principal'}>
              {group.label && (
                <div className="mb-2 px-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60 lg:group-data-[collapsed=true]/sidebar:hidden">
                  {group.label}
                </div>
              )}
              <div className="flex flex-col gap-1">
                {group.items.map((item) => {
                  const Icon = icons[item.icon] ?? Receipt
                  const isActive = active === item.href
                  return (
                    <button
                      key={item.href}
                      title={collapsed ? item.label : undefined}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => {
                        onSelect(item.href)
                        onCloseMobile()
                      }}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left text-xs transition-colors lg:group-data-[collapsed=true]/sidebar:justify-center lg:group-data-[collapsed=true]/sidebar:px-0 ${
                        isActive
                          ? 'kevo-nav-active font-medium text-primary'
                          : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                      }`}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="truncate lg:group-data-[collapsed=true]/sidebar:hidden">{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-sidebar-border p-3">
          {profile !== undefined && (
            <div className="mb-1 flex items-center gap-2.5 rounded-lg px-2 py-2 lg:group-data-[collapsed=true]/sidebar:justify-center lg:group-data-[collapsed=true]/sidebar:px-0">
              <div className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-chart-2 text-xs font-semibold text-primary-foreground">
                {initial}
              </div>
              <div className="min-w-0 lg:group-data-[collapsed=true]/sidebar:hidden">
                <div className="truncate text-xs font-medium text-sidebar-foreground">{displayName || 'Conta'}</div>
                <div className="truncate text-[10px] text-muted-foreground">{profile?.email}</div>
              </div>
              <button
                onClick={signOut}
                aria-label="Sair da conta"
                title="Sair"
                className="ml-auto shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-destructive lg:group-data-[collapsed=true]/sidebar:hidden"
              >
                <LogOut className="size-3.5" />
              </button>
            </div>
          )}
          <button
            onClick={onToggleCollapsed}
            className="hidden w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground lg:flex lg:group-data-[collapsed=true]/sidebar:justify-center lg:group-data-[collapsed=true]/sidebar:px-0"
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <PanelLeftOpen className="size-4 shrink-0" /> : <PanelLeftClose className="size-4 shrink-0" />}
            <span className="lg:group-data-[collapsed=true]/sidebar:hidden">Recolher menu</span>
          </button>
        </div>
      </aside>
    </>
  )
}
