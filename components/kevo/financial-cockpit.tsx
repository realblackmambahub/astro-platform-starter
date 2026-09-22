'use client'

import { useMemo, useState } from 'react'
import { CircleDollarSign, TrendingDown, TrendingUp, Wallet, Zap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatBRL } from '@/lib/mock-data'
import { ModuleWorkspace } from './module-workspaces'
import { KevoModule } from './kevo-modules'
import { KevoSidebar } from './sidebar'
import { KevoTopbar } from './topbar'
import { TrendChart, CategoryDonut } from './overview-charts'
import { useFinancialSnapshot } from '@/hooks/use-financial-snapshot'
import { buildCategoryBreakdown, buildMonthlySeries } from '@/services/financial-aggregator'
import { TransactionDialog } from './transaction-dialog'

const periods = ['30D', '3M', '6M', '1A']
const secondaryModules = ['projetos', 'drive', 'insights', 'plano', 'integrações', 'configurações', 'planilhas']

function Metric({
  label,
  value,
  caption,
  Icon,
  tone = 'neutral',
  featured = false,
}: {
  label: string
  value: string
  caption: string
  Icon: typeof Wallet
  tone?: 'neutral' | 'positive' | 'negative'
  featured?: boolean
}) {
  const color = tone === 'positive' ? 'text-chart-2' : tone === 'negative' ? 'text-destructive' : 'text-primary'
  return (
    <Card className={`group relative overflow-hidden border-border/70 bg-card/60 shadow-none transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card ${featured ? 'border-primary/25 bg-primary/[0.06] sm:col-span-2 xl:col-span-1' : ''}`}>
      {featured && <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-primary via-chart-2 to-transparent" />}
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {label}
          <span className={`grid size-7 place-items-center rounded-md bg-background/60 ${color}`}><Icon className="size-3.5" /></span>
        </div>
        <div className="mt-4 flex items-end justify-between gap-2">
          <div className={`text-xl font-semibold tracking-[-0.04em] ${featured ? 'text-2xl' : ''}`}>{value}</div>
          {featured && <span className="mb-1 text-[10px] text-chart-2">disponível</span>}
        </div>
        <div className="mt-1.5 text-[10px] text-muted-foreground">{caption}</div>
      </CardContent>
    </Card>
  )
}

function RecentTransactions({ data }: { data: Array<{ id: string; description: string; amount: number; type: 'income' | 'expense'; transaction_date: string; source: string }> }) {
  if (data.length === 0) {
    return <p className="py-12 text-center text-xs text-muted-foreground">Nenhuma movimentação neste período.</p>
  }
  return (
    <div className="space-y-1">
      {data.slice(0, 8).map((row) => (
        <div key={row.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-xs transition-colors hover:bg-accent/50">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`grid size-8 shrink-0 place-items-center rounded-full ${row.type === 'income' ? 'bg-chart-2/15 text-chart-2' : 'bg-destructive/10 text-destructive'}`}>
              {row.type === 'income' ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
            </div>
            <div className="min-w-0">
              <div className="truncate font-medium text-foreground">{row.description}</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                {new Date(row.transaction_date).toLocaleDateString('pt-BR')} · {row.source}
              </div>
            </div>
          </div>
          <span className={`shrink-0 font-medium tabular-nums ${row.type === 'income' ? 'text-chart-2' : 'text-foreground'}`}>
            {row.type === 'income' ? '+' : '−'} {formatBRL(row.amount)}
          </span>
        </div>
      ))}
    </div>
  )
}

function Overview() {
  const [period, setPeriod] = useState('6M')
  const [dialogOpen, setDialogOpen] = useState(false)
  const { data, summary, error, loading, refresh } = useFinancialSnapshot(period)

  const trendSeries = useMemo(() => (data ? buildMonthlySeries(data) : []), [data])
  const categorySeries = useMemo(() => (data ? buildCategoryBreakdown(data) : []), [data])

  if (loading) return <main className="p-7 text-sm text-muted-foreground">Carregando seu cockpit financeiro…</main>
  if (error) return <main className="p-7 text-sm text-destructive">{error.message}</main>

  const hasData = Boolean(data?.transactions.length || data?.accounts.length || data?.budgets.length || data?.goals.length || data?.bills.length)

  if (!data || !summary || !hasData) {
    return (
      <main className="mx-auto max-w-[1500px] p-4 sm:p-7">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-primary">KEVO / Financial Cockpit</div>
            <h1 className="text-2xl font-semibold">Seu cockpit está pronto.</h1>
            <p className="mt-2 text-sm text-muted-foreground">Adicione sua primeira movimentação, conta, meta ou orçamento para começar.</p>
          </div>
          <Button size="sm" onClick={() => setDialogOpen(true)}>Nova movimentação</Button>
        </div>
        <Card className="border-dashed bg-card/40 shadow-none">
          <CardContent className="flex min-h-[260px] flex-col items-center justify-center gap-3 text-center">
            <Zap className="size-7 text-primary" />
            <div className="text-sm font-medium">Nenhum dado financeiro ainda</div>
            <p className="max-w-md text-xs leading-5 text-muted-foreground">Os indicadores serão calculados a partir dos seus registros reais. Nada demonstrativo é exibido aqui.</p>
          </CardContent>
        </Card>
        <TransactionDialog open={dialogOpen} onOpenChange={setDialogOpen} onSaved={refresh} />
      </main>
    )
  }

  return (
    <main className="kevo-flow mx-auto max-w-[1500px] p-4 sm:p-7">
      <div className="relative z-10 mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-primary"><span className="size-1.5 rounded-full bg-primary shadow-[0_0_10px_var(--primary)]" /> KEVO / Command Center</div>
          <h1 className="text-[clamp(1.6rem,3vw,2.25rem)] font-semibold tracking-[-0.06em]">Visão geral financeira</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">Uma leitura precisa do seu dinheiro, com contexto para decidir o próximo movimento.</p>
        </div>
        <Button size="sm" className="h-9 shadow-[0_8px_25px_-12px_var(--primary)]" onClick={() => setDialogOpen(true)}>Nova movimentação</Button>
      </div>

      <div className="relative z-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric featured label="Saldo atual" value={formatBRL(summary.currentBalance)} caption="Saldo disponível nas contas" Icon={Wallet} />
        <Metric label="Receitas" value={formatBRL(summary.income)} caption={`Período ${period}`} Icon={TrendingUp} tone="positive" />
        <Metric label="Despesas" value={formatBRL(summary.expenses)} caption={`Período ${period}`} Icon={TrendingDown} tone="negative" />
        <Metric
          label="Resultado"
          value={formatBRL(summary.result)}
          caption={summary.result > 0 ? 'Resultado positivo' : summary.result < 0 ? 'Resultado negativo' : 'Resultado neutro'}
          Icon={CircleDollarSign}
          tone={summary.result >= 0 ? 'positive' : 'negative'}
        />
      </div>

      <div className="relative z-10 mt-4 grid gap-3 lg:grid-cols-[1.35fr_0.65fr]">
        <Card className="kevo-insight border-primary/15 bg-primary/[0.045] shadow-none">
          <CardContent className="flex min-h-[92px] items-center gap-4 p-4 sm:p-5">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Zap className="size-4" /></div>
            <div><div className="text-[10px] font-medium uppercase tracking-[0.16em] text-primary">Leitura do período</div><p className="mt-1 text-sm leading-5 text-foreground">{summary.result < 0 ? 'As despesas superaram as receitas neste período.' : summary.result > 0 ? 'O período fechou com resultado positivo.' : 'Ainda não há resultado suficiente para uma leitura.'}</p><p className="mt-1 text-[10px] text-muted-foreground">Baseado apenas nas movimentações persistidas.</p></div>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/50 shadow-none">
          <CardContent className="flex min-h-[92px] items-center justify-between gap-4 p-4 sm:p-5"><div><div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Registros no período</div><div className="mt-2 text-2xl font-semibold tracking-[-0.05em]">{data.transactions.length}</div></div><div className="text-right text-[10px] text-muted-foreground">Movimentações<br />analisadas</div></CardContent>
        </Card>
      </div>

      <div className="relative z-10 mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card className="bg-card/70 shadow-none">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm">Fluxo de caixa</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Receitas x despesas por mês</p>
            </div>
            <div className="flex gap-1">
              {periods.map((item) => (
                <button
                  key={item}
                  onClick={() => setPeriod(item)}
                  className={`rounded px-2 py-1 text-[10px] transition-colors ${period === item ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <TrendChart data={trendSeries} />
          </CardContent>
        </Card>

        <Card className="bg-card/70 shadow-none">
          <CardHeader>
            <CardTitle className="text-sm">Despesas por categoria</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Distribuição no período selecionado</p>
          </CardHeader>
          <CardContent>
            <CategoryDonut data={categorySeries} />
          </CardContent>
        </Card>
      </div>

      <div className="relative z-10 mt-4">
        <Card className="bg-card/70 shadow-none">
          <CardHeader>
            <CardTitle className="text-sm">Movimentações recentes</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{data.transactions.length} registros reais no período</p>
          </CardHeader>
          <CardContent>
            <RecentTransactions data={data.transactions} />
          </CardContent>
        </Card>
      </div>
      <TransactionDialog open={dialogOpen} onOpenChange={setDialogOpen} onSaved={refresh} />
    </main>
  )
}

export function FinancialCockpit() {
  const [active, setActive] = useState('overview')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const content = active === 'overview' ? <Overview /> : secondaryModules.includes(active) ? <KevoModule active={active} /> : <ModuleWorkspace active={active} />

  return (
    <div className="min-h-screen bg-background">
      <KevoSidebar
        active={active}
        onSelect={setActive}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((value) => !value)}
      />
      <div className={collapsed ? 'lg:ml-[76px]' : 'lg:ml-[248px]'}>
        <KevoTopbar active={active} onSelect={setActive} onOpenMobile={() => setMobileOpen(true)} />
        {content}
      </div>
    </div>
  )
}
