'use client'

import Link from 'next/link'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import type { FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function SignupFormPanel({
  allRequiredInvalid,
  email,
  emailFieldInvalid,
  error,
  firstName,
  handleSubmit,
  lastName,
  loading,
  onEmailChange,
  onFirstNameChange,
  onLastNameChange,
  onPasswordChange,
  onPhoneChange,
  onTogglePassword,
  password,
  passwordFieldInvalid,
  phone,
  showPassword,
}: {
  allRequiredInvalid: boolean
  email: string
  emailFieldInvalid: boolean
  error: string | null
  firstName: string
  handleSubmit: (event: FormEvent) => Promise<void> | void
  lastName: string
  loading: boolean
  onEmailChange: (value: string) => void
  onFirstNameChange: (value: string) => void
  onLastNameChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onPhoneChange: (value: string) => void
  onTogglePassword: () => void
  password: string
  passwordFieldInvalid: boolean
  phone: string
  showPassword: boolean
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-5 sm:py-6 lg:py-6">
      <section className="w-full max-w-[420px]">
        <h1 className="app-page-title text-3xl">Request access</h1>
        <p className="mt-0.5 text-sm text-foreground/70">
          Access schedules, availability, and open shifts.
        </p>
        <p className="mt-1 text-xs font-medium leading-snug text-foreground/75">
          Your manager reviews requests before access is enabled.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Fields marked with * are required.</p>

        {error ? (
          <p
            id="signup-form-error"
            role="alert"
            aria-live="polite"
            className="mt-2 rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-sm text-[var(--error-text)]"
          >
            {error}
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-4 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="firstName">
                First name{' '}
                <span className="text-[var(--error-text)]" aria-hidden>
                  *
                </span>
              </Label>
              <Input
                id="firstName"
                name="firstName"
                type="text"
                autoComplete="given-name"
                value={firstName}
                onChange={(event) => onFirstNameChange(event.target.value)}
                required
                aria-required="true"
                aria-invalid={allRequiredInvalid ? true : undefined}
                aria-describedby={error ? 'signup-form-error' : undefined}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lastName">
                Last name{' '}
                <span className="text-[var(--error-text)]" aria-hidden>
                  *
                </span>
              </Label>
              <Input
                id="lastName"
                name="lastName"
                type="text"
                autoComplete="family-name"
                value={lastName}
                onChange={(event) => onLastNameChange(event.target.value)}
                required
                aria-required="true"
                aria-invalid={allRequiredInvalid ? true : undefined}
                aria-describedby={error ? 'signup-form-error' : undefined}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="phone">Phone number (optional)</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => onPhoneChange(event.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="email">
              Email address{' '}
              <span className="text-[var(--error-text)]" aria-hidden>
                *
              </span>
            </Label>
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
              aria-invalid={emailFieldInvalid || allRequiredInvalid ? true : undefined}
              aria-describedby={error ? 'signup-form-error' : undefined}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="password">
              Password{' '}
              <span className="text-[var(--error-text)]" aria-hidden>
                *
              </span>
            </Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                minLength={8}
                required
                aria-required="true"
                aria-invalid={passwordFieldInvalid || allRequiredInvalid ? true : undefined}
                aria-describedby={error ? 'signup-form-error password-hint' : 'password-hint'}
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
            <p id="password-hint" className="text-xs text-muted-foreground">
              At least 8 characters
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting request
              </>
            ) : (
              'Submit request'
            )}
          </Button>
        </form>

        <p className="mt-3.5 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </section>
    </div>
  )
}
