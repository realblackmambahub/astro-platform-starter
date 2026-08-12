import { redirect } from 'next/navigation'
import { FinancialCockpit } from '@/components/kevo/financial-cockpit'
import { SessionGuard } from '@/components/auth/session-guard'
import { AccessUnavailable } from '@/components/auth/access-unavailable'
import { createClient } from '@/lib/supabase/server'
import { getCommercialAccess } from '@/services/subscription-access'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const access = await getCommercialAccess()
  if (access.active) {
    const { data: profile } = await supabase.from('profiles').select('onboarding_completed, onboarding_skipped').eq('id', user.id).maybeSingle()
    if (profile && !profile.onboarding_completed && !profile.onboarding_skipped) redirect('/onboarding')
  }
  return <SessionGuard>{access.active ? <FinancialCockpit /> : <AccessUnavailable />}</SessionGuard>
}
