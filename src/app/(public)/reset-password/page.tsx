'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'

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
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-10">
      <section className="w-full rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
        <h1 className="app-page-title text-3xl">Forgot your password?</h1>
        <p className="mt-1 text-sm text-foreground/80">
          Enter your email address and we’ll send you a reset link.
        </p>

        {successMessage && (
          <p
            aria-live="polite"
            className="mt-4 rounded-md border border-[var(--success-border)] bg-[var(--success-subtle)] px-3 py-2 text-sm text-[var(--success-text)]"
          >
            {successMessage}
          </p>
        )}

        {error && (
          <p
            aria-live="polite"
            className="mt-4 rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-sm text-[var(--error-text)]"
          >
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
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

        <p className="mt-5 text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </section>
    </main>
  )
}
