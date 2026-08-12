'use client'

import useSWR from 'swr'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getFinancialSnapshot, summarizeFinancials } from '@/services/financial-aggregator'

export function useFinancialSnapshot(period: string) {
  const router = useRouter()
  const result = useSWR(['financial-snapshot', period], () => getFinancialSnapshot(period), { revalidateOnFocus: false })
  useEffect(() => {
    if (result.error instanceof Error && result.error.message === 'AUTH_REQUIRED') router.replace('/auth/login')
  }, [result.error, router])
  return { ...result, summary: result.data ? summarizeFinancials(result.data) : null, loading: !result.data && !result.error }
}
