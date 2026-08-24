import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const TARGET_EMAILS = [
  'pedrodacostaribeiro07@gmail.com',
  'tayane005@icloud.com',
  'stefaniecpalves@gmail.com',
  'Victoriabarbosa183@gmail.com',
  'davidamar0477@gmail.com',
  'mwillrsilva@gmail.com',
  'caiquevferreira15@gmail.com',
  'guilhermesieben04@gmail.com',
  'joaozinhoazevedo6@gmail.com',
]
const mode = process.argv[2]
if (!['--dry-run', '--execute'].includes(mode)) {
  console.error('Uso: node scripts/create-affiliate-access.mjs --dry-run|--execute')
  process.exit(2)
}

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
if (!url || !key) throw new Error('Configuração Supabase Admin ausente')
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
const normalized = TARGET_EMAILS.map((email) => ({ original: email, normalized: email.trim().toLowerCase() }))

function strongPassword() {
  return `${crypto.randomBytes(32).toString('base64url')}!Aa9#`
}
function shortId(value) { return value ? `${value.slice(0, 8)}…` : null }
function safeError(error) { return error?.message || 'erro inesperado' }
function expectedSubscription(row) {
  return row && row.plan === 'kevo' && row.status === 'active' && row.source === 'manual_test' && row.is_demo === true && row.purchased_at == null && row.expires_at == null && row.kiwify_customer_id == null && row.kiwify_order_id == null && row.product_id == null
}

async function listAllUsers() {
  const users = []
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    users.push(...(data.users || []))
    if (!data.users || data.users.length < 1000) return users
  }
}
async function getSubscription(user, email) {
  let query = supabase.from('subscriptions').select('*').order('updated_at', { ascending: false }).limit(10)
  if (user?.id) query = query.or(`user_id.eq.${user.id},customer_email.ilike.${email}`)
  else query = query.ilike('customer_email', email)
  const { data, error } = await query
  if (error) throw error
  return data?.[0] || null
}
async function subscriptionPayload(userId, columns) {
  const row = { user_id: userId, plan: 'kevo', status: 'active', source: 'manual_test', is_demo: true, purchased_at: null, expires_at: null }
  for (const column of ['customer_email', 'kiwify_customer_id', 'kiwify_order_id', 'product_id', 'payment_id', 'transaction_id', 'purchase_id']) if (columns.has(column)) row[column] = null
  return row
}
async function columns() {
  const { data, error } = await supabase.from('subscriptions').select('*').limit(0)
  if (error && !error.message.includes('0 rows')) throw error
  const { data: sample, error: sampleError } = await supabase.from('subscriptions').select('*').limit(1)
  if (sampleError) throw sampleError
  return new Set(Object.keys(sample?.[0] || {}))
}

const users = await listAllUsers()
const columnsSet = await columns()
const byEmail = new Map(users.filter((u) => u.email).map((u) => [u.email.trim().toLowerCase(), u]))
const results = []
for (const target of normalized) {
  let user = byEmail.get(target.normalized)
  let subscription = await getSubscription(user, target.normalized)
  if (subscription && expectedSubscription(subscription)) {
    results.push({ email: target.normalized, action: 'ALREADY_VALID', result: 'ALREADY_VALID', user_id: shortId(user?.id) })
    continue
  }
  if (subscription) {
    results.push({ email: target.normalized, action: 'REVIEW_REQUIRED', result: 'REVIEW_REQUIRED', user_id: shortId(user?.id) })
    continue
  }
  if (mode === '--dry-run') {
    results.push({ email: target.normalized, action: user ? 'CREATE_SUBSCRIPTION' : 'CREATE_AUTH_AND_SUBSCRIPTION', result: 'PLANNED', user_id: shortId(user?.id) })
    continue
  }
  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({ email: target.original, password: strongPassword(), email_confirm: true })
    if (error) {
      const refreshed = await listAllUsers()
      user = refreshed.find((candidate) => candidate.email?.trim().toLowerCase() === target.normalized)
      if (!user) { results.push({ email: target.normalized, action: 'CREATE_AUTH', result: 'FAILED', error: safeError(error) }); continue }
    } else user = data.user
    byEmail.set(target.normalized, user)
  }
  const { error } = await supabase.from('subscriptions').insert(await subscriptionPayload(user.id, columnsSet))
  results.push(error ? { email: target.normalized, action: 'CREATE_SUBSCRIPTION', result: 'PARTIAL_AUTH_CREATED', error: safeError(error) } : { email: target.normalized, action: 'CREATE_AUTH_AND_SUBSCRIPTION', result: 'CREATED', user_id: shortId(user.id) })
}
console.log(JSON.stringify({ mode, total: results.length, results }, null, 2))
if (mode === '--dry-run') process.exit(0)
const counts = Object.fromEntries(['CREATED', 'ALREADY_VALID', 'REVIEW_REQUIRED', 'FAILED', 'PARTIAL_AUTH_CREATED'].map((key) => [key, results.filter((r) => r.result === key).length]))
console.log(`TOTAL=${results.length} CREATED=${counts.CREATED} ALREADY_VALID=${counts.ALREADY_VALID} REVIEW_REQUIRED=${counts.REVIEW_REQUIRED} FAILED=${counts.FAILED + counts.PARTIAL_AUTH_CREATED}`)
if (counts.FAILED || counts.PARTIAL_AUTH_CREATED) process.exitCode = 1
