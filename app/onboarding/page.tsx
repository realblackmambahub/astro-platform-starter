import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Onboarding } from '@/components/kevo/onboarding'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  return <Onboarding />
}
