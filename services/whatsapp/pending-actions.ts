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

function normalizeInput(text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[!?;]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export function isConfirmationText(text: string) {
  const value = normalizeInput(text)
  return /^(confirmar|confirma|sim|sim excluir|sim pode excluir|pode excluir|excluir|exclui|apaga|pode apagar|confirmo)$/.test(value)
}

export function isCancellationText(text: string) {
  const value = normalizeInput(text)
  return /^(cancelar|cancela|cancel|nao|nao excluir|nao exclui|deixa|deixa assim|manter|mantem|sair|nao quero alterar|nao altera|esquece|voltar)$/.test(value)
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
  console.info('[WA ACTION] pending_edit_lookup=true')
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

function parseMoney(value: string) {
  const normalized = value.replace(/\s/g, '').replace(/^r\$/i, '').replace(/reais?$/i, '')
  const brazilian = normalized.includes(',')
    ? normalized.replace(/\./g, '').replace(',', '.')
    : normalized.replace(/,(?=\d{3}(?:\D|$))/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '')
  const amount = Number(brazilian)
  return Number.isFinite(amount) && amount > 0 && amount <= 100000000 ? Number(amount.toFixed(2)) : null
}

function extractMoney(value: string) {
  const money = '(?:r\\$\\s*)?\\d{1,3}(?:[.]\\d{3})*(?:,\\d{1,2})?|(?:r\\$\\s*)?\\d+(?:[.,]\\d{1,2})?'
  const contextual = value.match(new RegExp(`(?:pode\\s+(?:colocar|coloca)|(?:o\\s+)?valor|mude|muda|altere|altera|troque|troca|corrija|corrige|ajuste|ajusta|coloque|coloca|bota|poe|deixa|era|correto|verdade|para|pra|em|:|=)\\s*(?:o\\s+valor\\s*)?(?:e\\s+)?(?:para|pra|em|e|é|era)?\\s*(${money})`, 'i'))
  const standalone = value.match(new RegExp(`^\\s*(${money})\\s*(?:reais?|r\\$)?\\s*$`, 'i'))
  const match = contextual ?? standalone
  return match ? parseMoney(match[1]) : null
}

export function parseEditFields(text: string): Partial<Pick<FinanceIntent, 'description' | 'amount' | 'transactionDate'>> & { categoryName?: string } | null {
  const raw = text.trim()
  const value = normalizeInput(raw)
  const next: Partial<Pick<FinanceIntent, 'description' | 'amount' | 'transactionDate'>> & { categoryName?: string } = {}
  const amount = extractMoney(value)
  if (amount !== null) next.amount = amount

  const categoryMatch = value.match(/(?:categoria|coloca(?:r)?\s+em|isso\s+e|troca(?:r)?\s+para|na verdade\s+e)\s*(?:para|pra|:|=|-)?\s*([\p{L}][\p{L}\s-]{1,60})/iu)
  if (categoryMatch) next.categoryName = categoryMatch[1].trim().replace(/\s+/g, ' ')

  const descriptionMatch = value.match(/(?:descric(?:ao|ao)|nome)\s*(?:para|pra|:|=|-)?\s*([\p{L}][\p{L}\d\s-]{1,80})/iu) ?? value.match(/(?:coloca(?:r)?|na verdade foi)\s+([\p{L}][\p{L}\d\s-]{2,80})\s+(?:na descric(?:ao|ao)|como descric(?:ao|ao))/iu)
  if (descriptionMatch) next.description = descriptionMatch[1].trim().replace(/\s+/g, ' ')

  const dateMatch = value.match(/(?:dia|data)\s*(?:para|pra|:|=|-)?\s*(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/i)
  if (/\bhoje\b/i.test(value)) next.transactionDate = new Date().toISOString().slice(0, 10)
  else if (/\bontem\b/i.test(value)) next.transactionDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  else if (dateMatch) {
    const year = dateMatch[3] ? (dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3]) : String(new Date().getUTCFullYear())
    const iso = `${year}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`
    const date = new Date(`${iso}T00:00:00Z`)
    if (!Number.isNaN(date.valueOf()) && date.getUTCMonth() + 1 === Number(dateMatch[2]) && date.getUTCDate() === Number(dateMatch[1])) next.transactionDate = iso
  }

  console.info(`[WA ACTION] edit_parser_matched=${String(Object.keys(next).length > 0)}`)
  if (Object.keys(next).length) console.info(`[WA ACTION] edit_fields=${Object.keys(next).map((field) => field === 'transactionDate' ? 'date' : field).join('|')}`)
  return Object.keys(next).length ? next : null
}

export function buildPendingEditReply() {
  return 'Envie a alteração que deseja fazer, por exemplo: “mude o valor para 60 reais”, “descrição: mercado” ou “data 12/08”. Para sair, responda “cancelar”.'
}

export function buildPendingDeleteReply() {
  return 'A solicitação de exclusão está pronta. Confirme pelo botão ou responda “confirmar exclusão”.'
}

export { PENDING_TTL_MS }
