'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AuthHeader, AuthLink, KevoAuthShell, PrimaryAuthButton } from '@/components/auth/kevo-auth-shell'

export function AccessUnavailable() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  async function signOut() { setLoading(true); await createClient().auth.signOut(); router.push('/auth/login') }
  return <KevoAuthShell eyebrow="Seu acesso KEVO"><AuthHeader title="Seu acesso à KEVO não está ativo." description="Encontramos sua conta, mas não há um acesso ativo associado a ela no momento." /><div className="space-y-3"><button type="button" onClick={() => router.refresh()} className="kevo-auth-cta inline-flex h-[50px] w-full items-center justify-center rounded-sm px-4 text-sm font-semibold text-primary-foreground">Verificar novamente</button><a href="mailto:suporte@kevo.app" className="inline-flex h-11 w-full items-center justify-center rounded-sm border border-border bg-card/40 text-sm font-semibold text-foreground transition-colors hover:border-primary/60">Falar com suporte</a></div><div className="mt-7"><button type="button" onClick={signOut} disabled={loading} className="text-sm text-muted-foreground hover:text-foreground">{loading ? 'Saindo…' : 'Sair da conta'}</button></div><div className="mt-4"><AuthLink href="/auth/activate">Ativar minha conta</AuthLink></div></KevoAuthShell>
}
