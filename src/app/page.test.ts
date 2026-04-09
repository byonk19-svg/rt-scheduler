import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const pageSource = fs.readFileSync(path.join(process.cwd(), 'src/app/page.tsx'), 'utf8')

describe('public homepage copy and ctas', () => {
  it('uses homepage-first scheduling copy', () => {
    expect(pageSource).toContain('Scheduling, availability, and coverage in one place')
    expect(pageSource).toContain(
      'A simple way for therapists and managers to stay aligned on staffing.'
    )
  })

  it('keeps sign in and create account ctas in header and hero', () => {
    const signInMatches = pageSource.match(/>Sign in</g) ?? []
    const createAccountMatches = pageSource.match(/>Create account</g) ?? []
    expect(signInMatches.length).toBeGreaterThanOrEqual(2)
    expect(createAccountMatches.length).toBeGreaterThanOrEqual(2)
  })
})
