'use client'

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
          <div className="flex flex-col leading-none lg:group-data-[collapsed=true]/sidebar:hidden">
            <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
              KEVO<span className="text-primary">.</span>
            </span>
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Financial OS</span>
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
