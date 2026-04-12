'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Eye, EyeOff, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
              phone_number: phone,
              shift_type: 'day',
            },
          },
        }),
        'Create account'
      )

      if (signUpError) {
        setError(toFriendlySignupError(signUpError.message))
        setLoading(false)
        return
      }

      const { error: signInError } = await withAuthTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        'Sign in'
      )
      if (signInError) {
        setError(toFriendlySignupError(signInError.message))
        setLoading(false)
        return
      }

      router.push('/pending-setup?success=access_requested')
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
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--attention)]">
            <CalendarDays className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-heading text-base font-bold text-white">Teamwise</p>
            <p className="text-[0.7rem] text-[var(--sidebar-foreground)]">Respiratory Therapy</p>
          </div>
        </div>
        <div className="relative">
          <p className="font-display text-3xl font-bold leading-tight tracking-tight text-white">
            Scheduling that keeps care moving.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-[var(--sidebar-foreground)]">
            Coverage planning, availability, and shift management — built for RT departments.
          </p>
        </div>
      </aside>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-10">
        <div className="mb-6 flex items-center gap-2.5 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--attention)]">
            <CalendarDays className="h-4 w-4 text-white" />
          </div>
          <p className="font-heading text-sm font-bold text-foreground">Teamwise</p>
        </div>

        <section className="w-full max-w-[420px]">
          <h1 className="app-page-title text-3xl">Create your account</h1>
          <p className="mt-1.5 text-sm text-foreground/70">
            Access schedules, availability, and open shifts.
          </p>
          <p className="mt-1 text-xs text-foreground/50">
            After signup, your account will be reviewed before access is enabled.
          </p>

          {error && (
            <p
              aria-live="polite"
              className="mt-4 rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-sm text-[var(--error-text)]"
            >
              {error}
            </p>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
              />
            </div>

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

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
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
              <p className="text-xs text-muted-foreground">At least 8 characters</p>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account
                </>
              ) : (
                'Create account'
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
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
