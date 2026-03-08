'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, Loader2 } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { FeedbackToast } from '@/components/feedback-toast'
import { TeamwiseLogo } from '@/components/teamwise-logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

const BENEFITS = [
  'Auto-generated draft schedules',
  'Drag-and-drop coverage patching',
  'Built-in lead & coverage rules',
  'Cycle-scoped availability tracking',
] as const

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

function toSafeRedirectPath(path: string | null): string | null {
  if (!path) return null
  if (!path.startsWith('/')) return null
  if (path.startsWith('//')) return null
  return path
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const redirectPath = useMemo(
    () => toSafeRedirectPath(searchParams.get('redirectTo')),
    [searchParams]
  )
  const callbackError = useMemo(() => searchParams.get('error'), [searchParams])
  const callbackErrorMessage = useMemo(() => {
    if (callbackError === 'auth_callback_failed') {
      return 'We could not complete sign-in from your email link. Please sign in again.'
    }
    return null
  }, [callbackError])

  const toastMessage = useMemo(() => {
    if (typeof window === 'undefined') return null
    const params = new URLSearchParams(window.location.search)
    const success = params.get('success')
    return success === 'signed_out' ? 'Signed out successfully.' : null
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(toFriendlyLoginError(error.message))
      setLoading(false)
      return
    }

    router.push(redirectPath ?? '/dashboard?success=signed_in')
    router.refresh()
  }

  return (
    <main className="teamwise-aurora-bg flex min-h-screen items-center justify-center p-4">
      {toastMessage && <FeedbackToast message={toastMessage} variant="success" />}
      <Card className="w-full max-w-4xl overflow-hidden p-0 shadow-lg">
        <div className="grid md:grid-cols-2">
          {/* Left panel */}
          <div className="relative hidden overflow-hidden border-r border-border md:block">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--tw-primary-blue)] to-[var(--tw-deep-blue)]" />
            {/* Subtle grid overlay */}
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)',
                backgroundSize: '28px 28px',
              }}
            />
            <div className="relative z-10 flex h-full flex-col p-8">
              {/* Logo (inverted on dark bg) */}
              <div className="flex items-center gap-2">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 28 28"
                  fill="none"
                  aria-hidden="true"
                  className="shrink-0"
                >
                  <rect width="28" height="28" rx="6" fill="rgba(255,255,255,0.15)" />
                  <circle cx="9" cy="10" r="3" fill="#fbbf24" />
                  <path d="M4 23 Q4 17 9 17 Q14 17 14 23" fill="#fbbf24" />
                  <circle cx="20" cy="10" r="3" fill="#f59e0b" />
                  <path d="M15 23 Q15 17 20 17 Q25 17 25 23" fill="#f59e0b" />
                </svg>
                <span
                  className="text-lg font-extrabold leading-none tracking-tight text-white"
                  style={{ letterSpacing: '-0.03em' }}
                >
                  Team<span style={{ color: '#fbbf24' }}>wise</span>
                </span>
              </div>

              <div className="mt-8 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-white/50">
                  Respiratory therapy scheduling
                </p>
                <h2 className="text-2xl font-bold leading-snug text-white">
                  The schedule your
                  <br />
                  team can count on.
                </h2>
              </div>

              {/* Schedule illustration */}
              <div className="mt-6 overflow-hidden rounded-xl border border-white/15 bg-card/10 p-3 backdrop-blur-sm">
                <svg
                  viewBox="0 0 700 260"
                  role="img"
                  aria-label="Weekly schedule grid illustration"
                  className="h-auto w-full"
                >
                  {/* Background */}
                  <rect x="1" y="1" width="698" height="258" rx="10" fill="#f8fafc" />
                  {/* Today column highlight */}
                  <rect x="201" y="1" width="99" height="258" fill="#0667a9" opacity="0.06" />
                  {/* Header row */}
                  <rect x="1" y="1" width="698" height="36" rx="10" fill="#eef2f7" />
                  <line x1="1" y1="36" x2="699" y2="36" stroke="#d6dce6" />
                  {/* Col dividers */}
                  <line x1="100" y1="1" x2="100" y2="259" stroke="#d6dce6" />
                  <line x1="200" y1="1" x2="200" y2="259" stroke="#d6dce6" />
                  <line x1="300" y1="1" x2="300" y2="259" stroke="#d6dce6" />
                  <line x1="400" y1="1" x2="400" y2="259" stroke="#d6dce6" />
                  <line x1="500" y1="1" x2="500" y2="259" stroke="#d6dce6" />
                  <line x1="600" y1="1" x2="600" y2="259" stroke="#d6dce6" />
                  {/* Row divider */}
                  <line x1="1" y1="148" x2="699" y2="148" stroke="#d6dce6" />
                  {/* Row labels */}
                  <text
                    x="50"
                    y="98"
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="600"
                    fill="#64748b"
                    fontFamily="sans-serif"
                  >
                    DAY
                  </text>
                  <text
                    x="50"
                    y="208"
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="600"
                    fill="#64748b"
                    fontFamily="sans-serif"
                  >
                    NIGHT
                  </text>
                  {/* Day column headers */}
                  {(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const).map((label, i) => (
                    <text
                      key={label}
                      x={150 + i * 100}
                      y={22}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="600"
                      fill={i === 1 ? '#0667a9' : '#64748b'}
                      fontFamily="sans-serif"
                    >
                      {label}
                    </text>
                  ))}
                  {/* Day shift chips */}
                  <rect
                    x="116"
                    y="50"
                    width="68"
                    height="84"
                    rx="7"
                    fill="#0b79c8"
                    opacity="0.88"
                  />
                  <rect
                    x="216"
                    y="50"
                    width="68"
                    height="84"
                    rx="7"
                    fill="#0b79c8"
                    opacity="0.92"
                  />
                  <rect
                    x="316"
                    y="50"
                    width="68"
                    height="84"
                    rx="7"
                    fill="#f59e0b"
                    opacity="0.85"
                  />
                  <rect
                    x="416"
                    y="50"
                    width="68"
                    height="84"
                    rx="7"
                    fill="#0b79c8"
                    opacity="0.88"
                  />
                  <rect
                    x="516"
                    y="50"
                    width="68"
                    height="84"
                    rx="7"
                    fill="#10b981"
                    opacity="0.85"
                  />
                  {/* Night shift chips */}
                  <rect
                    x="116"
                    y="162"
                    width="68"
                    height="80"
                    rx="7"
                    fill="#1d608e"
                    opacity="0.72"
                  />
                  <rect
                    x="216"
                    y="162"
                    width="68"
                    height="80"
                    rx="7"
                    fill="#1d608e"
                    opacity="0.72"
                  />
                  <rect
                    x="316"
                    y="162"
                    width="68"
                    height="80"
                    rx="7"
                    fill="#10b981"
                    opacity="0.72"
                  />
                  <rect
                    x="416"
                    y="162"
                    width="68"
                    height="80"
                    rx="7"
                    fill="#1d608e"
                    opacity="0.72"
                  />
                  <rect
                    x="616"
                    y="162"
                    width="68"
                    height="80"
                    rx="7"
                    fill="#1d608e"
                    opacity="0.6"
                  />
                </svg>
              </div>

              {/* Benefits list */}
              <ul className="mt-6 space-y-2.5">
                {BENEFITS.map((b) => (
                  <li key={b} className="flex items-center gap-2.5 text-sm text-white/85">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#fbbf24]" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right panel – form */}
          <div className="p-6 md:p-8">
            <CardHeader className="space-y-3 px-0 text-center md:text-left">
              <TeamwiseLogo className="justify-center md:justify-start" size="small" />
              <div className="space-y-1">
                <CardTitle className="text-2xl font-semibold text-foreground">Sign in</CardTitle>
                <CardDescription>Access your account to continue.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="px-0">
              <form onSubmit={handleLogin} className="space-y-4">
                {redirectPath && (
                  <p className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-muted-foreground">
                    Sign in to continue to the page you requested.
                  </p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Work email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                {(error || callbackErrorMessage) && (
                  <p className="rounded-lg border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-sm text-[var(--error-text)]">
                    {error || callbackErrorMessage}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {loading ? 'Signing in...' : 'Sign in to Teamwise'}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Need access?{' '}
                  <Link href="/signup" className="font-medium text-primary hover:underline">
                    Submit an access request
                  </Link>
                </p>
              </form>
            </CardContent>
          </div>
        </div>
      </Card>
    </main>
  )
}
