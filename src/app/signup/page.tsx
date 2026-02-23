'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { TeamwiseLogo } from '@/components/teamwise-logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function SignupPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [shiftType, setShiftType] = useState('day')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: 'therapist',
          shift_type: shiftType,
        },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard?success=access_requested')
    router.refresh()
  }

  return (
    <main className="teamwise-aurora-bg flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-4xl overflow-hidden p-0">
        <div className="grid md:grid-cols-2">
          <div className="teamwise-grid-bg hidden border-r border-border p-8 md:block">
            <TeamwiseLogo />
            <div className="mt-10 space-y-3">
              <p className="inline-flex w-fit rounded-md border border-[var(--primary)]/20 bg-secondary px-3 py-1 text-xs font-semibold text-[var(--tw-deep-blue)]">
                Teamwise Access
              </p>
              <h2 className="text-3xl font-bold tracking-tight text-foreground">
                Request your staff account.
              </h2>
              <p className="text-sm text-muted-foreground">
                Managers can promote roles and assign day/night preferences after signup.
              </p>
            </div>
          </div>

          <div className="p-6 md:p-8">
            <CardHeader className="space-y-3 px-0 text-center md:text-left">
              <TeamwiseLogo className="justify-center md:justify-start" size="small" />
              <div className="space-y-1">
                <CardTitle className="text-2xl font-semibold text-foreground">Request Access</CardTitle>
                <CardDescription>Join Teamwise to manage schedules and coverage.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="px-0">
              <form onSubmit={handleSignup} className="space-y-4">
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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
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
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shiftType">Shift Type</Label>
                  <select
                    id="shiftType"
                    value={shiftType}
                    onChange={(e) => setShiftType(e.target.value)}
                    className="h-9 w-full rounded-md border border-border bg-[var(--input-background)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                  >
                    <option value="day">Day Shift</option>
                    <option value="night">Night Shift</option>
                  </select>
                </div>
                {error && <p className="rounded-lg border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-sm text-[var(--error-text)]">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {loading ? 'Creating account...' : 'Request Access'}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <Link href="/login" className="font-medium text-primary hover:underline">
                    Sign in
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
