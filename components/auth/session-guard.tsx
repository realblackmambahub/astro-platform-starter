'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function SessionGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let active = true

    async function verify() {
      const { data } = await supabase.auth.getUser()
      if (!active) return
      if (!data.user) {
        router.replace(`/auth/login?next=${encodeURIComponent(pathname || '/')}`)
        return
      }
      setReady(true)
    }

    void verify()
    const { data: listener } = supabase.auth.onAuthStateChange((event: Parameters<Parameters<typeof supabase.auth.onAuthStateChange>[0]>[0], session: Parameters<Parameters<typeof supabase.auth.onAuthStateChange>[0]>[1]) => {
      if (!active) return
      if (event === 'SIGNED_OUT' || !session) {
        router.replace(`/auth/login?next=${encodeURIComponent(pathname || '/')}`)
        return
      }
      setReady(true)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [pathname, router])

  if (!ready) return <main className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Verificando sua sessão…</main>
  return children
}
