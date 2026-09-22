'use client'

import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, XAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { formatBRL } from '@/lib/mock-data'

const trendConfig: ChartConfig = {
  receitas: { label: 'Receitas', color: 'var(--chart-2)' },
  despesas: { label: 'Despesas', color: 'var(--chart-4)' },
}

export function TrendChart({ data }: { data: Array<{ month: string; receitas: number; despesas: number }> }) {
  if (!data.length) {
    return (
      <div className="flex h-[260px] items-center justify-center text-xs text-muted-foreground">
        Sem movimentações suficientes para traçar a tendência.
      </div>
    )
  }
  return (
    <ChartContainer config={trendConfig} className="aspect-auto h-[260px] w-full">
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="kevo-fill-receitas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-receitas)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--color-receitas)" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="kevo-fill-despesas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-despesas)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--color-despesas)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatBRL(Number(value))} />} />
        <Area dataKey="receitas" type="monotone" fill="url(#kevo-fill-receitas)" stroke="var(--color-receitas)" strokeWidth={2} />
        <Area dataKey="despesas" type="monotone" fill="url(#kevo-fill-despesas)" stroke="var(--color-despesas)" strokeWidth={2} />
      </AreaChart>
    </ChartContainer>
  )
}

type CategorySlice = { id: string; name: string; value: number; percent: number; color: string }

export function CategoryDonut({ data }: { data: CategorySlice[] }) {
  if (!data.length) {
    return (
      <div className="flex h-[180px] items-center justify-center text-center text-xs text-muted-foreground">
        Sem despesas categorizadas no período.
      </div>
    )
  }
  const config = data.reduce<ChartConfig>((acc, item) => {
    acc[item.id] = { label: item.name, color: item.color }
    return acc
  }, {})
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <ChartContainer config={config} className="aspect-square h-[170px] w-[170px] shrink-0">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatBRL(Number(value))} hideLabel />} />
          <Pie data={data} dataKey="value" nameKey="id" innerRadius={50} outerRadius={76} strokeWidth={2} stroke="var(--card)">
            {data.map((item) => (
              <Cell key={item.id} fill={item.color} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="flex-1 space-y-2.5">
        {data.slice(0, 5).map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 text-xs">
            <div className="flex min-w-0 items-center gap-2">
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="truncate text-muted-foreground">{item.name}</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-medium tabular-nums">{formatBRL(item.value)}</span>
              <span className="w-9 text-right text-muted-foreground">{item.percent}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
