'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { createClient } from '@/lib/supabase/client'
import { TeamwiseLogo } from '@/components/teamwise-logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <main className="teamwise-aurora-bg flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-4xl overflow-hidden p-0">
        <div className="grid md:grid-cols-2">
          <div className="teamwise-grid-bg-subtle hidden border-r border-border p-8 md:block">
            <TeamwiseLogo />
            <div className="mt-10 space-y-4">
              <p className="inline-flex w-fit rounded-md border border-[var(--primary)]/20 bg-secondary px-3 py-1 text-xs font-semibold text-[var(--tw-deep-blue)]">
                Teamwise Scheduling
              </p>
              <h2 className="text-3xl font-bold tracking-tight text-foreground">
                Welcome back to your scheduling center.
              </h2>
              <p className="text-sm text-muted-foreground">
                Review coverage, publish cycles, and keep your team aligned without spreadsheet chaos.
              </p>
              <p className="text-sm font-medium text-[var(--tw-deep-blue)]">
                Approve requests and keep shifts covered in minutes.
              </p>
            </div>
          </div>

          <div className="p-6 md:p-8">
            <CardHeader className="space-y-3 px-0 text-center md:text-left">
              <TeamwiseLogo className="justify-center md:justify-start" size="small" />
              <div className="space-y-1">
                <CardTitle className="text-2xl font-semibold text-foreground">Sign in</CardTitle>
                <CardDescription>The schedule your team trusts.</CardDescription>
                <p className="text-sm text-[var(--tw-deep-blue)]">
                  Approve requests and keep shifts covered in minutes.
                </p>
              </div>
            </CardHeader>
            <CardContent className="px-0">
              <form onSubmit={handleLogin} className="space-y-4">
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
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                {error && <p className="rounded-lg border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-sm text-[var(--error-text)]">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign in'}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  No account yet?{' '}
                  <Link href="/signup" className="font-medium text-primary hover:underline">
                    Request access
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
