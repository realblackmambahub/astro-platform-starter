import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'

import { sendWhatsAppTextMessage } from '@/services/whatsapp/send-message'
import { sendWhatsAppInteractiveMessage } from '@/services/whatsapp/send-interactive'
import { generateWhatsAppReply } from '@/services/whatsapp/gemini-reply'
import { getWebhookAdminClient } from '@/services/subscription-access'
import { ensureFinancialBootstrap, handleActivationMessage } from '@/services/whatsapp/activation'
import {
  inferCategoryCandidate,
  normalizeTransactionDescription,
  normalizeCategoryName,
  parseFinanceIntent,
  type FinanceIntent,
} from '@/services/whatsapp/finance-intent'
import {
  buildPendingDeleteReply,
  buildPendingEditReply,
  consumePendingAction,
  createPendingAction,
  getPendingAction,
  isCancellationText,
  isConfirmationText,
  parseActionPayload,
  parseEditFields,
} from '@/services/whatsapp/pending-actions'

export const runtime = 'nodejs'

const processedMessageIds = new Map<string, number>()
const DEDUPE_TTL_MS = 10 * 60 * 1000

const FALLBACK_REPLY =
  'Olá! Eu sou a KEVO. Sua mensagem foi recebida com sucesso.'

type WebhookAdminClient = Awaited<
  ReturnType<typeof getWebhookAdminClient>
>

type WhatsAppChange = {
  field?: string
  value?: {
    metadata?: {
      phone_number_id?: string
    }
    messages?: Array<{
      from?: string
      id?: string
      type?: string
      text?: {
        body?: string
      }
      button?: {
        text?: string
        payload?: string
      }
      interactive?: {
        type?: string
        button_reply?: {
          id?: string
          title?: string
        }
      }
    }>
    statuses?: Array<{
      id?: string
      status?: string
      timestamp?: string
      recipient_id?: string
    }>
  }
}

type WhatsAppPayload = {
  entry?: Array<{
    changes?: WhatsAppChange[]
  }>
}

type NormalizedTextMessage = {
  messageId: string
  from: string
  type: string
  text: string
  phoneNumberId: string
}

function hasWebhookConfiguration() {
  return Boolean(
    process.env.WHATSAPP_VERIFY_TOKEN &&
    process.env.META_APP_SECRET,
  )
}

function hasOutboundConfiguration() {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN &&
    process.env.WHATSAPP_PHONE_NUMBER_ID,
  )
}

function hasValidSignature(request: Request, rawBody: string) {
  const appSecret = process.env.META_APP_SECRET
  const receivedSignature = request.headers.get('x-hub-signature-256')

  if (!appSecret || !receivedSignature?.startsWith('sha256=')) {
    return false
  }

  const expectedSignature = `sha256=${createHmac('sha256', appSecret)
    .update(rawBody, 'utf8')
    .digest('hex')}`

  const receivedBuffer = Buffer.from(receivedSignature, 'utf8')
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8')

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false
  }

  return timingSafeEqual(receivedBuffer, expectedBuffer)
}

function pruneProcessedMessages(now: number) {
  for (const [messageId, timestamp] of processedMessageIds) {
    if (now - timestamp > DEDUPE_TTL_MS) {
      processedMessageIds.delete(messageId)
    }
  }
}

function maskPhone(phone: string) {
  if (phone.length <= 4) return '****'

  return `${'*'.repeat(Math.max(4, phone.length - 4))}${phone.slice(-4)}`
}

function phoneCandidates(phone: string) {
  const digits = phone.replace(/\D/g, '')
  return Array.from(new Set([phone, digits, `+${digits}`].filter(Boolean)))
}

function extractTextMessages(
  payload: WhatsAppPayload,
): NormalizedTextMessage[] {
  return (payload.entry ?? []).flatMap((entry) =>
    (entry.changes ?? []).flatMap((change) => {
      /*
       * Processamos apenas o campo "messages".
       * Outros callbacks do WhatsApp não devem iniciar conversa.
       */
      if (change.field && change.field !== 'messages') {
        return []
      }

      const phoneNumberId = change.value?.metadata?.phone_number_id

      if (!phoneNumberId) {
        return []
      }

      return (change.value?.messages ?? [])
        .filter((message) =>
          (message.type === 'text' && Boolean(message.text?.body)) ||
          (message.type === 'interactive' && Boolean(message.interactive?.button_reply?.id)) ||
          (message.type === 'button' && Boolean(message.button?.payload)),
        )
        .filter((message) => Boolean(message.id) && Boolean(message.from))
        .map((message) => ({
          messageId: message.id!,
          from: message.from!,
          type: message.type === 'text' ? 'text' : 'button',
          text: (message.text?.body || message.interactive?.button_reply?.id || message.button?.payload || '').trim(),
          phoneNumberId,
        }))
        .filter((message) => message.text.length > 0)
    }),
  )
}

async function claimInboundMessage(
  messageId: string,
  from: string,
  type: string,
  body: string,
) {
  const admin = await getWebhookAdminClient()

  /*
   * Se o client administrativo não estiver configurado,
   * mantemos dedupe local best-effort.
   */
  if (!admin) {
    return {
      accepted: true,
      admin: null as WebhookAdminClient,
    }
  }

  const { error } = await admin.from('whatsapp_messages').insert({
    wa_message_id: messageId,
    from_phone: from,
    message_type: type,
    direction: 'inbound',
    status: 'received',
    body,
  })

  /*
   * PostgreSQL unique violation.
   * A mensagem já foi processada/registrada.
   */
  if (error?.code === '23505') {
    return {
      accepted: false,
      admin,
    }
  }

  if (error) {
    console.error('[KEVO WhatsApp] inbound persistence failed', {
      code: error.code,
    })

    /*
     * Não bloqueamos o WhatsApp por falha secundária
     * de observabilidade/persistência.
     */
    return {
      accepted: true,
      admin,
    }
  }

  return {
    accepted: true,
    admin,
  }
}

async function findWhatsAppUser(admin: WebhookAdminClient, phone: string) {
  if (!admin) return null
  const candidates = phoneCandidates(phone)
  const { data } = await admin
    .from('profiles')
    .select('id, display_name, whatsapp_phone')
    .in('whatsapp_phone', candidates)
    .limit(1)
    .maybeSingle()
  return data
}

async function saveMissingAccountIntent(admin: WebhookAdminClient, messageId: string, userId: string, intent: FinanceIntent) {
  if (!admin) return
  await admin.from('whatsapp_messages').update({
    user_id: userId,
    status: 'pending_missing_account',
    metadata: { action: 'missing_account', intent },
  }).eq('wa_message_id', messageId).eq('direction', 'inbound')
}

  async function createTransaction(admin: WebhookAdminClient, userId: string, intent: FinanceIntent, whatsappMessageId: string) {
  if (!admin) return { ok: false, reason: 'database_unavailable' as const }

  console.info('[WA FINANCE] user_resolved=true')
  const { count: initialAccountCount, error: initialAccountError } = await admin
    .from('accounts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  console.info(`[WA FINANCE] account_count=${initialAccountError ? 'error' : initialAccountCount ?? 0}`)

  const bootstrapCreated = (initialAccountCount ?? 0) === 0
  const bootstrapReady = await ensureFinancialBootstrap(admin, userId)
  console.info(`[WA FINANCE] bootstrap_account_created=${String(bootstrapCreated && bootstrapReady)}`)
  if (!bootstrapReady) return { ok: false, reason: 'database_unavailable' as const }

  const existing = await admin.from('transactions').select('id, description, amount, type, transaction_date, category_id').eq('whatsapp_message_id', whatsappMessageId).eq('user_id', userId).maybeSingle()
  if (existing.data?.id) {
    const existingCategory = existing.data.category_id ? await admin.from('categories').select('name').eq('id', existing.data.category_id).eq('user_id', userId).maybeSingle() : null
    return { ok: true as const, transactionId: existing.data.id, duplicate: true as const, categoryName: existingCategory?.data?.name ?? 'Sem categoria', persisted: existing.data }
  }

  const [{ data: accounts, error: accountError }, { data: categories, error: categoryError }] = await Promise.all([
    admin.from('accounts').select('id, name').eq('user_id', userId).order('created_at', { ascending: true }),
    admin.from('categories').select('id, name').eq('user_id', userId),
  ])

  console.info(`[WA FINANCE] account_resolved=${String(!accountError && Boolean(accounts?.length))}`)
  if (accountError || !accounts?.length) return { ok: false, reason: 'account_required' as const }
  if (accounts.length > 1) return { ok: false, reason: 'multiple_accounts' as const }

  const candidate = intent.categoryCandidate ?? inferCategoryCandidate(intent.description, intent.type)
  const category = categories?.find((item) => candidate && normalizeCategoryName(item.name) === normalizeCategoryName(candidate))
  const categoryName = category?.name ?? 'Sem categoria'
  const persistedDescription = normalizeTransactionDescription(intent.description)
  const { data, error } = await admin.from('transactions').insert({
    user_id: userId,
    account_id: accounts[0].id,
    category_id: category?.id ?? null,
    whatsapp_message_id: whatsappMessageId,
    description: persistedDescription,
    amount: intent.amount,
    type: intent.type,
    transaction_date: intent.transactionDate,
    source: 'WhatsApp',
    notes: categoryError ? 'Registrado via WhatsApp; categoria não encontrada' : 'Registrado via WhatsApp',
  }).select('id').single()
  if (error) {
    if (error.code === '23505') {
      const retry = await admin.from('transactions').select('id').eq('whatsapp_message_id', whatsappMessageId).maybeSingle()
      if (retry.data?.id) return { ok: true as const, transactionId: retry.data.id, duplicate: true as const, categoryName, persisted: retry.data }
    }
    console.error('[KEVO WhatsApp] transaction insert failed', { code: error.code })
    return { ok: false, reason: 'insert_failed' as const }
  }
  return { ok: true as const, transactionId: data.id, duplicate: false as const, categoryName, persisted: { ...data, description: persistedDescription, amount: intent.amount, type: intent.type, transaction_date: intent.transactionDate, category_id: category?.id ?? null } }
}

async function updateOwnedTransaction(admin: WebhookAdminClient, userId: string, transactionId: string, fields: Partial<Pick<FinanceIntent, 'description' | 'amount' | 'transactionDate'>> & { categoryName?: string }) {
  console.info('[WA ACTION] edit_update_attempted=true')
  if (!admin || !/^[0-9a-f-]{36}$/i.test(transactionId)) return { ok: false as const, reason: 'invalid_request' as const }
  const { data: existing, error: lookupError } = await admin.from('transactions').select('id, description, amount, type, transaction_date, category_id').eq('id', transactionId).eq('user_id', userId).maybeSingle()
  if (lookupError || !existing) return { ok: false as const, reason: 'not_owned' as const }
  const patch: Record<string, unknown> = {}
  if (fields.description) patch.description = normalizeTransactionDescription(fields.description)
  if (fields.amount !== undefined && Number.isFinite(fields.amount) && fields.amount > 0 && fields.amount <= 100000000) patch.amount = Number(fields.amount.toFixed(2))
  if (fields.transactionDate) {
    const parsed = new Date(`${fields.transactionDate}T00:00:00Z`)
    if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== fields.transactionDate) return { ok: false as const, reason: 'invalid_date' as const }
    patch.transaction_date = fields.transactionDate
  }
  if (fields.categoryName) {
    const { data: category } = await admin.from('categories').select('id').eq('user_id', userId).ilike('name', fields.categoryName).maybeSingle()
    if (!category?.id) return { ok: false as const, reason: 'invalid_category' as const }
    patch.category_id = category.id
  }
  if (!Object.keys(patch).length) return { ok: false as const, reason: 'no_valid_fields' as const }
  const { data: updated, error } = await admin.from('transactions').update(patch).eq('id', transactionId).eq('user_id', userId).select('description, amount, transaction_date, type, category_id').maybeSingle()
  if (error || !updated) {
    console.info('[WA ACTION] edit_update_success=false')
    return { ok: false as const, reason: 'update_failed' as const }
  }
  console.info('[WA ACTION] edit_update_success=true')
  return { ok: true as const, updated }
}

async function deleteOwnedTransaction(admin: WebhookAdminClient, phone: string, transactionId: string) {
  if (!admin) return { ok: false as const, reason: 'database_unavailable' }
  const user = await findWhatsAppUser(admin, phone)
  if (!user) return { ok: false as const, reason: 'user_not_found' }
  const { data, error } = await admin.from('transactions').delete().eq('id', transactionId).eq('user_id', user.id).select('id').maybeSingle()
  if (error) return { ok: false as const, reason: 'delete_failed' }
  return data?.id ? { ok: true as const } : { ok: false as const, reason: 'not_owned' }
}

  async function markInboundProcessed(
  admin: WebhookAdminClient,
  messageId: string,
  preservePending = false,
  ) {
  if (!admin) return
  
  const query = admin
  .from('whatsapp_messages')
  .update({
  ...(preservePending ? {} : { status: 'processed' }),
  processed_at: preservePending ? null : new Date().toISOString(),
  })
  .eq('wa_message_id', messageId)
  .eq('direction', 'inbound')
  if (preservePending) query.in('status', ['pending_edit', 'pending_delete'])
  const { error } = await query

  if (error) {
    console.error('[KEVO WhatsApp] failed to mark inbound processed', {
      code: error.code,
    })
  }
}

async function markInboundFailed(
  admin: WebhookAdminClient,
  messageId: string,
) {
  if (!admin) return

  const { error } = await admin
    .from('whatsapp_messages')
    .update({
      status: 'pending_retry',
      processed_at: new Date().toISOString(),
    })
    .eq('wa_message_id', messageId)
    .eq('direction', 'inbound')

  if (error) {
    console.error('[KEVO WhatsApp] failed to mark inbound failed', {
      code: error.code,
    })
  }
}

async function recordOutbound(
  admin: WebhookAdminClient,
  messageId: string | undefined,
  to: string,
) {
  if (!admin || !messageId) return

  const { error } = await admin.from('whatsapp_messages').insert({
    wa_message_id: messageId,
    from_phone: to,
    message_type: 'text',
    direction: 'outbound',
    status: 'sent',
    processed_at: new Date().toISOString(),
  })

  if (error && error.code !== '23505') {
    console.error('[KEVO WhatsApp] outbound persistence failed', {
      code: error.code,
    })
  }
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
}

async function createContextualGreeting(displayName: string | null, persisted: { description: string; type: string; categoryName: string }) {
  const firstName = displayName?.trim().split(/\s+/)[0] ?? ''
  const fallback = firstName ? `Olá, ${firstName}! Sua movimentação foi registrada por aqui.` : 'Olá! Sua movimentação foi registrada por aqui.'
  const generated = await generateWhatsAppReply(`Após registrar com sucesso uma ${persisted.type === 'expense' ? 'despesa' : 'receita'} de ${persisted.description} na categoria ${persisted.categoryName}, escreva somente uma saudação contextual curta para ${firstName || 'a pessoa usuária'}. Use no máximo duas frases, não invente fatos, não altere nenhum dado financeiro e não inclua resumo, valores, categoria, links ou botões.`)
  if (!generated) return fallback
  const clean = generated.replace(/\s+/g, ' ').trim()
  return clean.length > 0 && clean.length <= 280 ? `${firstName ? `Olá, ${firstName}!` : 'Olá!'} ${clean.replace(/^olá[,!]?(\s+\w+)?[.!]?\s*/i, '').trim()}`.trim() : fallback
}

function buildTransactionConfirmation(greeting: string, persisted: { description: string; amount: number; categoryName: string; transactionDate: string }) {
  return `${greeting}

🧾 *Resumo da transação:*

📝 *Descrição:* ${persisted.description}
💰 *Valor:* ${formatAmount(persisted.amount)}
🏷️ *Categoria:* ${persisted.categoryName}
📅 *Data:* ${formatDate(persisted.transactionDate)}

✅ *Status:* Registrado com sucesso

📊 Para visualizar mais detalhes e relatórios, acesse seu painel:
https://panel.kevoia.com

Se precisar de algo a mais, é só me chamar! 😊`
}

async function createReply(message: string) {
  /*
   * Modo mínimo permite testar apenas WhatsApp ↔ Meta
   * sem depender de Gemini.
   */
  if (process.env.WHATSAPP_MINIMAL_MODE === 'true') {
    return {
      reply: FALLBACK_REPLY,
      generatedByAi: false,
    }
  }

  if (process.env.AI_AUTOMATIC_RESPONSES_ENABLED !== 'true') {
    return {
      reply: FALLBACK_REPLY,
      generatedByAi: false,
    }
  }

  if (process.env.AI_PROVIDER !== 'gemini') {
    return {
      reply: FALLBACK_REPLY,
      generatedByAi: false,
    }
  }

  try {
    const generatedReply = await generateWhatsAppReply(message)

    if (
      typeof generatedReply === 'string' &&
      generatedReply.trim().length > 0
    ) {
      return {
        reply: generatedReply.trim(),
        generatedByAi: true,
      }
    }
  } catch (error) {
    console.error('[KEVO WhatsApp] Gemini generation failed', {
      error:
        error instanceof Error
          ? error.name
          : 'unknown_error',
    })
  }

  return {
    reply: FALLBACK_REPLY,
    generatedByAi: false,
  }
}

/*
 * Meta webhook verification
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const mode = searchParams.get('hub.mode')
  const verifyToken = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const configuredToken = process.env.WHATSAPP_VERIFY_TOKEN

  if (
    mode === 'subscribe' &&
    configuredToken &&
    verifyToken === configuredToken &&
    challenge
  ) {
    return new Response(challenge, {
      status: 200,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
      },
    })
  }

  return new Response('Forbidden', {
    status: 403,
  })
}

/*
 * Incoming WhatsApp events
 */
export async function POST(request: Request) {
  /*
   * IMPORTANTE:
   * agora usamos META_APP_SECRET.
   */
  if (!hasWebhookConfiguration()) {
    console.error('[KEVO WhatsApp] webhook configuration missing')

    return NextResponse.json(
      {
        error: 'webhook_not_configured',
      },
      {
        status: 503,
      },
    )
  }

  const rawBody = await request.text()

  if (!hasValidSignature(request, rawBody)) {
    console.warn('[KEVO WhatsApp] invalid webhook signature')

    return NextResponse.json(
      {
        error: 'invalid_signature',
      },
      {
        status: 401,
      },
    )
  }

  let payload: WhatsAppPayload

  try {
    payload = JSON.parse(rawBody) as WhatsAppPayload
  } catch {
    return NextResponse.json(
      {
        error: 'invalid_payload',
      },
      {
        status: 400,
      },
    )
  }

  /*
   * Status callbacks não possuem messages[]
   * e portanto não serão processados como conversa.
   */
  const messages = extractTextMessages(payload)

  /*
   * Webhook válido sem mensagem de texto.
   * Ex.: delivered/read/status.
   */
  if (messages.length === 0) {
    return NextResponse.json(
      {
        ok: true,
        accepted: true,
        processed: 0,
      },
      {
        status: 202,
      },
    )
  }

  /*
   * Se o canal de saída estiver sem configuração,
   * aceitamos o webhook, mas não tentamos enviar.
   */
  if (!hasOutboundConfiguration()) {
    console.error('[KEVO WhatsApp] outbound configuration missing')

    return NextResponse.json(
      {
        ok: true,
        accepted: true,
        processed: 0,
        outboundConfigured: false,
      },
      {
        status: 202,
      },
    )
  }

  const now = Date.now()

  pruneProcessedMessages(now)

  let processed = 0

  for (const message of messages) {
    /*
     * Dedupe local.
     * Supabase continua sendo a proteção definitiva.
     */
    if (processedMessageIds.has(message.messageId)) {
      continue
    }

    const activationAdmin = await getWebhookAdminClient()
    const activationUser = activationAdmin
      ? await findWhatsAppUser(activationAdmin, message.from)
      : null

    /*
     * A ativação é resolvida antes do claim inbound. Em awaiting_password,
     * a senha nunca entra em whatsapp_messages nem no pipeline financeiro.
     */
  if (activationAdmin && !activationUser) {
    let activation: Awaited<ReturnType<typeof handleActivationMessage>>
    try {
      activation = await handleActivationMessage(activationAdmin, message.from, message.text)
    } catch (error) {
      console.error('[KEVO WhatsApp] activation failed before finance flow', {
        errorType: error instanceof Error ? error.name : typeof error,
      })
      const outbound = await sendWhatsAppTextMessage(message.from, 'Não foi possível processar a ativação agora. Tente novamente.')
      if (outbound.ok) await recordOutbound(activationAdmin, outbound.messageId, message.from)
      processed += 1
      continue
    }
    if (activation.handled) {
      const outbound = await sendWhatsAppTextMessage(message.from, activation.reply)
      if (outbound.ok) await recordOutbound(activationAdmin, outbound.messageId, message.from)
      processed += 1
      continue
    }
  }

    const claim = await claimInboundMessage(
      message.messageId,
      message.from,
      message.type,
      message.text,
    )

    if (!claim.accepted) {
      continue
    }

    processedMessageIds.set(message.messageId, now)

    console.info('[KEVO WhatsApp] finance-flow-v2')
    console.info('[KEVO WhatsApp] inbound text received', {
      messageId: message.messageId,
      from: maskPhone(message.from),
      type: message.type,
      textLength: message.text.length,
      phoneNumberMatches:
        message.phoneNumberId ===
        process.env.WHATSAPP_PHONE_NUMBER_ID,
    })

    try {
      const webhookStartedAt = Date.now()
      console.info('[WA PERF] webhook_start')
      const user = findWhatsAppUser(claim.admin, message.from)
      let reply: string
      let generatedByAi = false

      const linkedUser = await user
      console.info(`[WA PERF] user_resolved_ms=${Date.now() - webhookStartedAt}`)
      let transactionId: string | undefined
      let categoryName = 'Sem categoria'
      let actionButtons: Array<{ id: string; title: string }> | undefined
      let preservePendingAction = false
      const payload = parseActionPayload(message.text)
      const pendingLookupStartedAt = Date.now()
      const pending = linkedUser ? await getPendingAction(claim.admin, message.from, linkedUser.id) : null
      console.info(`[WA PERF] pending_lookup_ms=${Date.now() - pendingLookupStartedAt}`)
      const editParseStartedAt = Date.now()
      const intent = pending ? null : parseFinanceIntent(message.text)
      console.info(`[WA PERF] edit_parse_ms=${Date.now() - editParseStartedAt}`)

      if (!linkedUser) {
        reply = 'Não encontrei uma conta KEVO vinculada a este número.'
      } else if (payload?.action === 'edit_transaction') {
        const owned = await claim.admin?.from('transactions').select('id').eq('id', payload.transactionId).eq('user_id', linkedUser.id).maybeSingle()
        if (!owned?.data?.id) reply = 'Não encontrei essa transação na sua conta.'
        else {
          const created = await createPendingAction(claim.admin, message.messageId, linkedUser.id, 'pending_edit', payload.transactionId)
          preservePendingAction = created
          console.info(`[WA ACTION] callback_edit_received=${String(created)}`)
          console.info(`[WA ACTION] pending_edit_created=${String(created)}`)
          console.info('[WA ACTION] pending_action=pending_edit')
          reply = buildPendingEditReply()
        }
      } else if (payload?.action === 'delete_transaction') {
        const owned = await claim.admin?.from('transactions').select('id').eq('id', payload.transactionId).eq('user_id', linkedUser.id).maybeSingle()
        if (!owned?.data?.id) reply = 'Não encontrei essa transação na sua conta.'
        else {
          const created = await createPendingAction(claim.admin, message.messageId, linkedUser.id, 'pending_delete', payload.transactionId)
          preservePendingAction = created
          console.info('[WA ACTION] delete_confirmation_started=true')
          reply = buildPendingDeleteReply()
          actionButtons = [
            { id: `confirm_delete:${payload.transactionId}`, title: 'Confirmar exclusão' },
            { id: `cancel_delete:${payload.transactionId}`, title: 'Cancelar' },
          ]
        }
      } else if (payload?.action === 'confirm_delete' || payload?.action === 'confirm_delete_transaction') {
        const active = pending?.actionType === 'pending_delete' && pending.transactionId === payload.transactionId ? pending : null
        if (!active) reply = 'Essa confirmação expirou. Use o botão Excluir novamente.'
        else {
          console.info('[WA ACTION] delete_confirmed=true')
          const deleted = await deleteOwnedTransaction(claim.admin, message.from, active.transactionId)
          await consumePendingAction(claim.admin, active.messageId, 'consumed')
          reply = deleted.ok || deleted.reason === 'not_owned' ? (deleted.ok ? 'Transação excluída com sucesso.' : 'Essa transação já não está disponível.') : 'Não consegui excluir essa transação agora.'
          if (deleted.ok) console.info('[WA ACTION] delete_success=true')
        }
      } else if (payload?.action === 'cancel_delete') {
        const active = pending?.actionType === 'pending_delete' && pending.transactionId === payload.transactionId ? pending : null
        if (!active) reply = 'Essa ação expirou. Nenhuma transação foi alterada.'
        else {
          await consumePendingAction(claim.admin, active.messageId, 'consumed')
          reply = 'Tudo certo. A transação foi mantida.'
        }
      } else if (pending?.actionType === 'pending_delete' && (isConfirmationText(message.text) || isCancellationText(message.text))) {
        if (isCancellationText(message.text)) {
          await consumePendingAction(claim.admin, pending.messageId, 'consumed')
          reply = 'Tudo certo. A transação foi mantida.'
        } else {
          console.info('[WA ACTION] delete_confirmed=true')
          const deleted = await deleteOwnedTransaction(claim.admin, message.from, pending.transactionId)
          await consumePendingAction(claim.admin, pending.messageId, 'consumed')
          reply = deleted.ok ? 'Transação excluída com sucesso.' : deleted.reason === 'not_owned' ? 'Essa transação já não está disponível.' : 'Não consegui excluir essa transação agora.'
          if (deleted.ok) console.info('[WA ACTION] delete_success=true')
        }
      } else if (pending?.actionType === 'pending_edit' && isCancellationText(message.text)) {
        await consumePendingAction(claim.admin, pending.messageId, 'consumed')
        reply = 'Tudo certo. A edição foi cancelada e a transação permaneceu igual.'
      } else if (pending?.actionType === 'pending_edit') {
        const fields = parseEditFields(message.text)
        if (!fields) reply = buildPendingEditReply()
        else {
          const updateStartedAt = Date.now()
          const updated = await updateOwnedTransaction(claim.admin, linkedUser.id, pending.transactionId, fields)
          console.info(`[WA PERF] transaction_update_ms=${Date.now() - updateStartedAt}`)
          if (!updated.ok) reply = updated.reason === 'not_owned' ? 'Não encontrei essa transação na sua conta.' : 'Não consegui aplicar uma alteração válida. Tente informar valor, descrição, categoria ou data.'
          else {
            const consumed = await consumePendingAction(claim.admin, pending.messageId, 'consumed')
            console.info(`[WA ACTION] pending_consumed=${String(consumed)}`)
            reply = `Pronto! Atualizei sua transação.\n\n🧾 *Resumo da transação atualizada:*\n\n📝 *Descrição:* ${updated.updated.description}\n💰 *Valor:* ${formatAmount(Number(updated.updated.amount))}\n🏷️ *Categoria:* ${fields.categoryName ?? 'Sem alteração'}\n📅 *Data:* ${formatDate(String(updated.updated.transaction_date))}\n\n✅ *Status:* Atualizado com sucesso`
            transactionId = pending.transactionId
            actionButtons = [
              { id: `edit_transaction:${transactionId}`, title: 'Editar transação' },
              { id: `delete_transaction:${transactionId}`, title: 'Excluir transação' },
            ]
          }
        }
      } else if (intent && linkedUser) {
        const result = await createTransaction(claim.admin, linkedUser.id, intent, message.messageId)
        if (result.ok) {
          transactionId = result.transactionId
          categoryName = result.categoryName
          const persisted = result.persisted && 'description' in result.persisted
            ? result.persisted
            : { description: normalizeTransactionDescription(intent.description), amount: intent.amount, type: intent.type, transaction_date: intent.transactionDate, category_id: null }
          const greeting = await createContextualGreeting(linkedUser.display_name, { description: String(persisted.description), type: String(persisted.type), categoryName })
          reply = buildTransactionConfirmation(greeting, { description: String(persisted.description), amount: Number(persisted.amount), categoryName, transactionDate: String(persisted.transaction_date) })
        } else if (result.reason === 'multiple_accounts') {
          await saveMissingAccountIntent(claim.admin, message.messageId, linkedUser.id, intent)
          reply = 'Encontrei mais de uma conta ativa no KEVO. Qual conta devo usar para registrar essa movimentação?'
        } else if (result.reason === 'account_required') {
          await saveMissingAccountIntent(claim.admin, message.messageId, linkedUser.id, intent)
          reply = 'Para registrar essa movimentação, crie uma conta financeira no KEVO e envie a mensagem novamente.'
        } else {
          reply = 'Não consegui registrar agora. Nenhuma alteração financeira foi feita.'
        }
      } else {
        console.info('[WA ACTION] fallback_reached=true')
        const generated = await createReply(message.text)
        reply = generated.reply
        generatedByAi = generated.generatedByAi
      }

      console.info('[WA ACTION] fallback_reached=false')
      console.info('[KEVO WhatsApp] outbound attempt started', {
        destination: maskPhone(message.from),
        generatedByAi,
      })

      const buttons = actionButtons ?? (transactionId
        ? [
            { id: `edit_transaction:${transactionId}`, title: 'Editar transação' },
            { id: `delete_transaction:${transactionId}`, title: 'Excluir transação' },
          ]
        : undefined)
      const whatsappSendStartedAt = Date.now()
      const result = buttons
        ? await sendWhatsAppInteractiveMessage(message.from, reply, buttons)
        : await sendWhatsAppTextMessage(message.from, reply)
      console.info(`[WA PERF] whatsapp_send_ms=${Date.now() - whatsappSendStartedAt}`)

      if (!result.ok) {
        console.error('[KEVO WhatsApp] outbound failed', {
          reason: result.reason,
        })

        await markInboundFailed(
          claim.admin,
          message.messageId,
        )

        continue
      }

      await recordOutbound(
        claim.admin,
        result.messageId,
        message.from,
      )

      await markInboundProcessed(
  claim.admin,
  message.messageId,
  preservePendingAction,
  )

      processed += 1
      console.info(`[WA PERF] total_ms=${Date.now() - webhookStartedAt}`)

      console.info('[KEVO WhatsApp] outbound accepted by Meta', {
        messageId: result.messageId,
        generatedByAi,
      })
    } catch (error) {
      await markInboundFailed(
        claim.admin,
        message.messageId,
      )

      console.error('[KEVO WhatsApp] processing failed', {
        error:
          error instanceof Error
            ? error.name
            : 'unknown_error',
      })
    }
  }

  return NextResponse.json(
    {
      ok: true,
      accepted: true,
      processed,
    },
    {
      status: 202,
    },
  )
}
