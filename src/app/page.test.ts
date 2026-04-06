import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const pageSource = fs.readFileSync(path.join(process.cwd(), 'src/app/page.tsx'), 'utf8')

describe('auth page guideline guardrails', () => {
  it('announces async feedback with polite live regions', () => {
    const politeLiveRegions = pageSource.match(/aria-live="polite"/g) ?? []

    expect(politeLiveRegions).toHaveLength(2)
  })

  it('keeps meaningful names and email spellcheck settings on auth fields', () => {
    expect(pageSource).toContain('name="email"')
    expect(pageSource).toContain('name="firstName"')
    expect(pageSource).toContain('name="lastName"')
    expect(pageSource).toContain('name="phone"')
    expect(pageSource).toContain('name="role"')
    expect(pageSource).toContain('name="password"')
    expect(pageSource).toContain('spellCheck={false}')
  })

  it('avoids transition-all on auth controls', () => {
    expect(pageSource).not.toContain('transition-all')
  })

  it('keeps descriptive loading labels on submit buttons', () => {
    expect(pageSource).toContain('Sending reset link')
    expect(pageSource).toContain("isLogin ? 'Signing in' : 'Creating account'")
  })

  it('fails fast with a transport timeout message for auth requests', () => {
    expect(pageSource).toContain('AUTH_REQUEST_TIMEOUT_MS = 10000')
    expect(pageSource).toContain('We could not reach Teamwise services. Check your internet or VPN and try again.')
    expect(pageSource).toContain('timed out. Check your internet or VPN and try again.')
    expect(pageSource).toContain("'Sign-in'")
  })
})
