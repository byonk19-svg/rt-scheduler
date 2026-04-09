'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

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
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-10">
      <section className="w-full rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
        <h1 className="app-page-title text-3xl">Create your account</h1>
        <p className="mt-1 text-sm text-foreground/80">
          Create your account to access schedules, availability, and open shifts.
        </p>
        <p className="mt-1 text-xs text-foreground/70">
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

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
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

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  )
}
