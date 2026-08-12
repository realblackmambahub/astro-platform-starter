import { createClient } from '@/lib/supabase/client'

export type FinanceTable = 'categories' | 'accounts' | 'budgets' | 'goals' | 'bills'

async function scoped(table: FinanceTable) {
  const supabase = createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('Sessão expirada. Entre novamente para continuar.')
  return { supabase, userId: data.user.id, query: supabase.from(table).select('*').eq('user_id', data.user.id).order('created_at', { ascending: false }) }
}

export async function listFinance(table: FinanceTable) {
  const { query } = await scoped(table)
  const { data, error } = await query
  if (error) throw new Error('Não foi possível carregar os dados financeiros.')
  return data ?? []
}

export async function createFinance(table: FinanceTable, input: Record<string, unknown>) {
  const { supabase, userId } = await scoped(table)
  const { data, error } = await supabase.from(table).insert({ ...input, user_id: userId }).select().single()
  if (error) throw new Error('Não foi possível criar este registro.')
  return data
}

export async function updateFinance(table: FinanceTable, id: string, input: Record<string, unknown>) {
  const { supabase, userId } = await scoped(table)
  const { data, error } = await supabase.from(table).update({ ...input, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId).select().single()
  if (error) throw new Error('Não foi possível salvar este registro.')
  return data
}

export async function deleteFinance(table: FinanceTable, id: string) {
  const { supabase, userId } = await scoped(table)
  const { error } = await supabase.from(table).delete().eq('id', id).eq('user_id', userId)
  if (error) throw new Error('Não foi possível excluir este registro.')
}
