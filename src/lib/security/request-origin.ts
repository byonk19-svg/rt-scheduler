function toOrigin(value: string | null): string | null {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1'
  )
}

function expandLoopbackAliases(origin: string): string[] {
  try {
    const parsed = new URL(origin)
    if (!isLoopbackHost(parsed.hostname)) {
      return [origin]
    }

    const port = parsed.port ? `:${parsed.port}` : ''
    return [
      `${parsed.protocol}//localhost${port}`,
      `${parsed.protocol}//127.0.0.1${port}`,
      `${parsed.protocol}//[::1]${port}`,
    ]
  } catch {
    return [origin]
  }
}

function collectTrustedOrigins(request: Request): Set<string> {
  const trustedOrigins = new Set<string>()

  const requestOrigin = toOrigin(request.url)
  if (requestOrigin) {
    for (const alias of expandLoopbackAliases(requestOrigin)) {
      trustedOrigins.add(alias)
    }
  }

  const configuredOrigins = [
    process.env.APP_ORIGIN,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
  ]

  for (const configuredOrigin of configuredOrigins) {
    const origin = toOrigin(configuredOrigin ?? null)
    if (origin) {
      for (const alias of expandLoopbackAliases(origin)) {
        trustedOrigins.add(alias)
      }
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
