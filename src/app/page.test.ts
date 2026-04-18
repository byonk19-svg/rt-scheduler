import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const pageSource = fs.readFileSync(path.join(process.cwd(), 'src/app/(public)/page.tsx'), 'utf8')

describe('public homepage redesign contract', () => {
  it('uses therapist-first trust-forward copy', () => {
    expect(pageSource).toContain('Keep your schedule, availability, and coverage in one calm view.')
    expect(pageSource).toContain(
      'Fewer chasing threads and clearer handoffs—built for RTs who need the next block to feel settled before they step onto the floor.'
    )
  })

  it('keeps the hero CTAs aligned with the public auth flow', () => {
    expect(pageSource).toContain('<Link href="/login">Sign in</Link>')
    expect(pageSource).toContain('<Link href="/signup">Create account</Link>')
  })

  it('keeps the approval note and trust bullets visible', () => {
    expect(pageSource).toContain(
      'Your manager will need to approve your account before your first sign-in.'
    )
    expect(pageSource).toContain('Availability stays visible before the next handoff.')
    expect(pageSource).toContain('Coverage changes stay clear without the back-and-forth.')
    expect(pageSource).toContain("Sign-in and roster access stay under your manager's control.")
  })

  it('uses the luminous clinical wrapper classes', () => {
    expect(pageSource).toContain('teamwise-home-luminous')
    expect(pageSource).toContain('teamwise-home-grid')
    expect(pageSource).toContain('teamwise-home-preview-shell')
    expect(pageSource).toContain('teamwise-home-preview-sheen')
  })

  it('optimizes the preview image for production (responsive sizes, no unoptimized bypass)', () => {
    expect(pageSource).toContain('src="/images/app-preview.png"')
    expect(pageSource).toContain('sizes=')
    expect(pageSource).not.toContain('unoptimized')
  })
})
