import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { eventIdFromPayload, getWebhookAdminClient, isActiveEvent, isInactiveEvent, isKiwifyConfigured, normalizeEventType, payloadString } from '@/services/subscription-access'

function validSignature(request: Request, raw: string) {
  const secret = process.env.KIWIFY_WEBHOOK_SECRET
  if (!secret) return false
  const received = request.headers.get('x-kiwify-signature') || request.headers.get('x-webhook-signature')
  if (!received) return false
  const expected = createHash('sha256').update(`${secret}.${raw}`).digest('hex')
  const a = Buffer.from(received)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: Request) {
  if (!isKiwifyConfigured()) return NextResponse.json({ ok: true }, { status: 202 })
  const raw = await request.text()
  if (!validSignature(request, raw)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  let payload: Record<string, unknown>
  try { payload = JSON.parse(raw) as Record<string, unknown> } catch { return NextResponse.json({ error: 'invalid_payload' }, { status: 400 }) }
  const eventId = eventIdFromPayload(payload)
  if (!eventId) return NextResponse.json({ error: 'event_id_required' }, { status: 400 })
  const eventType = normalizeEventType(payload)
  const admin = await getWebhookAdminClient()
  if (!admin) return NextResponse.json({ error: 'webhook_not_ready' }, { status: 503 })
  const { error: eventError } = await admin.from('subscription_events').insert({ event_id: eventId, kiwify_order_id: payloadString(payload, 'order_id', 'order.id', 'data.order_id'), event_type: eventType, payload_hash: createHash('sha256').update(raw).digest('hex') })
  if (eventError?.code === '23505') return NextResponse.json({ ok: true, duplicate: true })
  if (eventError) return NextResponse.json({ error: 'event_persist_failed' }, { status: 500 })
  if (!isActiveEvent(eventType) && !isInactiveEvent(eventType)) return NextResponse.json({ ok: true, ignored: true })
  const email = payloadString(payload, 'customer_email', 'customer.email', 'data.customer_email', 'data.customer.email')
  if (!email) return NextResponse.json({ error: 'customer_email_required' }, { status: 400 })
  const orderId = payloadString(payload, 'order_id', 'order.id', 'data.order_id', 'data.order.id')
  const customerId = payloadString(payload, 'customer_id', 'customer.id', 'data.customer_id', 'data.customer.id')
  const productId = payloadString(payload, 'product_id', 'product.id', 'data.product_id', 'data.product.id')
  const subscription = { customer_email: email.toLowerCase(), kiwify_customer_id: customerId, kiwify_order_id: orderId, product_id: productId, plan: 'kevo', status: isActiveEvent(eventType) ? 'active' : 'inactive', purchased_at: isActiveEvent(eventType) ? new Date().toISOString() : undefined, updated_at: new Date().toISOString() }
  const existingQuery = orderId ? await admin.from('subscriptions').select('id').eq('kiwify_order_id', orderId).limit(1).maybeSingle() : { data: null, error: null }
  if (existingQuery.error) return NextResponse.json({ error: 'subscription_lookup_failed' }, { status: 500 })
  const result = existingQuery.data ? await admin.from('subscriptions').update(subscription).eq('id', existingQuery.data.id) : await admin.from('subscriptions').insert(subscription)
  if (result.error) return NextResponse.json({ error: 'subscription_persist_failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
