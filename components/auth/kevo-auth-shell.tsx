'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'

export function KevoMark() {
  return <div className="kevo-auth-mark" aria-label="KEVO"><span>K</span></div>
}

export function KevoAuthShell({ children, eyebrow = 'Acesso seguro à sua vida financeira' }: { children: ReactNode; eyebrow?: string }) {
  return <main className="kevo-auth min-h-screen bg-background text-foreground"><div className="kevo-auth-identity"><div className="kevo-auth-grid" aria-hidden="true" /><div className="relative z-10 flex h-full flex-col justify-between gap-12 p-6 sm:p-10 lg:p-16"><div><KevoMark /><p className="mt-8 text-xs uppercase tracking-[0.24em] text-primary">{eyebrow}</p><h1 className="mt-5 max-w-xl text-balance text-4xl font-semibold leading-[1.08] tracking-[-0.04em] text-foreground sm:text-5xl lg:text-6xl">Sua vida financeira,<br /><span className="kevo-gradient-text">organizada com inteligência.</span></h1><p className="mt-6 max-w-md text-pretty text-sm leading-7 text-muted-foreground sm:text-base">Movimentações, metas, contas e decisões em um só lugar.</p></div><div className="hidden max-w-lg grid-cols-3 gap-5 md:grid"><Benefit label="Organize suas finanças" /><Benefit label="Acompanhe sua evolução" /><Benefit label="Tenha clareza para decidir" /></div><div className="kevo-flow-line hidden md:block" aria-hidden="true" /></div></div><div className="kevo-auth-panel"><div className="w-full max-w-[460px]">{children}<p className="mt-10 text-center text-[11px] tracking-wide text-muted-foreground/60">KEVO · Clareza para decidir melhor</p></div></div></main>
}

function Benefit({ label }: { label: string }) {
  return <div className="border-t border-border/70 pt-3 text-xs leading-5 text-muted-foreground"><span className="mb-3 block h-1 w-8 bg-gradient-to-r from-primary to-chart-2" />{label}</div>
}

export function AuthHeader({ title, description }: { title: string; description: string }) {
  return <div className="mb-8"><p className="mb-5 text-xs uppercase tracking-[0.22em] text-primary md:hidden">KEVO</p><h2 className="text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">{title}</h2><p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">{description}</p></div>
}

export function AuthDivider({ children }: { children: ReactNode }) {
  return <div className="mt-8 border-t border-border/70 pt-7 text-center">{children}</div>
}

export function AuthLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">{children}</Link>
}

export function AuthField({ label, name, type = 'text', value, onChange, placeholder, autoComplete, passwordToggle, onTogglePassword, error }: { label: string; name: string; type?: string; value: string; onChange: (value: string) => void; placeholder?: string; autoComplete?: string; passwordToggle?: boolean; onTogglePassword?: () => void; error?: string }) {
  return <div className="space-y-2"><label htmlFor={name} className="block text-xs font-medium tracking-wide text-foreground/80">{label}</label><div className="relative"><input id={name} name={name} type={type} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} autoComplete={autoComplete} aria-invalid={Boolean(error)} className="kevo-auth-input w-full rounded-sm border border-border bg-card/60 px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/50 focus:border-primary/80 focus:ring-2 focus:ring-primary/15" />{passwordToggle && <button type="button" onClick={onTogglePassword} className="absolute inset-y-0 right-3 text-xs text-muted-foreground transition-colors hover:text-foreground" aria-label={type === 'password' ? 'Mostrar senha' : 'Ocultar senha'}>{type === 'password' ? 'Mostrar' : 'Ocultar'}</button>}</div>{error && <p className="text-xs text-destructive" role="alert">{error}</p>}</div>
}

export function PrimaryAuthButton({ children, loading }: { children: ReactNode; loading?: boolean }) {
  return <button disabled={loading} className="kevo-auth-cta inline-flex h-[50px] w-full items-center justify-center rounded-sm px-4 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-px disabled:cursor-wait disabled:opacity-60">{loading ? 'Aguarde…' : children}</button>
}
