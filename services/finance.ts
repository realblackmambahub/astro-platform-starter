import { budgets, categories, goals, monthly, sleep, transactions, type ServiceResult, type Transaction } from '@/lib/mock-data'

export async function getDashboardData(): Promise<ServiceResult<{ transactions: Transaction[]; monthly: typeof monthly; categories: typeof categories; budgets: typeof budgets; goals: typeof goals }>> {
  await sleep()
  return { data: { transactions, monthly, categories, budgets, goals }, status: 'success' }
}
export async function getTransactions(): Promise<ServiceResult<Transaction[]>> { await sleep(); return { data: transactions, status: 'success' } }
export async function createTransaction(input: Partial<Transaction>): Promise<ServiceResult<Transaction>> { await sleep(); return { data: { ...transactions[0], ...input, id: `local-${Date.now()}` } as Transaction, status: 'success' } }
