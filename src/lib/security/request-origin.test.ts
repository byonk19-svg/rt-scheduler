import { afterEach, describe, expect, it } from 'vitest'

import { isTrustedMutationRequest } from '@/lib/security/request-origin'

const ORIGINAL_ENV = {
  APP_ORIGIN: process.env.APP_ORIGIN,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
}

function restoreEnv() {
  process.env.APP_ORIGIN = ORIGINAL_ENV.APP_ORIGIN
  process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_ENV.NEXT_PUBLIC_APP_URL
  process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL_ENV.NEXT_PUBLIC_SITE_URL
}

describe('isTrustedMutationRequest', () => {
  afterEach(() => {
    restoreEnv()
  })

  it('accepts same-origin requests based on request URL', () => {
    const request = new Request('https://app.example.com/api/notifications/mark-read', {
      method: 'POST',
      headers: {
        origin: 'https://app.example.com',
      },
    })

    expect(isTrustedMutationRequest(request)).toBe(true)
  })

  it('ignores spoofed forwarded host headers', () => {
    const request = new Request('https://app.example.com/api/notifications/mark-read', {
      method: 'POST',
      headers: {
        origin: 'https://evil.example',
        'x-forwarded-host': 'evil.example',
        'x-forwarded-proto': 'https',
      },
    })

    expect(isTrustedMutationRequest(request)).toBe(false)
  })

  it('accepts configured app origin when runtime request URL differs', () => {
    process.env.APP_ORIGIN = 'https://teamwise.example.com'

    const request = new Request('http://127.0.0.1:3000/api/notifications/mark-read', {
      method: 'POST',
      headers: {
        origin: 'https://teamwise.example.com',
      },
    })

    expect(isTrustedMutationRequest(request)).toBe(true)
  })

  it('accepts trusted referer origin when origin header is absent', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://teamwise.example.com'

    const request = new Request('http://127.0.0.1:3000/api/notifications/mark-read', {
      method: 'POST',
      headers: {
        referer: 'https://teamwise.example.com/dashboard',
      },
    })

    expect(isTrustedMutationRequest(request)).toBe(true)
  })

  it('treats localhost and loopback aliases as the same trusted origin', () => {
    const request = new Request('http://localhost:3000/api/notifications/mark-read', {
      method: 'POST',
      headers: {
        origin: 'http://127.0.0.1:3000',
      },
    })

    expect(isTrustedMutationRequest(request)).toBe(true)
  })
})
