import { describe, expect, it } from 'vitest'

import {
  buildCleanedLoginSearchParams,
  extractAuthErrorFromSearchParams,
  isLoginApprovalBannerMessage,
  sanitizeRedirectTo,
  stripAuthQueryFromRelativePath,
} from '@/lib/auth/login-utils'

describe('isLoginApprovalBannerMessage', () => {
  it('returns true for approval / allowlist copy', () => {
    expect(
      isLoginApprovalBannerMessage(
        "Your account isn't approved yet or your email isn't allowed. Contact your manager."
      )
    ).toBe(true)
  })

  it('returns false for credential errors', () => {
    expect(isLoginApprovalBannerMessage('Incorrect email or password.')).toBe(false)
  })

  it('returns false for generic auth fallback', () => {
    expect(
      isLoginApprovalBannerMessage("Couldn't sign you in. Try again or contact your manager.")
    ).toBe(false)
  })
})

describe('sanitizeRedirectTo', () => {
  it('returns null for null, empty, or whitespace-only', () => {
    expect(sanitizeRedirectTo(null)).toBeNull()
    expect(sanitizeRedirectTo('')).toBeNull()
    expect(sanitizeRedirectTo('   ')).toBeNull()
  })

  it('allows same-origin relative paths', () => {
    expect(sanitizeRedirectTo('/availability')).toBe('/availability')
    expect(sanitizeRedirectTo('/coverage?shift=day')).toBe('/coverage?shift=day')
    expect(sanitizeRedirectTo('/path#section')).toBe('/path#section')
  })

  it('decodes percent-encoded paths when safe', () => {
    expect(sanitizeRedirectTo('%2Favailability')).toBe('/availability')
  })

  it('rejects protocol-relative and open-redirect patterns', () => {
    expect(sanitizeRedirectTo('//evil.example')).toBeNull()
    expect(sanitizeRedirectTo('/%2F%2Fevil.example')).toBeNull()
  })

  it('rejects absolute URLs and javascript: payloads', () => {
    expect(sanitizeRedirectTo('https://evil.example')).toBeNull()
    expect(sanitizeRedirectTo('http://evil.example')).toBeNull()
    expect(sanitizeRedirectTo('/open?next=https://evil.example')).toBeNull()
    expect(sanitizeRedirectTo('/x?javascript:alert(1)')).toBeNull()
    expect(sanitizeRedirectTo('javascript:alert(1)')).toBeNull()
  })

  it('rejects malformed percent-encoding', () => {
    expect(sanitizeRedirectTo('/%')).toBeNull()
  })
})

describe('stripAuthQueryFromRelativePath', () => {
  it('removes nested auth query keys', () => {
    expect(stripAuthQueryFromRelativePath('/availability?error=email_intake_apply_failed')).toBe(
      '/availability'
    )
  })

  it('preserves other query keys', () => {
    const cleaned = stripAuthQueryFromRelativePath(
      '/availability?error=x&tab=1&error_description=y'
    )
    expect(cleaned.startsWith('/availability?')).toBe(true)
    expect(cleaned).toContain('tab=1')
    expect(cleaned).not.toContain('error=')
    expect(cleaned).not.toContain('error_description=')
  })
})

describe('extractAuthErrorFromSearchParams', () => {
  it('returns no message when there is no auth signal', () => {
    const params = new URLSearchParams('redirectTo=%2Favailability')
    const result = extractAuthErrorFromSearchParams(params)
    expect(result.message).toBeNull()
    expect(result.shouldCleanUrl).toBe(false)
  })

  it('reads top-level error and flags URL cleanup', () => {
    const params = new URLSearchParams('error=email_intake_apply_failed&redirectTo=%2Favailability')
    const result = extractAuthErrorFromSearchParams(params)
    expect(result.message).toBe(
      "Your account isn't approved yet or your email isn't allowed. Contact your manager."
    )
    expect(result.cleanedRedirectTo).toBe('/availability')
    expect(result.shouldCleanUrl).toBe(true)
  })

  it('extracts nested error inside redirectTo and yields cleaned redirect', () => {
    const params = new URLSearchParams(
      'redirectTo=%2Favailability%3Ferror%3Demail_intake_apply_failed'
    )
    const result = extractAuthErrorFromSearchParams(params)
    expect(result.message).toBe(
      "Your account isn't approved yet or your email isn't allowed. Contact your manager."
    )
    expect(result.cleanedRedirectTo).toBe('/availability')
    expect(result.shouldCleanUrl).toBe(true)
  })

  it('maps invalid login credentials from nested redirect', () => {
    const nested = encodeURIComponent(
      '/availability?error_description=Invalid%20login%20credentials'
    )
    const params = new URLSearchParams(`redirectTo=${nested}`)
    const result = extractAuthErrorFromSearchParams(params)
    expect(result.message).toBe('Incorrect email or password.')
    expect(result.cleanedRedirectTo).toBe('/availability')
    expect(result.shouldCleanUrl).toBe(true)
  })

  it('uses fallback for unknown nested error', () => {
    const nested = encodeURIComponent('/availability?error=unknown_code')
    const params = new URLSearchParams(`redirectTo=${nested}`)
    const result = extractAuthErrorFromSearchParams(params)
    expect(result.message).toBe("Couldn't sign you in. Try again or contact your manager.")
    expect(result.cleanedRedirectTo).toBe('/availability')
  })

  it('flags cleanup for invalid redirectTo without an auth message', () => {
    const params = new URLSearchParams('redirectTo=%2F%2Fevil.example')
    const result = extractAuthErrorFromSearchParams(params)
    expect(result.message).toBeNull()
    expect(result.shouldCleanUrl).toBe(true)
    expect(result.cleanedRedirectTo).toBeNull()
  })
})

describe('buildCleanedLoginSearchParams', () => {
  it('drops top-level auth keys and rewrites redirectTo when provided', () => {
    const current = new URLSearchParams(
      'error=email_intake_apply_failed&redirectTo=%2Favailability%3Ferror%3Dx'
    )
    const next = buildCleanedLoginSearchParams(current, '/availability')
    expect(next.get('error')).toBeNull()
    expect(next.get('redirectTo')).toBe('/availability')
  })

  it('does not touch redirectTo when argument is undefined', () => {
    const current = new URLSearchParams('error=x&redirectTo=%2Ffoo')
    const next = buildCleanedLoginSearchParams(current, undefined)
    expect(next.get('error')).toBeNull()
    expect(next.get('redirectTo')).toBe('/foo')
  })

  it('deletes redirectTo when cleaned value is null', () => {
    const current = new URLSearchParams('redirectTo=%2F%2Fbad')
    const next = buildCleanedLoginSearchParams(current, null)
    expect(next.has('redirectTo')).toBe(false)
  })
})
