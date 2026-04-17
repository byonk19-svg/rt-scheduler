import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const pageSource = fs.readFileSync(path.join(process.cwd(), 'src/app/(public)/page.tsx'), 'utf8')

describe('public homepage redesign contract', () => {
  it('uses therapist-first trust-forward copy', () => {
    expect(pageSource).toContain('Keep your schedule, availability, and coverage in one calm view.')
    expect(pageSource).toContain(
      'Built for respiratory therapists who need quick shift clarity, fewer back-and-forth messages, and a workspace they can trust before the next handoff.'
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
  })

  it('uses the luminous clinical wrapper classes', () => {
    expect(pageSource).toContain('teamwise-home-luminous')
    expect(pageSource).toContain('teamwise-home-grid')
    expect(pageSource).toContain('teamwise-home-preview-shell')
    expect(pageSource).toContain('teamwise-home-preview-sheen')
  })

  it('optimizes the preview image for production (responsive sizes, blur, no unoptimized bypass)', () => {
    expect(pageSource).toContain("import appPreview from '../../public/images/app-preview.png'")
    expect(pageSource).toContain('placeholder="blur"')
    expect(pageSource).toContain('sizes=')
    expect(pageSource).not.toContain('unoptimized')
  })
})
