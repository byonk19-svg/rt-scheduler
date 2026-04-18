'use client'

import Link from 'next/link'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  Eye,
  EyeOff,
  Info,
  Loader2,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  buildCleanedLoginSearchParams,
  extractAuthErrorFromSearchParams,
  isLoginApprovalBannerMessage,
  sanitizeRedirectTo,
} from '@/lib/auth/login-utils'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const AUTH_REQUEST_TIMEOUT_MS = 10000

const POST_SIGNUP_ACK_MESSAGE =
  'Request submitted. Your manager must approve access before you can sign in.'
const POST_MATCHED_ACK_MESSAGE = 'Your account is ready. Sign in to get started.'

function toFriendlyAuthError(message: string): string {
  const normalized = message.toLowerCase()
  if (normalized.includes('invalid login credentials') || normalized.includes('invalid')) {
    return 'Incorrect email or password.'
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

function LoginPageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
    </div>
  )
}

function LoginPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [urlAuthMessage, setUrlAuthMessage] = useState<string | null>(null)
  /** When equal to the current `displayError`, the user dismissed that alert (cleared on submit). */
  const [dismissedMessageKey, setDismissedMessageKey] = useState<string | null>(null)
  const [postSignupBanner, setPostSignupBanner] = useState<string | null>(null)
  const [dismissedPostSignupKey, setDismissedPostSignupKey] = useState<string | null>(null)
  const [capsLockOn, setCapsLockOn] = useState(false)

  const extraction = useMemo(
    () => extractAuthErrorFromSearchParams(new URLSearchParams(searchParams.toString())),
    [searchParams]
  )

  useEffect(() => {
    if (extraction.message) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mirror query-string auth errors into state, then strip error params via router.replace while preserving or cleaning redirectTo
      setUrlAuthMessage(extraction.message)
    }
    if (!extraction.shouldCleanUrl) return

    const cleanedRedirectArg = searchParams.has('redirectTo')
      ? extraction.cleanedRedirectTo
      : undefined
    const next = buildCleanedLoginSearchParams(
      new URLSearchParams(searchParams.toString()),
      cleanedRedirectArg
    )
    next.delete('status')
    const qs = next.toString()
    router.replace(qs ? `/login?${qs}` : '/login', { scroll: false })
  }, [extraction, router, searchParams])

  useEffect(() => {
    const status = searchParams.get('status')
    if (status !== 'requested' && status !== 'matched') return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- persist post-signup acknowledgement, then strip transient status from URL (preserve redirectTo)
    setPostSignupBanner(status === 'matched' ? POST_MATCHED_ACK_MESSAGE : POST_SIGNUP_ACK_MESSAGE)
    const next = new URLSearchParams(searchParams.toString())
    next.delete('status')
    const qs = next.toString()
    router.replace(qs ? `/login?${qs}` : '/login', { scroll: false })
  }, [router, searchParams])

  const displayError = error ?? urlAuthMessage

  const showBanner = Boolean(displayError) && dismissedMessageKey !== displayError
  const approvalBanner = isLoginApprovalBannerMessage(displayError ?? '')
  const showPostSignupBanner =
    Boolean(postSignupBanner) && dismissedPostSignupKey !== postSignupBanner

  function updateCapsFromEvent(event: React.KeyboardEvent<HTMLInputElement>) {
    if (typeof event.getModifierState === 'function') {
      setCapsLockOn(event.getModifierState('CapsLock'))
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setDismissedMessageKey(null)
    setDismissedPostSignupKey(null)
    setPostSignupBanner(null)
    setUrlAuthMessage(null)
    setLoading(true)
    setError(null)

    try {
      const { error: signInError } = await withAuthTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        'Sign in'
      )
      if (signInError) {
        setError(toFriendlyAuthError(signInError.message))
        setLoading(false)
        return
      }

      const redirectTarget = sanitizeRedirectTo(searchParams.get('redirectTo')) ?? '/dashboard'
      router.push(redirectTarget)
      router.refresh()
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Could not sign in.'
      setError(toFriendlyAuthError(message))
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-[calc(100vh-73px)]">
      {/* Left brand panel — desktop only */}
      <aside className="relative hidden overflow-hidden bg-[var(--sidebar)] lg:flex lg:w-[440px] lg:shrink-0 lg:flex-col lg:justify-between lg:p-12">
        <div aria-hidden className="teamwise-auth-brand-grid absolute inset-0" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--attention)] shadow-tw-md-soft">
            <CalendarDays className="h-5 w-5 text-accent-foreground" />
          </div>
          <div>
            <p className="font-heading text-base font-bold text-sidebar-primary">Teamwise</p>
            <p className="text-[0.7rem] text-[var(--sidebar-foreground)]">Respiratory Therapy</p>
          </div>
        </div>
        <div className="relative space-y-5 border-l-[4px] border-[var(--attention)]/45 pl-6">
          <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-sidebar-primary/85">
            Scheduling for RT teams
          </p>
          <div className="space-y-3">
            <p className="font-display text-[1.95rem] font-bold leading-[1.06] tracking-[-0.035em] text-sidebar-primary xl:text-[2.35rem]">
              Scheduling that keeps care moving.
            </p>
            <p className="text-sm font-medium leading-relaxed text-[var(--sidebar-foreground)]">
              Coverage planning, availability, and shift management — built for RT departments.
            </p>
          </div>
        </div>
      </aside>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-10">
        <section className="w-full max-w-[380px]">
          <h1 className="app-page-title text-3xl">Sign in</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Pick up where you left off — schedules, availability, and handoffs in one place.
          </p>

          {showPostSignupBanner && postSignupBanner && (
            <div
              role="status"
              aria-live="polite"
              className="mt-4 flex items-start gap-2 rounded-md border border-[var(--info-border)] bg-[var(--info-subtle)] px-3 py-2.5 text-sm text-[var(--info-text)] shadow-sm"
            >
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p className="min-w-0 flex-1 leading-snug">{postSignupBanner}</p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-foreground/70 hover:bg-transparent hover:text-foreground"
                aria-label="Dismiss alert"
                onClick={() => setDismissedPostSignupKey(postSignupBanner)}
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          )}

          {showBanner && (
            <div
              role="alert"
              aria-live="polite"
              className={cn(
                'mt-4 flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm shadow-sm',
                approvalBanner
                  ? 'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
                  : 'border-[var(--error-border)] bg-[var(--error-subtle)] text-[var(--error-text)]'
              )}
            >
              {approvalBanner ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              )}
              <div className="min-w-0 flex-1 space-y-1.5 leading-snug">
                <p>{displayError ?? ''}</p>
                {approvalBanner && (
                  <p>
                    <Link
                      href="/signup"
                      className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline decoration-primary/60 underline-offset-2 hover:decoration-primary"
                    >
                      Request access
                    </Link>
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-foreground/70 hover:bg-transparent hover:text-foreground"
                aria-label="Dismiss alert"
                onClick={() => setDismissedMessageKey(displayError ?? '')}
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
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
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/reset-password"
                  className="inline-flex min-h-11 items-center text-xs font-medium text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={updateCapsFromEvent}
                  onKeyUp={updateCapsFromEvent}
                  onFocus={(event) => {
                    const native = event.nativeEvent as {
                      getModifierState?: (key: string) => boolean
                    }
                    if (typeof native.getModifierState === 'function') {
                      setCapsLockOn(native.getModifierState('CapsLock'))
                    }
                  }}
                  required
                  aria-required="true"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-0 inline-flex min-h-11 min-w-11 items-center justify-center px-3 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {capsLockOn && (
                <p className="text-xs font-medium text-[var(--warning-text)]" aria-live="polite">
                  Caps Lock is on.
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>
              Need access?{' '}
              <Link
                href="/signup"
                className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline"
              >
                Request access
              </Link>
            </p>
            <p className="mt-2 text-xs font-medium leading-snug text-foreground/75">
              Manager approval required before you can use the app.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageClient />
    </Suspense>
  )
}
