import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const pageSource = fs.readFileSync(path.join(process.cwd(), 'src/app/(public)/page.tsx'), 'utf8')

describe('public homepage redesign contract', () => {
  it('uses the refined hero copy', () => {
    expect(pageSource).toContain('Scheduling that keeps care moving.')
    expect(pageSource).toContain(
      "Coverage planning, availability, and shift management — built for RT departments that can't afford gaps."
    )
  })

  it('keeps the hero CTAs aligned with the public auth flow', () => {
    expect(pageSource).toContain('href="/login"')
    expect(pageSource).toContain('href="/signup"')
    expect(pageSource).toContain('Sign in')
    expect(pageSource).toContain('Create account')
  })

  it('keeps the approval note and trust bullets visible', () => {
    expect(pageSource).toContain('Manager approval required.')
    expect(pageSource).toContain('Availability stays visible before the next handoff')
    expect(pageSource).toContain('Coverage changes stay clear without the back-and-forth')
  })

  it('uses the refined dark teal hero treatment', () => {
    expect(pageSource).toContain('bg-[var(--sidebar)]')
    expect(pageSource).toContain('var(--attention)')
    expect(pageSource).toContain('font-display')
  })

  it('does not include the old preview image shell', () => {
    expect(pageSource).not.toContain('teamwise-home-preview-shell')
    expect(pageSource).not.toContain('app-preview.png')
  })
})
