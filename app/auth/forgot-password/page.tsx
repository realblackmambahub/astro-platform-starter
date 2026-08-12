'use client'

import { FormEvent, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AuthField, AuthHeader, AuthLink, KevoAuthShell, PrimaryAuthButton } from '@/components/auth/kevo-auth-shell'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  async function submit(event: FormEvent) { event.preventDefault(); setLoading(true); await createClient().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/update-password` }); setSent(true); setLoading(false) }
  return <KevoAuthShell eyebrow="Recupere seu acesso"><AuthHeader title="Recupere seu acesso." description="Informe seu e-mail para receber as instruções de redefinição." />{sent ? <p className="border border-primary/30 bg-primary/5 p-4 text-sm leading-6 text-foreground" role="status">Se este e-mail estiver associado a um acesso KEVO válido, enviaremos as instruções para você.</p> : <form onSubmit={submit} className="space-y-5"><AuthField label="E-mail" name="email" type="email" value={email} onChange={setEmail} placeholder="seu@email.com" autoComplete="email" /><PrimaryAuthButton loading={loading}>Enviar instruções</PrimaryAuthButton></form>}<div className="mt-7"><AuthLink href="/auth/login">Voltar para entrar</AuthLink></div></KevoAuthShell>
}
