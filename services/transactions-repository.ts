import { createClient } from '@/lib/supabase/client'

export type TransactionRecord = {
  id: string
  description: string
  amount: number
  type: 'income' | 'expense'
  transaction_date: string
  source: string
  notes: string | null
  account_id: string | null
  category_id: string | null
}

type TransactionInput = Omit<TransactionRecord, 'id'>

async function sessionUserId() {
  const supabase = createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('Sessão expirada. Entre novamente para continuar.')
  return { supabase, userId: data.user.id }
}

export async function listTransactions(options?: { search?: string; type?: string; limit?: number }) {
  const { supabase, userId } = await sessionUserId()
  let query = supabase.from('transactions').select('*').eq('user_id', userId).order('transaction_date', { ascending: false }).limit(options?.limit ?? 100)
  if (options?.type && options.type !== 'all') query = query.eq('type', options.type)
  if (options?.search?.trim()) query = query.ilike('description', `%${options.search.trim()}%`)
  const { data, error } = await query
  if (error) throw new Error('Não foi possível carregar as movimentações.')
  return (data ?? []) as TransactionRecord[]
}

export async function updateTransaction(id: string, input: Partial<TransactionInput>) {
  const { supabase, userId } = await sessionUserId()
  const { data, error } = await supabase.from('transactions').update({ ...input, user_id: userId, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId).select().single()
  if (error) throw new Error('Não foi possível salvar esta movimentação.')
  return data as TransactionRecord
}

export async function createTransaction(input: TransactionInput) {
  const { supabase, userId } = await sessionUserId()
  const { data, error } = await supabase.from('transactions').insert({ ...input, user_id: userId }).select().single()
  if (error) throw new Error('Não foi possível criar esta movimentação.')
  return data as TransactionRecord
}

export function normalizeDescription(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

export function duplicateKey(row: Pick<TransactionRecord, 'transaction_date' | 'amount' | 'description' | 'account_id'>) {
  return `${row.transaction_date}|${Number(row.amount).toFixed(2)}|${normalizeDescription(row.description)}|${row.account_id ?? 'sem-conta'}`
}

export async function importTransactions(rows: TransactionInput[], filename: string) {
  const { supabase, userId } = await sessionUserId()
  const { data: existing, error: existingError } = await supabase.from('transactions').select('transaction_date,amount,description,account_id').eq('user_id', userId)
  if (existingError) throw new Error('Não foi possível verificar duplicidades.')
  const existingKeys = new Set((existing ?? []).map(duplicateKey))
  const duplicateCount = rows.filter((row) => existingKeys.has(duplicateKey(row))).length
  const { data: importRow, error: importError } = await supabase.from('imports').insert({ user_id: userId, filename, status: 'processing', row_count: rows.length }).select().single()
  if (importError || !importRow) throw new Error('Não foi possível iniciar a importação.')
  let insertedTransactionIds: string[] = []
  try {
    const { error: rowsError } = await supabase.from('import_rows').insert(rows.map((row) => ({ user_id: userId, import_id: importRow.id, raw_data: row })))
    if (rowsError) throw rowsError
    const { data: insertedTransactions, error: transactionsError } = await supabase.from('transactions').insert(rows.map((row) => ({ ...row, user_id: userId, source: row.source || 'Importação' }))).select('id')
    if (transactionsError) throw transactionsError
    insertedTransactionIds = (insertedTransactions ?? []).map((row) => row.id)
    await supabase.from('imports').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', importRow.id).eq('user_id', userId)
    return { imported: rows.length, duplicateCount }
  } catch {
    if (insertedTransactionIds.length) await supabase.from('transactions').delete().in('id', insertedTransactionIds).eq('user_id', userId)
    await supabase.from('import_rows').delete().eq('import_id', importRow.id).eq('user_id', userId)
    await supabase.from('imports').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', importRow.id).eq('user_id', userId)
    throw new Error('A importação falhou e foi revertida.')
  }
}
