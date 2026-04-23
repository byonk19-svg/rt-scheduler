import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const pageSource = fs.readFileSync(path.join(process.cwd(), 'src/app/(public)/page.tsx'), 'utf8')

describe('public homepage redesign contract', () => {
  it('matches the refined prototype hero copy', () => {
    expect(pageSource).toContain('Scheduling that keeps care moving.')
    expect(pageSource).toContain(
      "Coverage planning, availability, and shift management — built for RT departments that can't afford gaps."
    )
  })

  it('keeps the hero CTAs aligned with the public auth flow', () => {
    expect(pageSource).toContain('href="/login"')
    expect(pageSource).toContain('Sign in')
    expect(pageSource).toContain('href="/signup"')
    expect(pageSource).toContain('Request access')
  })

  it('keeps the approval note and feature strip visible', () => {
    expect(pageSource).toContain('Manager approval required.')
    expect(pageSource).toContain('Shift coverage')
    expect(pageSource).toContain('Manager control')
    expect(pageSource).toContain('Clear handoffs')
  })

  it('avoids the banned left-accent hero stripe treatment', () => {
    expect(pageSource).not.toContain('border-l-[5px]')
  })

  it('removes the old preview-image hero composition', () => {
    expect(pageSource).not.toContain('app-preview.png')
    expect(pageSource).not.toContain('teamwise-home-preview-shell')
  })
})
