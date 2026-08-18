import 'server-only'

import type { FinanceIntent } from './finance-intent'

const PENDING_TTL_MS = 10 * 60 * 1000

export type PendingActionType = 'pending_edit' | 'pending_delete'

type AdminClient = {
  from: (table: string) => any
}

type PendingAction = {
  actionType: PendingActionType
  transactionId: string
  messageId: string
  createdAt: string
  expiresAt: string
}

function asMetadata(value: unknown) {
  if (!value || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

function isTransactionId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)
}

export function parseActionPayload(text: string) {
  const match = text.trim().match(/^(edit_transaction|delete_transaction|confirm_delete|cancel_delete|confirm_delete_transaction):([0-9a-f-]{36})$/i)
  if (!match) return null
  return { action: match[1].toLowerCase(), transactionId: match[2] }
}

export function isConfirmationText(text: string) {
  return /^(confirmar|confirmar exclusão|sim,? excluir|pode excluir)$/i.test(text.trim())
}

export function isCancellationText(text: string) {
  return /^(cancelar|não|nao|deixa|não excluir|nao excluir)$/i.test(text.trim())
}

export async function createPendingAction(
  admin: AdminClient | null,
  messageId: string,
  userId: string,
  actionType: PendingActionType,
  transactionId: string,
) {
  if (!admin || !isTransactionId(transactionId)) return false
  const now = new Date()
  const metadata = {
    action_type: actionType,
    transaction_id: transactionId,
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + PENDING_TTL_MS).toISOString(),
    consumed_at: null,
  }
  const { error } = await admin.from('whatsapp_messages').update({
    status: actionType,
    user_id: userId,
    metadata,
  }).eq('wa_message_id', messageId).eq('direction', 'inbound')
  if (!error) console.info(`[WA ACTION] pending_action=${actionType}`)
  return !error
}

export async function getPendingAction(admin: AdminClient | null, fromPhone: string, userId: string) {
  console.info('[WA ACTION] pending_lookup_started=true')
  if (!admin) {
    console.info('[WA ACTION] pending_lookup_found=false')
    return null
  }
  const { data } = await admin.from('whatsapp_messages')
    .select('wa_message_id, metadata, created_at, status')
    .eq('from_phone', fromPhone)
    .eq('user_id', userId)
    .in('status', ['pending_edit', 'pending_delete'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data || !['pending_edit', 'pending_delete'].includes(data.status)) {
    console.info('[WA ACTION] pending_lookup_found=false')
    return null
  }
  console.info('[WA ACTION] pending_lookup_found=true')
  console.info(`[WA ACTION] pending_type=${data.status}`)
  const metadata = asMetadata(data.metadata)
  const transactionId = metadata?.transaction_id
  const expiresAt = metadata?.expires_at
  if (!isTransactionId(transactionId) || typeof expiresAt !== 'string') {
    console.info('[WA ACTION] pending_owned=false')
    return null
  }
  const expired = Date.now() >= Date.parse(expiresAt)
  console.info(`[WA ACTION] pending_expired=${String(expired)}`)
  if (expired) {
    await consumePendingAction(admin, data.wa_message_id, 'expired')
    return null
  }
  console.info('[WA ACTION] pending_owned=true')
  return {
    actionType: data.status as PendingActionType,
    transactionId,
    messageId: data.wa_message_id,
    createdAt: typeof metadata?.created_at === 'string' ? metadata.created_at : String(data.created_at),
    expiresAt,
  } satisfies PendingAction
}

export async function consumePendingAction(admin: AdminClient | null, messageId: string, reason: 'consumed' | 'expired') {
  if (!admin) return false
  const { data } = await admin.from('whatsapp_messages').select('metadata').eq('wa_message_id', messageId).eq('direction', 'inbound').maybeSingle()
  const metadata = asMetadata(data?.metadata) ?? {}
  const nextMetadata = { ...metadata, consumed_at: new Date().toISOString(), consumed_reason: reason }
  const { error } = await admin.from('whatsapp_messages').update({ status: 'processed', metadata: nextMetadata, processed_at: new Date().toISOString() }).eq('wa_message_id', messageId).eq('direction', 'inbound')
  console.info(`[WA ACTION] pending_consumed=${String(!error)}`)
  return !error
}

export function parseEditFields(text: string): Partial<Pick<FinanceIntent, 'description' | 'amount' | 'transactionDate'>> & { categoryName?: string } | null {
  const value = text.trim()
  const amountMatch = value.match(/(?:valor\s*(?:para|de)?\s*|r\$?\s*)(\d+(?:[.,]\d{1,2})?)\s*(?:reais|real|r\$)?/i) ?? value.match(/\b(\d+(?:[.,]\d{1,2})?)\s*(?:reais|real|r\$)\b/i)
  const dateMatch = value.match(/(?:dia|data)\s+(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/i)
  const relativeDate = /\bontem\b/i.test(value) ? new Date(Date.now() - 86400000) : null
  const descriptionMatch = value.match(/(?:descrição|descricao|nome)\s*(?:para|:|=|-)?\s*([\p{L}][\p{L}\d\s-]{1,80})/iu)
  const categoryMatch = value.match(/categoria\s*(?:para|:|=|-)?\s*([\p{L}][\p{L}\s-]{1,60})/iu)
  const next: Partial<Pick<FinanceIntent, 'description' | 'amount' | 'transactionDate'>> & { categoryName?: string } = {}
  if (amountMatch) {
    const amount = Number(amountMatch[1].replace(',', '.'))
    if (Number.isFinite(amount) && amount > 0 && amount <= 100000000) next.amount = Number(amount.toFixed(2))
  }
  if (descriptionMatch) next.description = descriptionMatch[1].trim().replace(/\s+/g, ' ')
  if (categoryMatch) next.categoryName = categoryMatch[1].trim().replace(/\s+/g, ' ')
  if (relativeDate) next.transactionDate = relativeDate.toISOString().slice(0, 10)
  if (dateMatch) {
    const year = dateMatch[3] ? (dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3]) : String(new Date().getUTCFullYear())
    const iso = `${year}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`
    const date = new Date(`${iso}T00:00:00Z`)
    if (!Number.isNaN(date.valueOf()) && date.getUTCMonth() + 1 === Number(dateMatch[2]) && date.getUTCDate() === Number(dateMatch[1])) next.transactionDate = iso
  }
  console.info(`[WA ACTION] edit_fields_detected=${String(Object.keys(next).length > 0)}`)
  return Object.keys(next).length ? next : null
}

export function buildPendingEditReply() {
  return 'Envie a alteração que deseja fazer, por exemplo: “mude o valor para 60 reais”, “descrição: mercado” ou “data 12/08”. Para sair, responda “cancelar”.'
}

export function buildPendingDeleteReply() {
  return 'A solicitação de exclusão está pronta. Confirme pelo botão ou responda “confirmar exclusão”.'
}

export { PENDING_TTL_MS }
