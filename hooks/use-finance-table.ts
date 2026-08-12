'use client'

import useSWR, { useSWRConfig } from 'swr'
import { createFinance, deleteFinance, listFinance, updateFinance, type FinanceTable } from '@/services/finance-repository'

export function useFinanceTable(table: FinanceTable) {
  const { data, error, isLoading, mutate } = useSWR(`finance:${table}`, () => listFinance(table))
  const { mutate: mutateAll } = useSWRConfig()
  const invalidateDerived = async () => {
    await Promise.all([
      mutateAll(`finance:${table}`),
      mutateAll((key) => typeof key === 'string' && (key.startsWith('financial-snapshot') || key.startsWith('financial-summary'))),
      mutateAll('kevo-profile'),
    ])
  }
  return {
    data: data ?? [],
    loading: isLoading,
    error: error instanceof Error ? error.message : error ? 'Não foi possível carregar.' : null,
    refresh: () => mutate(),
    create: async (input: Record<string, unknown>) => { const result = await createFinance(table, input); await mutate(); await invalidateDerived(); return result },
    update: async (id: string, input: Record<string, unknown>) => { const result = await updateFinance(table, id, input); await mutate(); await invalidateDerived(); return result },
    remove: async (id: string) => { await deleteFinance(table, id); await mutate(); await invalidateDerived() },
  }
}
