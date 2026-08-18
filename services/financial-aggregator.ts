import { createClient } from '@/lib/supabase/client'
import type { TransactionRecord } from './transactions-repository'

export type FinancialSnapshot = {
  transactions: TransactionRecord[]
  accounts: Array<Record<string, unknown>>
  budgets: Array<Record<string, unknown>>
  goals: Array<Record<string, unknown>>
  bills: Array<Record<string, unknown>>
}

const tables = ['transactions', 'accounts', 'budgets', 'goals', 'bills'] as const

export async function getFinancialSnapshot(period = '6M'): Promise<FinancialSnapshot> {
  const supabase = createClient()
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) throw new Error('AUTH_REQUIRED')
  const from = new Date()
  if (period === '7D') from.setDate(from.getDate() - 7)
  else if (period === '30D') from.setDate(from.getDate() - 30)
  else if (period === '3M') from.setMonth(from.getMonth() - 3)
  else if (period === '6M') from.setMonth(from.getMonth() - 6)
  else from.setFullYear(from.getFullYear() - 1)
  const results = await Promise.all(tables.map((table) => {
    const query = supabase.from(table).select('*').eq('user_id', auth.user.id).order(table === 'transactions' ? 'transaction_date' : 'created_at', { ascending: false }).limit(table === 'transactions' ? 500 : 100)
    return table === 'transactions' ? query.gte('transaction_date', from.toISOString().slice(0, 10)) : query
  }))
  const failed = results.find((result) => result.error)
  if (failed?.error) throw new Error('Não foi possível consolidar os dados financeiros.')
  return {
    transactions: (results[0].data ?? []) as TransactionRecord[],
    accounts: (results[1].data ?? []) as Array<Record<string, unknown>>,
    budgets: (results[2].data ?? []) as Array<Record<string, unknown>>,
    goals: (results[3].data ?? []) as Array<Record<string, unknown>>,
    bills: (results[4].data ?? []) as Array<Record<string, unknown>>,
  }
}

export function summarizeFinancials(snapshot: FinancialSnapshot) {
  const income = snapshot.transactions.filter((row) => row.type === 'income').reduce((sum, row) => sum + Number(row.amount), 0)
  const expenses = snapshot.transactions.filter((row) => row.type === 'expense').reduce((sum, row) => sum + Math.abs(Number(row.amount)), 0)
  const budget = snapshot.budgets.reduce((sum, row) => sum + Number(row.limit_amount ?? 0), 0)
  const spent = expenses
  const nextBill = [...snapshot.bills].filter((row) => row.status !== 'paid').sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))[0]
  const goal = [...snapshot.goals].sort((a, b) => Number(b.current_amount ?? 0) / Math.max(Number(b.target_amount ?? 1), 1) - Number(a.current_amount ?? 0) / Math.max(Number(a.target_amount ?? 1), 1))[0]
  return { income, expenses, result: income - expenses, budget, spent, nextBill, goal }
}
