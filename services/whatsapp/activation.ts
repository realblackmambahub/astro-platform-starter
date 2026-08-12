import type { SupabaseClient } from '@supabase/supabase-js'

const SESSION_TTL_MINUTES = 30

type Admin = SupabaseClient

type ActivationSession = {
  id: string
  wa_id: string
  customer_email: string | null
  state: 'awaiting_email' | 'awaiting_password' | 'completed' | 'failed' | 'expired'
  metadata: Record<string, unknown>
  expires_at: string
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isExpired(session: ActivationSession) {
  return new Date(session.expires_at).getTime() <= Date.now()
}

function safeError(error: unknown) {
  return {
    errorType: error instanceof Error ? error.name : typeof error,
    errorCode: typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code ?? 'unknown') : 'unknown',
  }
}

function activationLog(event: string, details: Record<string, unknown> = {}) {
  console.error(`[WA ACTIVATION] ${event}`, details)
}

async function getSession(admin: Admin, waId: string) {
  const { data } = await admin
    .from('whatsapp_activation_sessions')
    .select('id, wa_id, customer_email, state, metadata, expires_at')
    .eq('wa_id', waId)
    .in('state', ['awaiting_email', 'awaiting_password'])
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data as ActivationSession | null
}

async function closeSession(admin: Admin, session: ActivationSession, state: 'completed' | 'failed' | 'expired', customerEmail?: string | null) {
  await admin.from('whatsapp_activation_sessions').update({
    state,
    customer_email: customerEmail ?? null,
    metadata: {},
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', session.id).in('state', ['awaiting_email', 'awaiting_password'])
}

async function findAuthUserByEmail(admin: Admin, email: string) {
  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throw new Error('auth_lookup_failed')
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email)
    if (user) return user
    if (data.users.length < 100) break
  }
  return null
}

async function activateWithPassword(admin: Admin, session: ActivationSession, password: string) {
  activationLog('password_state_entered')
  const sessionValid = session.state === 'awaiting_password' && !isExpired(session) && Boolean(session.customer_email)
  activationLog('session_valid=' + String(sessionValid))
  const passwordPolicyValid = password.length >= 8 && password.length <= 128 && /[A-Za-z]/.test(password) && /[0-9]/.test(password)
  activationLog('password_policy_valid=' + String(passwordPolicyValid))
  if (!passwordPolicyValid) return { ok: false as const, message: 'A senha deve ter entre 8 e 128 caracteres, com pelo menos uma letra e um número. Envie outra senha.' }
  const email = session.customer_email
  if (!sessionValid || !email) return { ok: false as const, message: 'Não consegui validar o e-mail. Reinicie a ativação.' }

  const { data: subscription, error: subscriptionLookupError } = await admin
    .from('subscriptions')
    .select('id, user_id, customer_email, status, expires_at')
    .ilike('customer_email', email)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (subscriptionLookupError) {
    activationLog('subscription_lookup_error', safeError(subscriptionLookupError))
  }
  const subscriptionValid = Boolean(subscription && (!subscription.expires_at || new Date(subscription.expires_at).getTime() > Date.now()))
  activationLog('subscription_valid=' + String(subscriptionValid))
  if (!subscriptionValid || !subscription) {
    await closeSession(admin, session, 'failed')
    return { ok: false as const, message: 'Não consegui validar essa ativação. Confira o e-mail da compra.' }
  }

  let existing = null
  try {
    if (subscription.user_id) {
      const result = await admin.auth.admin.getUserById(subscription.user_id)
      if (result.error) activationLog('auth_lookup_error', safeError(result.error))
      existing = result.data.user
    } else {
      existing = await findAuthUserByEmail(admin, email)
    }
  } catch (error) {
    activationLog('auth_lookup_error', safeError(error))
  }
  activationLog('existing_auth_found=' + String(Boolean(existing)))
  if (existing?.email?.toLowerCase() !== email) {
    await closeSession(admin, session, 'failed')
    return { ok: false as const, message: 'Não foi possível validar esta ativação. Verifique os dados e tente novamente.' }
  }
  let authUser = existing
  if (!authUser) {
    activationLog('auth_create_started')
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    activationLog('auth_create_success=' + String(!created.error), created.error ? safeError(created.error) : {})
    if (created.error) {
      const recovered = await findAuthUserByEmail(admin, email)
      if (!recovered) {
        await closeSession(admin, session, 'failed')
        return { ok: false as const, message: 'Não consegui concluir a ativação agora. Tente novamente.' }
      }
      authUser = recovered
    } else {
      authUser = created.data.user
    }
  }
  if (!authUser) return { ok: false as const, message: 'Não consegui concluir a ativação agora. Tente novamente.' }

  if (existing) {
    activationLog('auth_update_started')
    const { error } = await admin.auth.admin.updateUserById(authUser.id, { password })
    activationLog('auth_update_success=' + String(!error), error ? safeError(error) : {})
    if (error) return { ok: false as const, message: 'Não consegui concluir a ativação agora. Tente novamente.' }
  }

  activationLog('profile_upsert_started')
  const { data: currentProfile, error: currentProfileError } = await admin
    .from('profiles')
    .select('id, whatsapp_phone')
    .eq('id', authUser.id)
    .maybeSingle()
  if (currentProfileError) activationLog('profile_lookup_error', safeError(currentProfileError))
  if (currentProfile?.whatsapp_phone && currentProfile.whatsapp_phone !== session.wa_id) {
    await closeSession(admin, session, 'failed')
    return { ok: false as const, message: 'Este acesso já está vinculado a outro WhatsApp. Não foi possível concluir a ativação.' }
  }

  const { data: conflictingProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('whatsapp_phone', session.wa_id)
    .neq('id', authUser.id)
    .maybeSingle()
  if (conflictingProfile) {
    await closeSession(admin, session, 'failed')
    return { ok: false as const, message: 'Não foi possível concluir esta ativação. Verifique os dados e tente novamente.' }
  }

  const { error: profileError } = await admin.from('profiles').upsert({ id: authUser.id, whatsapp_phone: session.wa_id }, { onConflict: 'id', ignoreDuplicates: false })
  activationLog('profile_upsert_success=' + String(!profileError), profileError ? safeError(profileError) : {})
  if (profileError) return { ok: false as const, message: 'Não consegui vincular este WhatsApp agora. Tente novamente.' }

  activationLog('whatsapp_link_started')
  const { data: linkedPhoneConflict } = await admin
    .from('profiles')
    .select('id')
    .eq('whatsapp_phone', session.wa_id)
    .neq('id', authUser.id)
    .maybeSingle()
  activationLog('whatsapp_link_success=' + String(!linkedPhoneConflict))
  if (linkedPhoneConflict) {
    await closeSession(admin, session, 'failed')
    return { ok: false as const, message: 'Não foi possível concluir esta ativação. Verifique os dados e tente novamente.' }
  }

  activationLog('subscription_link_started')
  const { data: linkedSubscription, error: subscriptionLinkError } = await admin
    .from('subscriptions')
    .update({ user_id: authUser.id, updated_at: new Date().toISOString() })
    .eq('id', subscription.id)
    .or(`user_id.is.null,user_id.eq.${authUser.id}`)
    .select('id, user_id')
    .maybeSingle()
  activationLog('subscription_link_success=' + String(!subscriptionLinkError && Boolean(linkedSubscription)), subscriptionLinkError ? safeError(subscriptionLinkError) : {})
  if (subscriptionLinkError || !linkedSubscription) return { ok: false as const, message: 'Não consegui concluir a ativação agora. Tente novamente.' }

  activationLog('session_complete_started')
  const { error: sessionCompleteError } = await admin.from('whatsapp_activation_sessions').update({ state: 'completed', customer_email: null, metadata: {}, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', session.id).in('state', ['awaiting_email', 'awaiting_password'])
  activationLog('session_complete_success=' + String(!sessionCompleteError), sessionCompleteError ? safeError(sessionCompleteError) : {})
  if (sessionCompleteError) return { ok: false as const, message: 'Não consegui concluir a ativação agora. Tente novamente.' }

  return { ok: true as const, userId: authUser.id }
}

export async function handleActivationMessage(admin: Admin | null, waId: string, text: string) {
  if (!admin) return { handled: false as const }
  const current = await getSession(admin, waId)
  if (current && isExpired(current)) {
    await closeSession(admin, current, 'expired')
    return { handled: true as const, reply: 'Sua ativação expirou. Envie qualquer mensagem para começar novamente.' }
  }
  if (current?.state === 'awaiting_password') {
    const { error: eventError } = await admin
      .from('whatsapp_activation_sessions')
      .update({
        metadata: { activation_password_received: true },
        updated_at: new Date().toISOString(),
      })
      .eq('id', current.id)
      .eq('state', 'awaiting_password')
    if (eventError) return { handled: true as const, reply: 'Não foi possível processar a ativação agora. Tente novamente.' }

    const result = await activateWithPassword(admin, current, text.trim())
    return { handled: true as const, reply: result.message ?? 'WhatsApp ativado. Agora suas mensagens financeiras serão registradas automaticamente.' }
  }
  if (current?.state === 'awaiting_email') {
    const email = normalizeEmail(text)
    if (!isEmail(email)) return { handled: true as const, reply: 'Envie o e-mail usado na compra para continuar a ativação.' }
    const { data: subscription } = await admin.from('subscriptions').select('id').ilike('customer_email', email).eq('status', 'active').limit(1).maybeSingle()
    if (!subscription) return { handled: true as const, reply: 'Não consegui validar esse e-mail de compra. Confira e envie novamente.' }
    const { data, error } = await admin.from('whatsapp_activation_sessions').update({ customer_email: email, state: 'awaiting_password', updated_at: new Date().toISOString() }).eq('id', current.id).eq('state', 'awaiting_email').select('id').maybeSingle()
    if (error || !data) return { handled: true as const, reply: 'Não foi possível iniciar a ativação. Tente novamente.' }
    return { handled: true as const, reply: 'E-mail validado. Agora envie uma senha com pelo menos 8 caracteres para criar seu acesso seguro.' }
  }

  const { data: created, error } = await admin.from('whatsapp_activation_sessions').insert({ wa_id: waId, state: 'awaiting_email', expires_at: new Date(Date.now() + SESSION_TTL_MINUTES * 60_000).toISOString() }).select('id').maybeSingle()
  if (error || !created) return { handled: true as const, reply: 'Não foi possível iniciar a ativação agora. Tente novamente.' }
  return { handled: true as const, reply: 'Para ativar seu WhatsApp, envie o e-mail usado na compra.' }
}
