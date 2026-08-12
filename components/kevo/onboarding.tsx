'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

const steps = [
  { title: 'Como você organiza sua vida financeira?', options: ['Individual', 'Família', 'Profissional'] },
  { title: 'O que você quer acompanhar primeiro?', options: ['Gastos', 'Metas', 'Contas a pagar'] },
  { title: 'Como prefere visualizar seu workspace?', options: ['Mais objetivo', 'Mais detalhado', 'Ainda vou descobrir'] },
]

export function Onboarding() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<string[]>([])
  const [selected, setSelected] = useState('')
  const current = steps[step]
  const finish = async (skipped = false) => {
    const supabase = createClient()
    await supabase.from('profiles').update({ onboarding_completed: !skipped, onboarding_skipped: skipped, preferences: { focus: answers[1], style: answers[2], context: answers[0] } }).eq('id', (await supabase.auth.getUser()).data.user?.id ?? '')
    router.replace('/')
  }
  const next = () => {
    if (!selected) return
    const nextAnswers = [...answers, selected]
    if (step === steps.length - 1) return void finish(false)
    setAnswers(nextAnswers); setSelected(''); setStep(step + 1)
  }
  return <main className="min-h-screen bg-background px-5 py-8 text-foreground sm:px-10"><div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col justify-between"><div className="flex items-center justify-between"><div className="text-xl font-semibold tracking-tight">KEVO<span className="text-primary">.</span></div><button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => void finish(true)}>Pular por agora</button></div><section className="mx-auto w-full max-w-xl"><div className="mb-10 flex items-center gap-2">{steps.map((item, index) => <div key={item.title} className={`h-1 flex-1 ${index <= step ? 'bg-primary' : 'bg-muted'}`} />)}</div><div className="mb-3 text-[10px] uppercase tracking-[0.18em] text-primary">Primeiros passos · {step + 1} de {steps.length}</div><h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{current.title}</h1><div className="mt-8 grid gap-3">{current.options.map((option) => <button key={option} onClick={() => setSelected(option)} className={`flex items-center justify-between border px-4 py-4 text-left text-sm transition-colors ${selected === option ? 'border-primary bg-primary/10' : 'border-border bg-card/40 hover:border-primary/50'}`}>{option}{selected === option ? <Check className="size-4 text-primary" /> : <ArrowRight className="size-4 text-muted-foreground" />}</button>)}</div><Button className="mt-8 w-full" disabled={!selected} onClick={next}>{step === steps.length - 1 ? 'Entrar no workspace' : 'Continuar'}<ArrowRight data-icon="inline-end" /></Button></section><div className="flex items-center gap-2 text-xs text-muted-foreground"><Sparkles className="size-4 text-primary" />Seu workspace se adapta ao seu contexto.</div></div></main>
}
