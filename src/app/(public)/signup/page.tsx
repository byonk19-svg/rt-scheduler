'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import { SignupBrandPanel } from '@/components/public/SignupBrandPanel'
import { SignupFormPanel } from '@/components/public/SignupFormPanel'
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

  const errLower = error?.toLowerCase() ?? ''
  const emailFieldInvalid =
    Boolean(error) &&
    (errLower.includes('email') ||
      errLower.includes('already') ||
      errLower.includes('registered') ||
      errLower.includes('exists'))
  const passwordFieldInvalid = Boolean(error) && errLower.includes('password')
  const allRequiredInvalid = Boolean(error) && !emailFieldInvalid && !passwordFieldInvalid

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
              ...(phone.trim() ? { phone_number: phone.trim() } : {}),
              shift_type: 'day',
            },
          },
        }),
        'Submit request'
      )

      if (signUpError) {
        setError(toFriendlySignupError(signUpError.message))
        setLoading(false)
        return
      }

      router.push('/login?status=requested')
      router.refresh()
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : 'Could not create your account.'
      setError(toFriendlySignupError(message))
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-73px)]">
      <SignupBrandPanel />
      <SignupFormPanel
        allRequiredInvalid={allRequiredInvalid}
        email={email}
        emailFieldInvalid={emailFieldInvalid}
        error={error}
        firstName={firstName}
        handleSubmit={handleSubmit}
        lastName={lastName}
        loading={loading}
        onEmailChange={setEmail}
        onFirstNameChange={setFirstName}
        onLastNameChange={setLastName}
        onPasswordChange={setPassword}
        onPhoneChange={setPhone}
        onTogglePassword={() => setShowPassword((value) => !value)}
        password={password}
        passwordFieldInvalid={passwordFieldInvalid}
        phone={phone}
        showPassword={showPassword}
      />
    </div>
  )
}
