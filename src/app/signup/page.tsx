'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Eye, EyeOff, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { checkNameRosterMatchAction } from '@/app/team/actions'
import { createClient } from '@/lib/supabase/client'

const AUTH_REQUEST_TIMEOUT_MS = 10000

function toFriendlySignupError(message: string): string {
  const normalized = message.toLowerCase()
  if (normalized.includes('user already registered')) {
    return 'An account with this email address already exists. Sign in instead.'
  }
  if (normalized.includes('password')) {
    return 'Password must be at least 8 characters.'
  }
  if (normalized.includes('timed out') || normalized.includes('failed to fetch')) {
    return 'We could not reach Teamwise services. Check your internet and try again.'
  }
  return message
}

async function withAuthTimeout<T>(promise: Promise<T>, actionLabel: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${actionLabel} timed out. Check your internet and try again.`))
        }, AUTH_REQUEST_TIMEOUT_MS)
      }),
    ])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

export default function SignUpPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const errLower = error?.toLowerCase() ?? ''
  const emailFieldInvalid =
    Boolean(error) &&
    (errLower.includes('email') ||
      errLower.includes('already') ||
      errLower.includes('registered') ||
      errLower.includes('exists'))
  const passwordFieldInvalid = Boolean(error) && errLower.includes('password')
  const allRequiredInvalid = Boolean(error) && !emailFieldInvalid && !passwordFieldInvalid

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const fullName = `${firstName} ${lastName}`.trim()
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof window !== 'undefined' ? window.location.origin : undefined)
    const authCallbackUrl = baseUrl ? `${baseUrl}/auth/callback` : undefined

    try {
      const { error: signUpError } = await withAuthTimeout(
        supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: authCallbackUrl,
            data: {
              full_name: fullName,
              first_name: firstName,
              last_name: lastName,
              ...(phone.trim() ? { phone_number: phone.trim() } : {}),
              shift_type: 'day',
            },
          },
        }),
        'Submit request'
      )

      if (signUpError) {
        setError(toFriendlySignupError(signUpError.message))
        setLoading(false)
        return
      }

      const rosterMatched = await checkNameRosterMatchAction(fullName)
      router.push(rosterMatched ? '/login?status=matched' : '/login?status=requested')
      router.refresh()
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : 'Could not create your account.'
      setError(toFriendlySignupError(message))
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen">
      {/* Left brand panel — desktop only */}
      <aside className="relative hidden overflow-hidden bg-[var(--sidebar)] lg:flex lg:w-[440px] lg:shrink-0 lg:flex-col lg:justify-between lg:p-12">
        <div aria-hidden className="teamwise-login-grid-bg absolute inset-0" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--attention)]">
            <CalendarDays className="h-5 w-5 text-accent-foreground" />
          </div>
          <div>
            <p className="font-heading text-base font-bold text-sidebar-primary">Teamwise</p>
            <p className="text-[0.7rem] text-[var(--sidebar-foreground)]">Respiratory Therapy</p>
          </div>
        </div>
        <div className="relative">
          <p className="font-display text-3xl font-bold leading-tight tracking-tight text-sidebar-primary">
            Scheduling that keeps care moving.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-[var(--sidebar-foreground)]">
            Coverage planning, availability, and shift management — built for RT departments.
          </p>
        </div>
      </aside>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-5 sm:py-6 lg:py-6">
        <div className="mb-4 flex items-center gap-2.5 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--attention)]">
            <CalendarDays className="h-4 w-4 text-accent-foreground" />
          </div>
          <p className="font-heading text-sm font-bold text-foreground">Teamwise</p>
        </div>

        <section className="w-full max-w-[420px]">
          <h1 className="app-page-title text-3xl">Request access</h1>
          <p className="mt-0.5 text-sm text-foreground/70">
            Access schedules, availability, and open shifts.
          </p>
          <p className="mt-1 text-xs font-medium leading-snug text-foreground/75">
            Your manager reviews requests before access is enabled.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Fields marked with * are required.</p>

          {error && (
            <p
              id="signup-form-error"
              role="alert"
              aria-live="polite"
              className="mt-2 rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-sm text-[var(--error-text)]"
            >
              {error}
            </p>
          )}

          <form onSubmit={handleSubmit} className="mt-4 space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="firstName">
                  First name{' '}
                  <span className="text-[var(--error-text)]" aria-hidden>
                    *
                  </span>
                </Label>
                <Input
                  id="firstName"
                  name="firstName"
                  type="text"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  required
                  aria-required="true"
                  aria-invalid={allRequiredInvalid ? true : undefined}
                  aria-describedby={error ? 'signup-form-error' : undefined}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lastName">
                  Last name{' '}
                  <span className="text-[var(--error-text)]" aria-hidden>
                    *
                  </span>
                </Label>
                <Input
                  id="lastName"
                  name="lastName"
                  type="text"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  required
                  aria-required="true"
                  aria-invalid={allRequiredInvalid ? true : undefined}
                  aria-describedby={error ? 'signup-form-error' : undefined}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="phone">Phone number (optional)</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="email">
                Email address{' '}
                <span className="text-[var(--error-text)]" aria-hidden>
                  *
                </span>
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                spellCheck={false}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                aria-required="true"
                aria-invalid={emailFieldInvalid || allRequiredInvalid ? true : undefined}
                aria-describedby={error ? 'signup-form-error' : undefined}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="password">
                Password{' '}
                <span className="text-[var(--error-text)]" aria-hidden>
                  *
                </span>
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  required
                  aria-required="true"
                  aria-invalid={passwordFieldInvalid || allRequiredInvalid ? true : undefined}
                  aria-describedby={error ? 'signup-form-error password-hint' : 'password-hint'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-0 inline-flex items-center px-3 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p id="password-hint" className="text-xs text-muted-foreground">
                At least 8 characters
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting request
                </>
              ) : (
                'Submit request'
              )}
            </Button>
          </form>

          <p className="mt-3.5 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </section>
      </div>
    </main>
  )
}
