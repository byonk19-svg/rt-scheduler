'use client'

import Link from 'next/link'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import { LoginBrandPanel } from '@/components/public/LoginBrandPanel'
import { LoginFormPanel } from '@/components/public/LoginFormPanel'
import {
  buildCleanedLoginSearchParams,
  extractAuthErrorFromSearchParams,
  isLoginApprovalBannerMessage,
  sanitizeRedirectTo,
} from '@/lib/auth/login-utils'
import { createClient } from '@/lib/supabase/client'

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
      <LoginBrandPanel />
      <LoginFormPanel
        approvalBanner={approvalBanner}
        capsLockOn={capsLockOn}
        displayError={displayError}
        email={email}
        errorBannerVisible={showBanner}
        handleSubmit={handleSubmit}
        loading={loading}
        onDismissAuthBanner={() => setDismissedMessageKey(displayError ?? '')}
        onDismissPostSignupBanner={() => setDismissedPostSignupKey(postSignupBanner)}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onPasswordFocus={(event) => {
          const native = event.nativeEvent as {
            getModifierState?: (key: string) => boolean
          }
          if (typeof native.getModifierState === 'function') {
            setCapsLockOn(native.getModifierState('CapsLock'))
          }
        }}
        onTogglePassword={() => setShowPassword((value) => !value)}
        password={password}
        postSignupBanner={postSignupBanner}
        postSignupBannerVisible={showPostSignupBanner}
        showPassword={showPassword}
        updateCapsFromEvent={updateCapsFromEvent}
      />
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
