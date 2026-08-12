'use client'

import useSWR from 'swr'
import { listTransactions, type TransactionRecord } from '@/services/transactions-repository'

export function useTransactions(options?: { search?: string; type?: string }) {
  const key = ['transactions', options?.search ?? '', options?.type ?? 'all'] as const
  const { data, error, isLoading, mutate } = useSWR<TransactionRecord[]>(key, () => listTransactions(options), { revalidateOnFocus: false })
  return { data: data ?? [], loading: isLoading, error: error ? (error instanceof Error ? error.message : 'Não foi possível carregar os dados.') : null, refresh: mutate }
}
