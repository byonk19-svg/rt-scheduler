'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { CalendarDays, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const supabase = useMemo(() => createClient(), [])

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    setSuccessMessage(null)

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof window !== 'undefined' ? window.location.origin : undefined)
    const redirectTo = baseUrl ? `${baseUrl}/reset-password` : undefined

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    })
    if (resetError) {
      setError(resetError.message)
      setLoading(false)
      return
    }

    setSuccessMessage('If an account exists for that email, we’ve sent a reset link.')
    setLoading(false)
  }

  return (
    <main className="flex min-h-[calc(100vh-73px)]">
      {/* Left brand panel — desktop only */}
      <aside className="relative hidden overflow-hidden border-r border-white/[0.08] bg-[var(--marketing-hero-bg)] lg:flex lg:w-[440px] lg:shrink-0 lg:flex-col lg:justify-between lg:p-12">
        {/* subtle grid texture */}
        <div
          aria-hidden
          className="teamwise-public-grid-bg pointer-events-none absolute inset-0 opacity-[0.055]"
        />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--attention)] shadow-tw-md-soft">
            <CalendarDays className="h-5 w-5 text-accent-foreground" />
          </div>
          <div>
            <p className="font-heading text-base font-bold text-white">Teamwise</p>
            <p className="text-hero-subtle text-[0.7rem]">Respiratory Therapy</p>
          </div>
        </div>
        <div className="relative space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="h-[2.5px] w-8 shrink-0 rounded-full bg-[var(--attention)]" />
            <p className="text-hero-subtle text-[0.6rem] font-bold uppercase tracking-[0.18em]">
              Scheduling for RT teams
            </p>
          </div>
          <div className="space-y-3">
            <p className="font-display text-[2.625rem] font-normal leading-[1.08] tracking-[-0.02em] text-white">
              Scheduling that keeps care moving.
            </p>
            <p className="text-hero-muted text-sm leading-relaxed">
              Coverage planning, availability, and shift management — built for RT departments.
            </p>
          </div>
        </div>
      </aside>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-10">
        <section className="w-full max-w-[380px]">
          <h1 className="app-page-title text-3xl">Forgot your password?</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Enter your email address and we&apos;ll send you a reset link.
          </p>

          {successMessage && (
            <p
              aria-live="polite"
              className="mt-4 rounded-md border border-[var(--success-border)] bg-[var(--success-subtle)] px-3 py-2.5 text-sm text-[var(--success-text)]"
            >
              {successMessage}
            </p>
          )}

          {error && (
            <p
              aria-live="polite"
              className="mt-4 rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2.5 text-sm text-[var(--error-text)]"
            >
              {error}
            </p>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                spellCheck={false}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending reset link
                </>
              ) : (
                'Send reset link'
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Back to sign in
            </Link>
          </p>
        </section>
      </div>
    </main>
  )
}
