import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCommercialAccess, isKiwifyConfigured } from '@/services/subscription-access'
import { AuthHeader, KevoAuthShell } from '@/components/auth/kevo-auth-shell'

export default async function ActivatePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?next=%2Fauth%2Factivate')
  const access = await getCommercialAccess()
  return <KevoAuthShell eyebrow="Primeiro acesso à KEVO"><AuthHeader title="Vamos ativar sua KEVO." description="Informe o mesmo e-mail utilizado na sua compra." />{access.active ? <><p className="border border-primary/30 bg-primary/5 p-4 text-sm leading-6" role="status">Seu acesso já está ativo. Você pode entrar no seu workspace.</p><Link href="/" className="kevo-auth-cta mt-6 inline-flex h-[50px] w-full items-center justify-center rounded-sm text-sm font-semibold text-primary-foreground">Entrar na KEVO</Link></> : <><p className="text-sm leading-6 text-muted-foreground">{isKiwifyConfigured() ? 'Se este e-mail estiver associado a um acesso KEVO válido, enviaremos as instruções para você.' : 'A ativação estará disponível assim que seu acesso for confirmado.'}</p><Link href="/auth/login" className="mt-7 inline-flex h-11 w-full items-center justify-center rounded-sm border border-border bg-card/40 text-sm font-semibold hover:border-primary/60">Voltar para entrar</Link></>}</KevoAuthShell>
}
