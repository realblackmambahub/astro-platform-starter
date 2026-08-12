import { createClient } from '@/lib/supabase/server'

export type AccessResult = { authenticated: boolean; active: boolean; plan: string | null }

export async function getCommercialAccess(): Promise<AccessResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { authenticated: false, active: false, plan: null }

  const { data } = await supabase
    .from('subscriptions')
    .select('plan,status,expires_at')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const active = Boolean(data && (!data.expires_at || new Date(data.expires_at).getTime() > Date.now()))
  return { authenticated: true, active, plan: active ? data.plan : null }
}

export async function getWebhookAdminClient() {
  const { createClient: createAdminClient } = await import('@supabase/supabase-js')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!key) return null
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export function isKiwifyConfigured() {
  return Boolean(process.env.KIWIFY_WEBHOOK_SECRET)
}

export function eventIdFromPayload(payload: Record<string, unknown>) {
  const value = payload.event_id ?? payload.id ?? payload.eventId
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function normalizeEventType(payload: Record<string, unknown>) {
  const value = payload.event_type ?? payload.event ?? payload.type
  return typeof value === 'string' ? value.toLowerCase() : 'unknown'
}

export function isActiveEvent(type: string) {
  return ['order.approved', 'order.paid', 'purchase.approved', 'paid', 'subscription.active'].includes(type)
}

export function isInactiveEvent(type: string) {
  return ['order.refunded', 'order.chargeback', 'order.canceled', 'order.cancelled', 'subscription.expired', 'subscription.canceled'].includes(type)
}

export function payloadString(payload: Record<string, unknown>, ...paths: string[]) {
  for (const path of paths) {
    const value = path.split('.').reduce<unknown>((current, key) => (current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined), payload)
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}
