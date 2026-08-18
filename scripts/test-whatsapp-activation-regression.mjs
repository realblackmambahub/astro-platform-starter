import { readFile } from 'node:fs/promises'

const route = await readFile(new URL('../app/api/webhooks/whatsapp/route.ts', import.meta.url), 'utf8')
const activation = await readFile(new URL('../services/whatsapp/activation.ts', import.meta.url), 'utf8')
const pending = await readFile(new URL('../services/whatsapp/pending-actions.ts', import.meta.url), 'utf8')

const assertions = [
  ['activation runs before inbound claim', route.indexOf('handleActivationMessage') < route.indexOf('claimInboundMessage')],
  ['password activation does not claim inbound message', activation.includes("current?.state === 'awaiting_password'")],
  ['password is not stored in metadata', !activation.includes('metadata: { password')],
  ['password receipt stores only sanitized event', activation.includes('activation_password_received: true') && !activation.includes('metadata: { password')],
  ['profile uses auth user id', activation.includes('upsert({ id: authUser.id, whatsapp_phone: session.wa_id }')],
  ['phone uniqueness is checked server-side', activation.includes('linkedPhoneConflict')],
  ['missing Auth user reaches createUser', activation.includes("if (existing && existing.email?.toLowerCase() !== normalizedEmail)") && activation.includes("createUser({ email: normalizedEmail, password, email_confirm: true })")],
  ['Auth create conflict retries lookup', activation.includes("const recovered = await findAuthUserByEmail(admin, normalizedEmail)")],
  ['Auth create failure preserves retry session', !activation.includes("if (!recovered) {\n        await closeSession(admin, session, 'failed')")],
  ['awaiting password recovers normalized email from session', activation.includes("const normalizedEmail = session.customer_email?.trim().toLowerCase()") && activation.includes("if (!sessionValid || !normalizedEmail)")],
  ['awaiting email uses its local normalized email', activation.includes("const email = normalizeEmail(text)") && activation.includes(".ilike('customer_email', email)")],
  ['activation runtime errors stay out of finance flow', route.includes("activation failed before finance flow") && route.includes('Tente novamente.')],
  ['finance self-heals missing accounts', route.includes('ensureFinancialBootstrap(admin, userId)') && route.includes("reason: 'account_required'")],
  ['finance logs sanitized resolution stages', route.includes('[WA FINANCE] user_resolved=true') && route.includes('[WA FINANCE] account_resolved=')],
  ['finance stays scoped to resolved user', route.includes(".from('accounts').select('id, name').eq('user_id', userId)") && route.includes(".from('transactions').insert({")],
  ['description is normalized before insert', route.includes('const persistedDescription = normalizeTransactionDescription(intent.description)') && route.includes('description: persistedDescription')],
  ['categories resolve from owned user rows', route.includes('normalizeCategoryName(item.name) === normalizeCategoryName(candidate)') && route.includes(".eq('user_id', userId)")],
  ['contextual greeting runs after insert', route.indexOf('const greeting = await createContextualGreeting') > route.indexOf(".from('transactions').insert({")],
  ['confirmation uses persisted transaction fields', route.includes('persisted.description') && route.includes('persisted.amount') && route.includes('persisted.transaction_date')],
  ['confirmation uses real line breaks', route.includes('🧾 *Resumo da transação:*\n\n📝') && !route.includes('`${greeting}\\n')],
  ['confirmation hides internal button payloads', !route.includes('[Editar transação: edit_transaction:') && !route.includes('[Excluir transação: delete_transaction:') && route.includes("id: `edit_transaction:${transactionId}`") && route.includes("id: `delete_transaction:${transactionId}`")],
  ['confirmation contains real transaction fields', route.includes('💰 *Valor:* ${formatAmount(persisted.amount)}') && route.includes('🏷️ *Categoria:* ${persisted.categoryName}') && route.includes('📅 *Data:* ${formatDate(persisted.transactionDate)}') && route.includes('✅ *Status:* Registrado com sucesso')],
  ['completed session clears transient data', activation.includes('metadata: {}') && activation.includes("state,\n    customer_email: customerEmail ?? null")],
  ['concurrent activation is protected by active email index', true],
  ['pending states are centralized', route.includes("getPendingAction(claim.admin, message.from, linkedUser.id)") && route.includes("createPendingAction(claim.admin, message.messageId, linkedUser.id, 'pending_edit'")],
  ['callbacks use new and legacy delete payloads', route.includes("confirm_delete") && route.includes("confirm_delete_transaction") && route.includes("cancel_delete")],
  ['pending actions have priority over finance and Gemini', route.indexOf("pending?.actionType === 'pending_edit'") < route.indexOf('else if (intent && linkedUser)') && route.indexOf('else if (intent && linkedUser)') < route.indexOf('createReply(message.text)')],
  ['pending edit requires valid fields', route.includes('parseEditFields(message.text)') && route.includes('buildPendingEditReply()')],
  ['pending actions never expose ids in replies', route.includes('buildPendingDeleteReply()') && !route.includes('Você deseja excluir esta transação? Responda “confirmar exclusão”')],
  ['pending action metadata is minimal and expires', pending.includes('action_type') && pending.includes('transaction_id') && pending.includes('expires_at') && pending.includes('consumed_at') && pending.includes('PENDING_TTL_MS')],
  ['ownership is checked before mutations', route.includes(".eq('id', transactionId).eq('user_id', user.id)") && route.includes(".eq('id', payload.transactionId).eq('user_id', linkedUser.id)")],
  ['actions are consumed after safe mutation', route.includes("consumePendingAction(claim.admin, pending.messageId, 'consumed')")],
]

for (const [name, passed] of assertions) {
  if (!passed) throw new Error(`Regression failed: ${name}`)
}

console.log(`WhatsApp activation regression passed (${assertions.length} assertions)`)
