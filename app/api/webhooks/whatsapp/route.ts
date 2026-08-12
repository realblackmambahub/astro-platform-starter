import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'

import { sendWhatsAppTextMessage } from '@/services/whatsapp/send-message'
import { sendWhatsAppInteractiveMessage } from '@/services/whatsapp/send-interactive'
import { generateWhatsAppReply } from '@/services/whatsapp/gemini-reply'
import { getWebhookAdminClient } from '@/services/subscription-access'
import { handleActivationMessage } from '@/services/whatsapp/activation'
import {
  parseFinanceIntent,
  type FinanceIntent,
} from '@/services/whatsapp/finance-intent'

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

  const existing = await admin.from('transactions').select('id').eq('whatsapp_message_id', whatsappMessageId).eq('user_id', userId).maybeSingle()
  if (existing.data?.id) return { ok: true as const, transactionId: existing.data.id, duplicate: true as const, categoryName: 'Sem categoria' }

  const [{ data: accounts, error: accountError }, { data: categories, error: categoryError }] = await Promise.all([
    admin.from('accounts').select('id, name').eq('user_id', userId).order('created_at', { ascending: true }),
    admin.from('categories').select('id, name').eq('user_id', userId),
  ])

  if (accountError || !accounts?.length) return { ok: false, reason: 'account_required' as const }
  if (accounts.length > 1) return { ok: false, reason: 'multiple_accounts' as const }

  const category = categories?.find((item) => {
    const name = item.name.toLowerCase()
    return intent.type === 'expense'
      ? Boolean(intent.categoryCandidate) && /aliment|mercado|supermercado|gasto|despesa/.test(name)
      : /receita|salário|salario|renda/.test(name)
  })
  const categoryName = category?.name ?? 'Sem categoria'
  const { data, error } = await admin.from('transactions').insert({
    user_id: userId,
    account_id: accounts[0].id,
    category_id: category?.id ?? null,
    whatsapp_message_id: whatsappMessageId,
    description: intent.description,
    amount: intent.amount,
    type: intent.type,
    transaction_date: intent.transactionDate,
    source: 'WhatsApp',
    notes: categoryError ? 'Registrado via WhatsApp; categoria não encontrada' : 'Registrado via WhatsApp',
  }).select('id').single()
  if (error) {
    if (error.code === '23505') {
      const retry = await admin.from('transactions').select('id').eq('whatsapp_message_id', whatsappMessageId).maybeSingle()
      if (retry.data?.id) return { ok: true as const, transactionId: retry.data.id, duplicate: true as const, categoryName }
    }
    console.error('[KEVO WhatsApp] transaction insert failed', { code: error.code })
    return { ok: false, reason: 'insert_failed' as const }
  }
  return { ok: true as const, transactionId: data.id, duplicate: false as const, categoryName }
}

async function updateOwnedTransaction(admin: WebhookAdminClient, phone: string, transactionId: string, intent: FinanceIntent) {
  if (!admin) return false
  const user = await findWhatsAppUser(admin, phone)
  if (!user) return false
  const { error } = await admin.from('transactions').update({ description: intent.description, amount: intent.amount, type: intent.type, transaction_date: intent.transactionDate }).eq('id', transactionId).eq('user_id', user.id)
  return !error
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
) {
  if (!admin) return

  const { error } = await admin
    .from('whatsapp_messages')
    .update({
      status: 'processed',
      processed_at: new Date().toISOString(),
    })
    .eq('wa_message_id', messageId)
    .eq('direction', 'inbound')

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

function buildTransactionConfirmation(displayName: string | null, intent: FinanceIntent, categoryName: string, transactionId?: string) {
  const firstName = displayName?.trim().split(/\\s+/)[0] || 'você'
  const greeting = `Olá, ${firstName}! Sua movimentação foi registrada por aqui.`
  const actions = transactionId ? `\\n[Editar transação: edit_transaction:${transactionId}]\\n[Excluir transação: delete_transaction:${transactionId}]` : ''
  return `${greeting}\\n\\n🧾 *Resumo da transação:*\\n\\n*Descrição:* ${intent.description}\\n*Valor:* ${formatAmount(intent.amount)}\\n*Categoria:* ${categoryName}\\n*Data:* ${formatDate(intent.transactionDate)}\\n\\n✅ *Status:* Registrado com sucesso\\n\\n📊 Para visualizar mais detalhes e relatórios, acesse seu painel KEVO:\\nhttps://panel.kevoia.com\\n\\nSe precisar de algo a mais, é só me chamar!${actions}`
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
      const activation = await handleActivationMessage(activationAdmin, message.from, message.text)
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
      const user = findWhatsAppUser(claim.admin, message.from)
      let reply: string
      let generatedByAi = false

      const linkedUser = await user
      const intent = parseFinanceIntent(message.text)
      let transactionId: string | undefined
      let categoryName = 'Sem categoria'

      const editMatch = message.text.match(/^edit_transaction:([0-9a-f-]{36})$/i)
      const deleteMatch = message.text.match(/^delete_transaction:([0-9a-f-]{36})$/i)
      const confirmDeleteMatch = message.text.match(/^confirm_delete_transaction:([0-9a-f-]{36})$/i)
      const pendingDelete = claim.admin ? await claim.admin.from('whatsapp_messages').select('metadata').eq('from_phone', message.from).eq('status', 'pending_delete').order('created_at', { ascending: false }).limit(1).maybeSingle() : null
      const pendingDeleteId = pendingDelete?.data?.metadata && typeof pendingDelete.data.metadata === 'object' ? (pendingDelete.data.metadata as { transactionId?: string }).transactionId : undefined
      const pendingEdit = claim.admin ? await claim.admin.from('whatsapp_messages').select('metadata').eq('from_phone', message.from).eq('status', 'pending_edit').order('created_at', { ascending: false }).limit(1).maybeSingle() : null
      const pendingEditId = pendingEdit?.data?.metadata && typeof pendingEdit.data.metadata === 'object' ? (pendingEdit.data.metadata as { transactionId?: string }).transactionId : undefined
      if (editMatch) {
        reply = 'Envie a nova descrição e valor da transação para atualizar. Vou validar novamente sua autorização antes de alterar.'
        if (claim.admin && linkedUser) await claim.admin.from('whatsapp_messages').update({ status: 'pending_edit', user_id: linkedUser.id, metadata: { transactionId: editMatch[1] } }).eq('wa_message_id', message.messageId)
      } else if (pendingEditId && intent && linkedUser) {
        const updated = await updateOwnedTransaction(claim.admin, message.from, pendingEditId, intent)
        reply = updated ? `Transação atualizada com sucesso.\n\n*Descrição:* ${intent.description}\n*Valor:* ${formatAmount(intent.amount)}\n*Data:* ${formatDate(intent.transactionDate)}` : 'Não consegui atualizar essa transação. Verifique se ela pertence à sua conta.'
      } else if (pendingEditId) {
        reply = 'Envie a nova descrição e valor da transação, por exemplo: “gastei 60 no mercado”.'
      } else if (pendingDeleteId && /^confirmar exclusão$/i.test(message.text)) {
        const deleted = await deleteOwnedTransaction(claim.admin, message.from, pendingDeleteId)
        reply = deleted.ok ? 'Transação excluída com sucesso.' : 'Não consegui excluir essa transação. Verifique se ela pertence à sua conta.'
      } else if (deleteMatch) {
        reply = `Você deseja excluir esta transação? Responda “confirmar exclusão” para continuar ou “cancelar” para manter.`
        if (claim.admin && linkedUser) await claim.admin.from('whatsapp_messages').update({ status: 'pending_delete', user_id: linkedUser.id, metadata: { transactionId: deleteMatch[1] } }).eq('wa_message_id', message.messageId)
      } else if (confirmDeleteMatch) {
        const deleted = await deleteOwnedTransaction(claim.admin, message.from, confirmDeleteMatch[1])
        reply = deleted.ok ? 'Transação excluída com sucesso.' : 'Não consegui excluir essa transação. Verifique se ela pertence à sua conta.'
      } else if (intent && linkedUser) {
        const result = await createTransaction(claim.admin, linkedUser.id, intent, message.messageId)
        if (result.ok) {
          transactionId = result.transactionId
          categoryName = result.categoryName
          reply = buildTransactionConfirmation(linkedUser.display_name, intent, categoryName, transactionId)
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
        const generated = await createReply(message.text)
        reply = generated.reply
        generatedByAi = generated.generatedByAi
      }

      console.info('[KEVO WhatsApp] outbound attempt started', {
        destination: maskPhone(message.from),
        generatedByAi,
      })

      const result = transactionId
        ? await sendWhatsAppInteractiveMessage(message.from, reply, [
            { id: `edit_transaction:${transactionId}`, title: 'Editar transação' },
            { id: `delete_transaction:${transactionId}`, title: 'Excluir transação' },
          ])
        : await sendWhatsAppTextMessage(message.from, reply)

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
      )

      processed += 1

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
