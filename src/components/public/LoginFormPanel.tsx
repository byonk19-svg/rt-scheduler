'use client'

import Link from 'next/link'
import { AlertCircle, AlertTriangle, Eye, EyeOff, Info, Loader2, X } from 'lucide-react'
import type { FormEvent, KeyboardEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export function LoginFormPanel({
  approvalBanner,
  capsLockOn,
  displayError,
  email,
  errorBannerVisible,
  handleSubmit,
  loading,
  onDismissAuthBanner,
  onDismissPostSignupBanner,
  onEmailChange,
  onPasswordChange,
  onPasswordFocus,
  onTogglePassword,
  password,
  postSignupBanner,
  postSignupBannerVisible,
  showPassword,
  updateCapsFromEvent,
}: {
  approvalBanner: boolean
  capsLockOn: boolean
  displayError: string | null
  email: string
  errorBannerVisible: boolean
  handleSubmit: (event: FormEvent) => Promise<void> | void
  loading: boolean
  onDismissAuthBanner: () => void
  onDismissPostSignupBanner: () => void
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onPasswordFocus: (event: React.FocusEvent<HTMLInputElement>) => void
  onTogglePassword: () => void
  password: string
  postSignupBanner: string | null
  postSignupBannerVisible: boolean
  showPassword: boolean
  updateCapsFromEvent: (event: KeyboardEvent<HTMLInputElement>) => void
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-10">
      <section className="w-full max-w-[380px]">
        <h1 className="app-page-title text-3xl">Sign in</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Pick up where you left off — schedules, availability, and handoffs in one place.
        </p>

        {postSignupBannerVisible && postSignupBanner ? (
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
              onClick={onDismissPostSignupBanner}
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        ) : null}

        {errorBannerVisible ? (
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
              {approvalBanner ? (
                <p>
                  <Link
                    href="/signup"
                    className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline decoration-primary/60 underline-offset-2 hover:decoration-primary"
                  >
                    Request access
                  </Link>
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-foreground/70 hover:bg-transparent hover:text-foreground"
              aria-label="Dismiss alert"
              onClick={onDismissAuthBanner}
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        ) : null}

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
              onChange={(event) => onEmailChange(event.target.value)}
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
                onChange={(event) => onPasswordChange(event.target.value)}
                onKeyDown={updateCapsFromEvent}
                onKeyUp={updateCapsFromEvent}
                onFocus={onPasswordFocus}
                required
                aria-required="true"
              />
              <button
                type="button"
                onClick={onTogglePassword}
                className="absolute inset-y-0 right-0 inline-flex min-h-11 min-w-11 items-center justify-center px-3 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {capsLockOn ? (
              <p className="text-xs font-medium text-[var(--warning-text)]" aria-live="polite">
                Caps Lock is on.
              </p>
            ) : null}
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
  )
}
