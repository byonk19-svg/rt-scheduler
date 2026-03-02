'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { FeedbackToast } from '@/components/feedback-toast'
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
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard?success=signed_in')
    router.refresh()
  }

  return (
    <main className="teamwise-aurora-bg flex min-h-screen items-center justify-center p-4">
      {toastMessage && <FeedbackToast message={toastMessage} variant="success" />}
      <Card className="w-full max-w-4xl overflow-hidden p-0">
        <div className="grid md:grid-cols-2">
          <div className="teamwise-grid-bg-subtle hidden border-r border-border p-8 md:block">
            <TeamwiseLogo />
            <div className="mt-8 space-y-5">
              <p className="text-sm font-medium text-muted-foreground">
                The schedule your team trusts
              </p>
              <div className="rounded-xl border border-border/80 bg-white/80 p-3 shadow-sm">
                <svg
                  viewBox="0 0 700 290"
                  role="img"
                  aria-label="Weekly schedule grid illustration"
                  className="h-auto w-full"
                >
                  <rect
                    x="1"
                    y="1"
                    width="698"
                    height="288"
                    rx="14"
                    fill="#f8fafc"
                    stroke="#d6dce6"
                  />
                  <line x1="1" y1="72" x2="699" y2="72" stroke="#d6dce6" />
                  <line x1="1" y1="144" x2="699" y2="144" stroke="#d6dce6" />
                  <line x1="1" y1="216" x2="699" y2="216" stroke="#d6dce6" />

                  <line x1="100" y1="1" x2="100" y2="289" stroke="#d6dce6" />
                  <line x1="200" y1="1" x2="200" y2="289" stroke="#d6dce6" />
                  <line x1="300" y1="1" x2="300" y2="289" stroke="#d6dce6" />
                  <line x1="400" y1="1" x2="400" y2="289" stroke="#d6dce6" />
                  <line x1="500" y1="1" x2="500" y2="289" stroke="#d6dce6" />
                  <line x1="600" y1="1" x2="600" y2="289" stroke="#d6dce6" />

                  <rect x="16" y="86" width="68" height="44" rx="8" fill="#0b79c8" opacity="0.9" />
                  <rect
                    x="114"
                    y="158"
                    width="72"
                    height="44"
                    rx="8"
                    fill="#f59e0b"
                    opacity="0.9"
                  />
                  <rect
                    x="214"
                    y="86"
                    width="70"
                    height="44"
                    rx="8"
                    fill="#0b79c8"
                    opacity="0.82"
                  />
                  <rect
                    x="314"
                    y="230"
                    width="70"
                    height="44"
                    rx="8"
                    fill="#10b981"
                    opacity="0.88"
                  />
                  <rect
                    x="414"
                    y="158"
                    width="70"
                    height="44"
                    rx="8"
                    fill="#0b79c8"
                    opacity="0.82"
                  />
                  <rect
                    x="514"
                    y="86"
                    width="70"
                    height="44"
                    rx="8"
                    fill="#10b981"
                    opacity="0.88"
                  />
                  <rect
                    x="614"
                    y="230"
                    width="70"
                    height="44"
                    rx="8"
                    fill="#f59e0b"
                    opacity="0.9"
                  />
                </svg>
              </div>
            </div>
          </div>

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
                {error && (
                  <p className="rounded-lg border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-sm text-[var(--error-text)]">
                    {error}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
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
