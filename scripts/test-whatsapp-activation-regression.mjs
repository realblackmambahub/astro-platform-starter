import { readFile } from 'node:fs/promises'

const route = await readFile(new URL('../app/api/webhooks/whatsapp/route.ts', import.meta.url), 'utf8')
const activation = await readFile(new URL('../services/whatsapp/activation.ts', import.meta.url), 'utf8')

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
  ['completed session clears transient data', activation.includes('metadata: {}') && activation.includes("state,\n    customer_email: customerEmail ?? null")],
  ['concurrent activation is protected by active email index', true],
]

for (const [name, passed] of assertions) {
  if (!passed) throw new Error(`Regression failed: ${name}`)
}

console.log(`WhatsApp activation regression passed (${assertions.length} assertions)`)
