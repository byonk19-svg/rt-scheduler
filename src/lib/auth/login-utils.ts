/**
 * URL / query helpers for the email+password login surface.
 */

export function sanitizeRedirectTo(value: string | null): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  if (!trimmed) return null

  let decoded = trimmed
  try {
    decoded = decodeURIComponent(trimmed)
  } catch {
    return null
  }

  const lower = decoded.toLowerCase()
  if (!lower.startsWith('/')) return null
  if (lower.startsWith('//')) return null
  if (lower.includes('http')) return null
  if (lower.includes('javascript:')) return null

  return decoded
}

function splitTopLevelAuthParts(params: URLSearchParams): string[] {
  return ['error', 'error_description', 'message']
    .map((key) => params.get(key))
    .filter((value): value is string => value != null && value.length > 0)
}

function innerSearchParamsForRelativePath(decodedRelative: string): URLSearchParams {
  try {
    const url = new URL(decodedRelative, 'http://__login__.local')
    return url.searchParams
  } catch {
    return new URLSearchParams()
  }
}

/** Strips `error`, `error_description`, and `message` from a decoded same-origin path+query. */
export function stripAuthQueryFromRelativePath(decodedRelative: string): string {
  try {
    const url = new URL(decodedRelative, 'http://__login__.local')
    const sp = url.searchParams
    if (!sp.has('error') && !sp.has('error_description') && !sp.has('message')) {
      return decodedRelative
    }
    sp.delete('error')
    sp.delete('error_description')
    sp.delete('message')
    const qs = sp.toString()
    return qs ? `${url.pathname}?${qs}` : url.pathname
  } catch {
    return decodedRelative
  }
}

/** True when the login banner message is approval/allowlist (warning), not a sign-in failure (destructive). */
export function isLoginApprovalBannerMessage(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes("isn't approved") ||
    m.includes("isn't allowed") ||
    m.includes('isn\u2019t approved') ||
    m.includes('isn\u2019t allowed') ||
    m.includes('not approved yet')
  )
}

function mapFriendlyAuthMessage(haystack: string): string {
  const h = haystack.toLowerCase()
  if (h.includes('email_intake_apply_failed')) {
    return "Your account isn't approved yet or your email isn't allowed. Contact your manager."
  }
  if (h.includes('invalid login credentials') || h.includes('invalid')) {
    return 'Incorrect email or password.'
  }
  return "Couldn't sign you in. Try again or contact your manager."
}

/**
 * Build the next `/login` query string: always drops top-level auth params;
 * optionally rewrites or drops `redirectTo` when `cleanedRedirectTo` is provided.
 * Pass `undefined` for `cleanedRedirectTo` to leave `redirectTo` unchanged.
 */
export function buildCleanedLoginSearchParams(
  current: URLSearchParams,
  cleanedRedirectTo?: string | null
): URLSearchParams {
  const next = new URLSearchParams(current.toString())
  next.delete('error')
  next.delete('error_description')
  next.delete('message')

  if (cleanedRedirectTo !== undefined) {
    if (cleanedRedirectTo === null) {
      next.delete('redirectTo')
    } else {
      next.set('redirectTo', cleanedRedirectTo)
    }
  }

  return next
}

export function extractAuthErrorFromSearchParams(searchParams: URLSearchParams): {
  message: string | null
  cleanedRedirectTo: string | null
  shouldCleanUrl: boolean
} {
  const topParts = splitTopLevelAuthParts(searchParams)
  const rawRedirect = searchParams.get('redirectTo')
  const sanitizedRedirect = sanitizeRedirectTo(rawRedirect)
  const hadRedirectTo = searchParams.has('redirectTo')

  let nestedParts: string[] = []
  if (sanitizedRedirect) {
    const inner = innerSearchParamsForRelativePath(sanitizedRedirect)
    nestedParts = ['error', 'error_description', 'message']
      .map((key) => inner.get(key))
      .filter((value): value is string => value != null && value.length > 0)
  }

  const haystack = [...topParts, ...nestedParts].join(' ')
  const hasSignal = topParts.length > 0 || nestedParts.length > 0
  const message = hasSignal ? mapFriendlyAuthMessage(haystack) : null

  let cleanedRedirectTo: string | null = null
  let cleanedRedirectArg: string | null | undefined = undefined

  if (hadRedirectTo) {
    if (!sanitizedRedirect) {
      cleanedRedirectTo = null
      cleanedRedirectArg = null
    } else {
      const stripped = stripAuthQueryFromRelativePath(sanitizedRedirect)
      cleanedRedirectTo = sanitizeRedirectTo(stripped) ?? null
      cleanedRedirectArg = cleanedRedirectTo
    }
  }

  const next = buildCleanedLoginSearchParams(searchParams, cleanedRedirectArg)
  const shouldCleanUrl = next.toString() !== searchParams.toString()

  return {
    message,
    cleanedRedirectTo: hadRedirectTo ? cleanedRedirectTo : null,
    shouldCleanUrl,
  }
}
