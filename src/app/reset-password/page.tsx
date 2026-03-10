'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, CalendarDays, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError("Passwords don't match. Make sure both fields are identical.")
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setTimeout(() => router.push('/auth'), 1600)
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 py-10">
      <div className="absolute -right-32 -top-32 h-[400px] w-[400px] rounded-full bg-primary/[0.02] blur-[100px]" />
      <div className="absolute -bottom-32 -left-32 h-[300px] w-[300px] rounded-full bg-accent/[0.02] blur-[80px]" />
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(13, 23, 38, 0.7) 0.3px, transparent 0.3px)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="fade-up relative z-10 w-full max-w-[400px]">
        <div className="mb-10 flex flex-col items-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-primary/15 bg-primary/10">
            <CalendarDays className="h-5 w-5 text-primary" />
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">Teamwise</span>
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Team Scheduling Hub
          </span>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card/60 p-7 pb-6 shadow-sm backdrop-blur-sm">
          {success ? (
            <div className="py-4 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-primary" />
              <h2
                className="text-xl font-bold text-foreground"
                style={{ fontFamily: 'var(--font-plus-jakarta), DM Sans, sans-serif' }}
              >
                Password updated
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">Redirecting to sign in...</p>
            </div>
          ) : (
            <>
              <h2
                className="text-[1.6rem] font-bold leading-snug tracking-tight text-foreground"
                style={{ fontFamily: 'var(--font-plus-jakarta), DM Sans, sans-serif' }}
              >
                Set a new password
              </h2>
              <p className="mb-6 mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
                Enter your new password below. Make sure it is at least 6 characters.
              </p>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-[13px] font-medium text-foreground/70">
                    New password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="********"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="h-11 rounded-lg border-border/70 bg-background/80 text-sm placeholder:text-muted-foreground/40 shadow-sm focus:border-primary/30 focus:ring-2 focus:ring-primary/15"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="confirmPassword"
                    className="text-[13px] font-medium text-foreground/70"
                  >
                    Confirm password
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="********"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="h-11 rounded-lg border-border/70 bg-background/80 text-sm placeholder:text-muted-foreground/40 shadow-sm focus:border-primary/30 focus:ring-2 focus:ring-primary/15"
                  />
                </div>

                {error && (
                  <p className="rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-sm text-[var(--error-text)]">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  className="mt-1 h-11 w-full gap-2 rounded-lg text-sm font-semibold"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Reset password
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </Button>
              </form>
            </>
          )}
        </div>

        <div className="mt-6 flex items-center justify-center gap-1.5 text-muted-foreground/50">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span className="text-[11px] font-medium">Secured & encrypted</span>
        </div>
      </div>
    </main>
  )
}
