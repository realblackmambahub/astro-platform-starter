import { createClient } from '@/lib/supabase/client'
import type { TransactionRecord } from './transactions-repository'

export type FinancialSnapshot = {
  transactions: TransactionRecord[]
  allTransactions: TransactionRecord[]
  accounts: Array<Record<string, unknown>>
  budgets: Array<Record<string, unknown>>
  goals: Array<Record<string, unknown>>
  bills: Array<Record<string, unknown>>
  categories: Array<Record<string, unknown>>
}

const tables = ['transactions', 'accounts', 'budgets', 'goals', 'bills', 'categories'] as const

export async function getFinancialSnapshot(period = '6M'): Promise<FinancialSnapshot> {
  const supabase = createClient()
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) throw new Error('AUTH_REQUIRED')
  const months = period === '1A' ? 12 : period === '6M' ? 6 : period === '3M' ? 3 : period === '30D' ? 1 : 1
  const from = new Date()
  from.setMonth(from.getMonth() - months)
  const results = await Promise.all(tables.map((table) => {
    const query = supabase.from(table).select('*').eq('user_id', auth.user.id).order(table === 'transactions' ? 'transaction_date' : 'created_at', { ascending: false }).limit(table === 'transactions' ? 500 : 100)
    return table === 'transactions' ? query.gte('transaction_date', from.toISOString().slice(0, 10)) : query
  }))
  const allTransactionsResult = await supabase.from('transactions').select('*').eq('user_id', auth.user.id).order('transaction_date', { ascending: false }).limit(5000)
  const failed = results.find((result) => result.error) ?? (allTransactionsResult.error ? allTransactionsResult : null)
  if (failed?.error) throw new Error('Não foi possível consolidar os dados financeiros.')
  return {
    transactions: (results[0].data ?? []) as TransactionRecord[],
    allTransactions: (allTransactionsResult.data ?? []) as TransactionRecord[],
    accounts: (results[1].data ?? []) as Array<Record<string, unknown>>,
    budgets: (results[2].data ?? []) as Array<Record<string, unknown>>,
    goals: (results[3].data ?? []) as Array<Record<string, unknown>>,
    bills: (results[4].data ?? []) as Array<Record<string, unknown>>,
    categories: (results[5].data ?? []) as Array<Record<string, unknown>>,
  }
}

function toCents(value: unknown) {
  const amount = Number(value ?? 0)
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0
}

function fromCents(value: number) {
  return value / 100
}

export function calculateCurrentBalance(snapshot: FinancialSnapshot) {
  const baseBalance = snapshot.accounts.reduce((sum, account) => sum + toCents(account.balance), 0)
  const transactionNet = snapshot.allTransactions.reduce((sum, transaction) => {
    const cents = toCents(transaction.amount)
    return sum + (transaction.type === 'income' ? cents : -Math.abs(cents))
  }, 0)
  return fromCents(baseBalance + transactionNet)
}

export function summarizeFinancials(snapshot: FinancialSnapshot) {
  const incomeCents = snapshot.transactions.filter((row) => row.type === 'income').reduce((sum, row) => sum + toCents(row.amount), 0)
  const expensesCents = snapshot.transactions.filter((row) => row.type === 'expense').reduce((sum, row) => sum + Math.abs(toCents(row.amount)), 0)
  const budget = snapshot.budgets.reduce((sum, row) => sum + Number(row.limit_amount ?? 0), 0)
  const spent = fromCents(expensesCents)
  const nextBill = [...snapshot.bills].filter((row) => row.status !== 'paid').sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))[0]
  const goal = [...snapshot.goals].sort((a, b) => Number(b.current_amount ?? 0) / Math.max(Number(b.target_amount ?? 1), 1) - Number(a.current_amount ?? 0) / Math.max(Number(a.target_amount ?? 1), 1))[0]
  return {
    income: fromCents(incomeCents),
    expenses: fromCents(expensesCents),
    result: fromCents(incomeCents - expensesCents),
    currentBalance: calculateCurrentBalance(snapshot),
    budget,
    spent,
    nextBill,
    goal,
  }
}

const MONTH_LABELS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export function buildMonthlySeries(snapshot: FinancialSnapshot) {
  const byMonth = new Map<string, { income: number; expense: number }>()
  for (const row of snapshot.transactions) {
    const key = String(row.transaction_date).slice(0, 7)
    if (key.length !== 7) continue
    const entry = byMonth.get(key) ?? { income: 0, expense: 0 }
    const cents = toCents(row.amount)
    if (row.type === 'income') entry.income += cents
    else entry.expense += Math.abs(cents)
    byMonth.set(key, entry)
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => {
      const monthIndex = Number(key.slice(5, 7)) - 1
      return {
        key,
        month: MONTH_LABELS[monthIndex] ?? key,
        receitas: fromCents(value.income),
        despesas: fromCents(value.expense),
      }
    })
}

const CATEGORY_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

export function buildCategoryBreakdown(snapshot: FinancialSnapshot) {
  const nameById = new Map(snapshot.categories.map((row) => [String(row.id), String(row.name ?? 'Categoria')]))
  const totals = new Map<string, number>()
  for (const row of snapshot.transactions) {
    if (row.type !== 'expense') continue
    const key = row.category_id ? String(row.category_id) : 'sem-categoria'
    totals.set(key, (totals.get(key) ?? 0) + Math.abs(toCents(row.amount)))
  }
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1])
  const totalCents = sorted.reduce((sum, [, value]) => sum + value, 0)
  return sorted.map(([id, cents], index) => ({
    id,
    name: id === 'sem-categoria' ? 'Sem categoria' : nameById.get(id) ?? 'Categoria',
    value: fromCents(cents),
    percent: totalCents ? Math.round((cents / totalCents) * 100) : 0,
    color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
  }))
}
