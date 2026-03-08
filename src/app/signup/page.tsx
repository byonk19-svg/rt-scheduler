'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2 } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { TeamwiseLogo } from '@/components/teamwise-logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

const HIGHLIGHTS = [
  'Submit availability once per cycle',
  'See your upcoming shifts at a glance',
  'Request shift swaps & pickups',
  'Get notified when schedules publish',
] as const

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

export default function SignupPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [shiftType, setShiftType] = useState('day')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const emailRedirectTo = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`
    : undefined

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: {
          full_name: fullName,
          role: 'therapist',
          shift_type: shiftType,
        },
      },
    })

    if (error) {
      setError(toFriendlySignupError(error.message))
      setLoading(false)
      return
    }

    router.push('/pending-setup?success=access_requested')
    router.refresh()
  }

  return (
    <main className="teamwise-aurora-bg flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-4xl overflow-hidden p-0 shadow-lg">
        <div className="grid md:grid-cols-2">
          {/* Left panel */}
          <div className="relative hidden overflow-hidden border-r border-border md:block">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--tw-deep-blue)] to-[#0f3d5c]" />
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
              {/* Logo (inverted) */}
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
                  Staff access
                </p>
                <h2 className="text-2xl font-bold leading-snug text-white">
                  Request your staff
                  <br />
                  account today.
                </h2>
                <p className="text-sm text-white/70">
                  Managers can promote roles and configure shift preferences after your account is
                  approved.
                </p>
              </div>

              {/* Profile card mockup */}
              <div className="mt-6 overflow-hidden rounded-xl border border-white/15 bg-card/10 p-4 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fbbf24] text-sm font-bold text-white">
                    JS
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Jane Smith, RRT</p>
                    <p className="text-xs text-white/60">Day Shift | Staff</p>
                  </div>
                  <span className="ml-auto rounded-full bg-[var(--success)] px-2 py-0.5 text-xs font-semibold text-white">
                    Active
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[
                    { label: 'This cycle', value: '12' },
                    { label: 'Approved', value: '3' },
                    { label: 'Days off', value: '2' },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg bg-card/10 p-2 text-center">
                      <p className="text-base font-bold text-white">{s.value}</p>
                      <p className="text-xs text-white/60">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Benefits list */}
              <ul className="mt-6 space-y-2.5">
                {HIGHLIGHTS.map((h) => (
                  <li key={h} className="flex items-center gap-2.5 text-sm text-white/85">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#fbbf24]" />
                    {h}
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
                <CardTitle className="text-2xl font-semibold text-foreground">
                  Request Access
                </CardTitle>
                <CardDescription>Join Teamwise to manage schedules and coverage.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="px-0">
              <form onSubmit={handleSignup} className="space-y-4">
                <p className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-muted-foreground">
                  Takes about 1 minute. You can sign in after a manager approves your access.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Jane Smith"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    This name appears on schedules and shift requests.
                  </p>
                </div>
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
                  <p className="text-xs text-muted-foreground">
                    Use your work email so your manager can find your account quickly.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Use at least 8 characters for account security.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shiftType">Shift Type</Label>
                  <select
                    id="shiftType"
                    value={shiftType}
                    onChange={(e) => setShiftType(e.target.value)}
                    className="h-9 w-full rounded-md border border-border bg-[var(--input-background)] px-3 text-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none"
                  >
                    <option value="day">Day Shift</option>
                    <option value="night">Night Shift</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    This sets initial defaults and can be changed later.
                  </p>
                </div>
                {error && (
                  <p className="rounded-lg border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-sm text-[var(--error-text)]">
                    {error}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {loading ? 'Submitting request...' : 'Submit access request'}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <Link href="/login" className="font-medium text-primary hover:underline">
                    Go to sign in
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
