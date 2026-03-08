function toOrigin(value: string | null): string | null {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function collectTrustedOrigins(request: Request): Set<string> {
  const trustedOrigins = new Set<string>()

  const requestOrigin = toOrigin(request.url)
  if (requestOrigin) {
    trustedOrigins.add(requestOrigin)
  }

  const configuredOrigins = [
    process.env.APP_ORIGIN,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
  ]

  for (const configuredOrigin of configuredOrigins) {
    const origin = toOrigin(configuredOrigin ?? null)
    if (origin) {
      trustedOrigins.add(origin)
    }
  }

  return trustedOrigins
}

export function isTrustedMutationRequest(request: Request): boolean {
  const trustedOrigins = collectTrustedOrigins(request)

  const requestOrigin = toOrigin(request.headers.get('origin'))
  if (requestOrigin) {
    return trustedOrigins.has(requestOrigin)
  }

  const refererOrigin = toOrigin(request.headers.get('referer'))
  if (refererOrigin) {
    return trustedOrigins.has(refererOrigin)
  }

  return false
}
