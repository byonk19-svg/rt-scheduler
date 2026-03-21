'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  ArrowRight,
  ArrowRightLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'

const WEEK_DAYS = [
  { d: 'S', n: 9, staff: 4, status: 'filled' as const },
  { d: 'M', n: 10, staff: 6, status: 'filled' as const },
  { d: 'T', n: 11, staff: 5, status: 'filled' as const },
  { d: 'W', n: 12, staff: 6, status: 'today' as const },
  { d: 'T', n: 13, staff: 3, status: 'warning' as const },
  { d: 'F', n: 14, staff: 5, status: 'filled' as const },
  { d: 'S', n: 15, staff: 0, status: 'empty' as const },
]

function toFriendlyLoginError(message: string): string {
  const normalized = message.toLowerCase()
  if (normalized.includes('invalid login credentials')) {
    return 'Email or password is incorrect. Check both fields and try again.'
  }
  if (normalized.includes('email not confirmed')) {
    return 'Check your email for the confirmation link, then try signing in again.'
  }
  return message
}

function toFriendlySignupError(message: string): string {
  const normalized = message.toLowerCase()
  if (normalized.includes('user already registered')) {
    return 'An account with this email already exists. Sign in instead.'
  }
  if (normalized.includes('password')) {
    return 'Password must meet security requirements. Use at least 8 characters.'
  }
  return message
}

function toFriendlyQueryError(code: string | null): string | null {
  if (code === 'account_inactive') {
    return 'This account no longer has app access. Contact your manager if you need to be reactivated.'
  }

  if (code === 'auth_callback_failed') {
    return 'We could not complete sign-in. Try again.'
  }

  return null
}

export default function HomePage() {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = useMemo(() => createClient(), [])
  const startsInSignupMode = pathname === '/signup'

  const [isLogin, setIsLogin] = useState(!startsInSignupMode)
  const [isForgot, setIsForgot] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<'manager' | 'therapist'>('therapist')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== 'undefined' ? window.location.origin : undefined)
  const authCallbackUrl = baseUrl ? `${baseUrl}/auth/callback` : undefined
  const resetPasswordUrl = baseUrl ? `${baseUrl}/reset-password` : undefined

  useEffect(() => {
    if (typeof window === 'undefined') return
    const queryError = toFriendlyQueryError(
      new URLSearchParams(window.location.search).get('error')
    )
    if (queryError) {
      setError(queryError)
      setMessage(null)
    }
  }, [])

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: resetPasswordUrl,
    })

    if (resetError) {
      setError(resetError.message)
      setLoading(false)
      return
    }

    setMessage('Check your email. We sent a password reset link.')
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    if (isLogin) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

      if (signInError) {
        setError(toFriendlyLoginError(signInError.message))
        setLoading(false)
        return
      }

      router.push('/dashboard?success=signed_in')
      router.refresh()
      return
    }

    const fullName = `${firstName} ${lastName}`.trim()
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: authCallbackUrl,
        data: {
          full_name: fullName,
          phone_number: phone,
          role,
          shift_type: 'day',
        },
      },
    })

    if (signUpError) {
      setError(toFriendlySignupError(signUpError.message))
      setLoading(false)
      return
    }

    router.push('/pending-setup?success=access_requested')
    router.refresh()
  }

  return (
    <main className="flex h-screen overflow-hidden">
      <section className="relative hidden flex-col overflow-hidden bg-sidebar lg:flex lg:w-[52%]">
        <div className="absolute inset-0">
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 80% 60% at 20% 0%, hsl(187 55% 32% / 0.4), transparent 65%), radial-gradient(ellipse 50% 50% at 80% 100%, hsl(38 90% 55% / 0.05), transparent 65%), linear-gradient(175deg, hsl(192 48% 17%) 0%, hsl(192 48% 11%) 100%)',
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'radial-gradient(circle, hsl(0 0% 100%) 0.5px, transparent 0.5px)',
              backgroundSize: '20px 20px',
            }}
          />
          <div className="absolute left-[3%] top-[8%] h-96 w-96 rounded-full bg-sidebar-ring/6 blur-[120px]" />
          <div className="absolute bottom-[10%] right-[8%] h-72 w-72 rounded-full bg-primary/8 blur-[100px]" />
        </div>

        <div className="relative z-10 flex h-full flex-col px-10 py-10 xl:px-14">
          <div className="fade-up flex items-center gap-3" style={{ animationDelay: '0.1s' }}>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-sidebar-ring/25 bg-sidebar-ring/15">
              <CalendarDays className="h-4 w-4 text-sidebar-ring" />
            </div>
            <span className="font-heading text-[15px] font-bold tracking-tight text-sidebar-primary/90">
              Teamwise
            </span>
          </div>

          <div className="mb-8 mt-12 max-w-[380px]">
            <p
              className="fade-up mb-4 text-[10px] font-bold uppercase tracking-[0.25em] text-sidebar-ring/70"
              style={{ animationDelay: '0.15s' }}
            >
              Team Scheduling Hub
            </p>
            <h1
              className="fade-up font-heading text-[1.55rem] font-bold leading-[1.2] tracking-tight text-sidebar-primary/80 xl:text-[1.7rem]"
              style={{
                animationDelay: '0.22s',
              }}
            >
              Scheduling, availability, and
              <br />
              coverage - <span className="text-sidebar-ring">in sync.</span>
            </h1>
            <p
              className="fade-up mt-3 text-[13px] leading-relaxed text-sidebar-primary/30"
              style={{ animationDelay: '0.28s' }}
            >
              Built for the teams that keep things running.
            </p>
          </div>

          <div className="fade-up flex min-h-0 flex-1 flex-col" style={{ animationDelay: '0.34s' }}>
            <div className="relative flex min-h-0 flex-1 flex-col">
              <div className="absolute -inset-4 rounded-[28px] bg-sidebar-ring/[0.04] blur-2xl" />

              <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/[0.1] bg-white/[0.07] shadow-2xl shadow-black/25 backdrop-blur-xl">
                <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.06] bg-white/[0.03] px-4 py-2.5">
                  <div className="flex gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-red-400/30" />
                    <div className="h-2 w-2 rounded-full bg-yellow-400/30" />
                    <div className="h-2 w-2 rounded-full bg-green-400/30" />
                  </div>
                  <div className="flex flex-1 justify-center">
                    <div className="flex h-5 w-40 items-center justify-center rounded-md bg-white/[0.05]">
                      <span className="text-[9px] font-medium tracking-wide text-sidebar-primary/30">
                        teamwise / schedule
                      </span>
                    </div>
                  </div>
                  <div className="w-10" />
                </div>

                <div className="flex-1 space-y-3 overflow-hidden p-4 xl:p-5">
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { icon: Users, label: 'On Shift', val: '6', color: 'text-sidebar-ring' },
                      { icon: ArrowRightLeft, label: 'Swaps', val: '2', color: 'text-blue-300' },
                      {
                        icon: TrendingUp,
                        label: 'Coverage',
                        val: '92%',
                        color: 'text-emerald-300',
                      },
                      { icon: Clock, label: 'Open Slots', val: '3', color: 'text-amber-300' },
                    ].map((metric) => (
                      <div
                        key={metric.label}
                        className="rounded-lg border border-white/[0.07] bg-white/[0.05] px-3 py-2.5"
                      >
                        <metric.icon className="mb-1.5 h-3.5 w-3.5 text-sidebar-primary/25" />
                        <p className={`text-lg font-bold leading-none ${metric.color}`}>
                          {metric.val}
                        </p>
                        <p className="mt-1 text-[9px] font-medium text-sidebar-primary/35">
                          {metric.label}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-lg border border-white/[0.07] bg-white/[0.04] p-3.5">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-sidebar-primary/35">
                        This Week
                      </span>
                      <span className="rounded-full bg-sidebar-ring/10 px-2 py-0.5 text-[9px] font-semibold text-sidebar-ring/70">
                        Mar 9 - 15
                      </span>
                    </div>
                    <div className="grid grid-cols-7 gap-1.5">
                      {WEEK_DAYS.map((cell, i) => (
                        <div key={i} className="text-center">
                          <span className="mb-1 block text-[8px] font-semibold text-sidebar-primary/25">
                            {cell.d}
                          </span>
                          <div
                            className={`flex h-11 flex-col items-center justify-center gap-1 rounded-lg border transition-all ${
                              cell.status === 'today'
                                ? 'border-sidebar-ring/40 bg-sidebar-ring/20 ring-1 ring-sidebar-ring/25 shadow-sm shadow-sidebar-ring/10'
                                : cell.status === 'warning'
                                  ? 'border-amber-400/20 bg-amber-400/10'
                                  : cell.status === 'empty'
                                    ? 'border-white/[0.04] bg-white/[0.015]'
                                    : 'border-white/[0.08] bg-white/[0.05]'
                            }`}
                          >
                            <span
                              className={`text-[11px] font-bold leading-none ${
                                cell.status === 'today'
                                  ? 'text-sidebar-ring'
                                  : cell.status === 'warning'
                                    ? 'text-amber-300/80'
                                    : cell.status === 'empty'
                                      ? 'text-sidebar-primary/15'
                                      : 'text-sidebar-primary/55'
                              }`}
                            >
                              {cell.n}
                            </span>
                            {cell.staff > 0 && (
                              <span
                                className={`text-[7px] font-medium ${
                                  cell.status === 'today'
                                    ? 'text-sidebar-ring/70'
                                    : cell.status === 'warning'
                                      ? 'text-amber-300/50'
                                      : 'text-sidebar-primary/25'
                                }`}
                              >
                                {cell.staff} staff
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2.5 rounded-lg border border-white/[0.07] bg-white/[0.04] px-3 py-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-400/15">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300/80" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[10px] font-semibold text-sidebar-primary/50">
                          Swap approved
                        </p>
                        <p className="text-[8px] text-sidebar-primary/25">Mon to Wed shift</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 rounded-lg border border-white/[0.07] bg-white/[0.04] px-3 py-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-400/12">
                        <CalendarDays className="h-3.5 w-3.5 text-blue-300/70" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[10px] font-semibold text-sidebar-primary/50">
                          Draft published
                        </p>
                        <p className="text-[8px] text-sidebar-primary/25">Week of Mar 16</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative flex flex-1 flex-col overflow-y-auto bg-background">
        <div className="absolute bottom-0 left-0 top-0 hidden w-px bg-gradient-to-b from-border/0 via-border/60 to-border/0 lg:block" />
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

        <div className="flex flex-1 items-center justify-center px-8 py-10 sm:px-12">
          <div
            className="fade-up relative z-10 w-full max-w-[400px]"
            style={{ animationDelay: '0.15s' }}
          >
            <div className="mb-10 flex flex-col items-center lg:hidden">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-primary/15 bg-primary/10">
                <CalendarDays className="h-5 w-5 text-primary" />
              </div>
              <span className="text-xl font-bold tracking-tight text-foreground">Teamwise</span>
              <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Team Scheduling Hub
              </span>
            </div>

            <div className="rounded-2xl border border-border/50 bg-card/60 p-7 pb-6 shadow-sm backdrop-blur-sm">
              <p className="mb-2.5 hidden text-[10px] font-bold uppercase tracking-[0.2em] text-primary/60 lg:block">
                Team Scheduling Hub
              </p>

              <h2 className="font-heading text-[1.6rem] font-bold leading-snug tracking-tight text-foreground">
                {isForgot
                  ? 'Reset your password'
                  : isLogin
                    ? 'Access your Teamwise workspace'
                    : 'Create your employee account'}
              </h2>
              <p className="mb-6 mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
                {isForgot
                  ? "Enter your email and we'll send you a link to reset your password."
                  : isLogin
                    ? 'Sign in to view your schedule, manage availability, and coordinate with your team.'
                    : 'Set up your account to access schedules, shifts, and team coordination tools.'}
              </p>

              {message && (
                <p className="mb-3 rounded-md border border-[var(--success-border)] bg-[var(--success-subtle)] px-3 py-2 text-sm text-[var(--success-text)]">
                  {message}
                </p>
              )}
              {error && (
                <p className="mb-3 rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-sm text-[var(--error-text)]">
                  {error}
                </p>
              )}

              {isForgot ? (
                <form onSubmit={handleForgotPassword} className="space-y-3.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-[13px] font-medium text-foreground/70">
                      Email address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                      className="h-11 rounded-lg border-border/70 bg-background/80 text-sm placeholder:text-muted-foreground/40 shadow-sm focus:ring-2 focus:ring-primary/15 focus:border-primary/30 transition-all"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-11 rounded-lg text-sm font-semibold gap-2 shadow-md hover:shadow-lg hover:brightness-110 transition-all mt-1"
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Send reset link
                        <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3.5">
                  {!isLogin && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label
                            htmlFor="first_name"
                            className="text-[13px] font-medium text-foreground/70"
                          >
                            First name
                          </Label>
                          <Input
                            id="first_name"
                            placeholder="Jane"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            autoComplete="given-name"
                            required
                            className="h-11 rounded-lg border-border/70 bg-background/80 text-sm placeholder:text-muted-foreground/40 shadow-sm focus:ring-2 focus:ring-primary/15 focus:border-primary/30 transition-all"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label
                            htmlFor="last_name"
                            className="text-[13px] font-medium text-foreground/70"
                          >
                            Last name
                          </Label>
                          <Input
                            id="last_name"
                            placeholder="Smith"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            autoComplete="family-name"
                            required
                            className="h-11 rounded-lg border-border/70 bg-background/80 text-sm placeholder:text-muted-foreground/40 shadow-sm focus:ring-2 focus:ring-primary/15 focus:border-primary/30 transition-all"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label
                          htmlFor="phone"
                          className="text-[13px] font-medium text-foreground/70"
                        >
                          Phone number
                        </Label>
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="(555) 123-4567"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          autoComplete="tel"
                          className="h-11 rounded-lg border-border/70 bg-background/80 text-sm placeholder:text-muted-foreground/40 shadow-sm focus:ring-2 focus:ring-primary/15 focus:border-primary/30 transition-all"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label
                          htmlFor="role"
                          className="text-[13px] font-medium text-foreground/70"
                        >
                          Your role
                        </Label>
                        <select
                          id="role"
                          value={role}
                          onChange={(e) => setRole(e.target.value as 'manager' | 'therapist')}
                          className="h-11 w-full rounded-lg border border-border/70 bg-background/80 px-3 text-sm shadow-sm outline-none transition-all focus:border-primary/30 focus:ring-2 focus:ring-primary/15"
                        >
                          <option value="therapist">Therapist / Staff</option>
                          <option value="manager">Manager</option>
                        </select>
                      </div>
                    </>
                  )}

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="email_main"
                      className="text-[13px] font-medium text-foreground/70"
                    >
                      Email address
                    </Label>
                    <Input
                      id="email_main"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                      className="h-11 rounded-lg border-border/70 bg-background/80 text-sm placeholder:text-muted-foreground/40 shadow-sm focus:ring-2 focus:ring-primary/15 focus:border-primary/30 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="password_main"
                        className="text-[13px] font-medium text-foreground/70"
                      >
                        Password
                      </Label>
                      {isLogin && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsForgot(true)
                            setError(null)
                            setMessage(null)
                          }}
                          className="text-[12px] font-medium text-primary/70 transition-colors hover:text-primary"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <Input
                      id="password_main"
                      type="password"
                      placeholder="********"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={isLogin ? 'current-password' : 'new-password'}
                      required
                      minLength={6}
                      className="h-11 rounded-lg border-border/70 bg-background/80 text-sm placeholder:text-muted-foreground/40 shadow-sm focus:ring-2 focus:ring-primary/15 focus:border-primary/30 transition-all"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 rounded-lg text-sm font-semibold gap-2 shadow-md hover:shadow-lg hover:brightness-110 transition-all mt-1"
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        {isLogin ? 'Sign in' : 'Create account'}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </Button>
                </form>
              )}

              <div className="mt-5 border-t border-border/40 pt-4 text-center">
                <p className="text-[13px] text-muted-foreground">
                  {isForgot ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgot(false)
                        setError(null)
                        setMessage(null)
                      }}
                      className="font-semibold text-primary transition-colors hover:text-primary/80"
                    >
                      Back to sign in
                    </button>
                  ) : (
                    <>
                      {isLogin ? 'Need access? ' : 'Already have an account? '}
                      <button
                        type="button"
                        onClick={() => {
                          setIsLogin((current) => !current)
                          setIsForgot(false)
                          setError(null)
                          setMessage(null)
                        }}
                        className="font-semibold text-primary transition-colors hover:text-primary/80"
                      >
                        {isLogin ? 'Create your employee account' : 'Sign in instead'}
                      </button>
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-center gap-1.5 text-muted-foreground/50">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span className="text-[11px] font-medium">Secured & encrypted</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
