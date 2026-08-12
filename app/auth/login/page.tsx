'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AuthDivider, AuthField, AuthHeader, AuthLink, KevoAuthShell, PrimaryAuthButton } from '@/components/auth/kevo-auth-shell'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    let active = true
    void createClient().auth.getUser().then(({ data }) => {
      if (!active) return
      if (data.user) router.replace('/')
      else setCheckingSession(false)
    })
    return () => { active = false }
  }, [router])

  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError('')
    const { error: authError } = await createClient().auth.signInWithPassword({ email, password })
    if (authError) { setError('E-mail ou senha incorretos.'); setLoading(false); return }
    router.push('/')
  }

  if (checkingSession) return <main className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Verificando seu acesso…</main>
  return <KevoAuthShell><AuthHeader title="Bem-vindo de volta." description="Entre com o e-mail utilizado na sua compra." /><form onSubmit={submit} className="space-y-5"><AuthField label="E-mail" name="email" type="email" value={email} onChange={setEmail} placeholder="seu@email.com" autoComplete="email" /><AuthField label="Senha" name="password" type={showPassword ? 'text' : 'password'} value={password} onChange={setPassword} placeholder="Sua senha" autoComplete="current-password" passwordToggle onTogglePassword={() => setShowPassword(value => !value)} error={error} /><div className="-mt-1 text-right"><AuthLink href="/auth/forgot-password">Esqueci minha senha</AuthLink></div><PrimaryAuthButton loading={loading}>Entrar na KEVO</PrimaryAuthButton></form><AuthDivider><p className="text-sm text-muted-foreground">Primeiro acesso à KEVO?</p><Link href="/auth/activate" className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-sm border border-border bg-card/40 text-sm font-semibold text-foreground transition-colors hover:border-primary/60 hover:bg-card">Ativar minha conta</Link><p className="mt-3 text-xs text-muted-foreground/70">Use o mesmo e-mail informado na sua compra.</p></AuthDivider></KevoAuthShell>
}
