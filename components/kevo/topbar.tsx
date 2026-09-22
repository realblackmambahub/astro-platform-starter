'use client'

import { useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { ChevronRight, Menu, Search } from 'lucide-react'
import { navGroups } from '@/lib/navigation'
import { createClient } from '@/lib/supabase/client'

function useAccountInitial() {
  const { data } = useSWR('kevo-profile', async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null
    const result = await supabase.from('profiles').select('first_name').eq('id', user.id).maybeSingle()
    return { email: user.email ?? '', firstName: result.data?.first_name ?? '' }
  })
  const label = data?.firstName || data?.email || ''
  return label ? label.charAt(0).toUpperCase() : ''
}

export function KevoTopbar({
  active,
  onSelect,
  onOpenMobile,
}: {
  active: string
  onSelect: (value: string) => void
  onOpenMobile: () => void
}) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const initial = useAccountInitial()

  const currentLabel = useMemo(() => {
    for (const group of navGroups) {
      const match = group.items.find((item) => item.href === active)
      if (match) return match.label
    }
    return active === 'overview' ? 'Visão Geral' : active
  }, [active])

  const results = useMemo(() => {
    if (!query.trim()) return []
    const term = query.trim().toLowerCase()
    return navGroups.flatMap((group) => group.items).filter((item) => item.label.toLowerCase().includes(term)).slice(0, 6)
  }, [query])

  const selectResult = (href: string) => {
    onSelect(href)
    setQuery('')
    setFocused(false)
    inputRef.current?.blur()
  }

  return (
    <header className="sticky top-0 z-30 flex h-[68px] items-center gap-3 border-b border-border/70 bg-background/90 px-4 backdrop-blur-xl sm:px-7">
      <button
        className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
        onClick={onOpenMobile}
        aria-label="Abrir menu"
      >
        <Menu className="size-5" />
      </button>

      <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
        <span>Workspace</span>
        <ChevronRight className="size-3" />
        <span className="font-medium text-foreground">{currentLabel}</span>
      </div>

      <div className="relative ml-auto w-full max-w-[280px] sm:ml-4">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          placeholder="Buscar em módulos…"
          aria-label="Buscar módulos"
          className="w-full rounded-lg border border-border bg-card/60 py-2 pl-8 pr-3 text-xs outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
        />
        {focused && results.length > 0 && (
          <div className="absolute right-0 top-[calc(100%+6px)] z-40 w-full min-w-[220px] overflow-hidden rounded-lg border border-border bg-popover shadow-xl">
            {results.map((item) => (
              <button
                key={item.href}
                onClick={() => selectResult(item.href)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-popover-foreground hover:bg-accent"
              >
                {item.label}
                <ChevronRight className="size-3 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-chart-2 text-xs font-semibold text-primary-foreground"
        aria-hidden="true"
      >
        {initial || '·'}
      </div>
    </header>
  )
}
