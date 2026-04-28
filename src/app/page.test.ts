import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const pageSource = fs.readFileSync(path.join(process.cwd(), 'src/app/(public)/page.tsx'), 'utf8')
const publicHeaderSource = fs.readFileSync(
  path.join(process.cwd(), 'src/components/public/PublicHeader.tsx'),
  'utf8'
)

describe('public homepage redesign contract', () => {
  it('uses the scheduling-first hero copy', () => {
    expect(pageSource).toContain('Scheduling that keeps care moving.')
    expect(pageSource).toContain('Coverage planning, availability, and shift management')
  })

  it('keeps the header and hero CTA roles aligned', () => {
    expect(pageSource).toContain('<Link href="/login">Sign in</Link>')
    expect(pageSource).toContain('<Link href="/signup">Request access</Link>')
    expect(publicHeaderSource).toContain("ctaLabel: 'Create account'")
  })

  it('keeps the approval note and the design handoff feature strip', () => {
    // Source of truth: Refined.html design handoff. The 3-up feature strip is
    // part of the canonical landing page, not removable polish.
    expect(pageSource).toContain('Manager approval required.')
    expect(pageSource).toContain('Availability stays visible before the next handoff')
    expect(pageSource).toContain('Coverage changes stay clear without the back-and-forth.')
  })

  it('renders the hero on the deep --marketing-hero-bg teal, not the lighter --primary', () => {
    // The design handoff specifies #1b3836 (--marketing-hero-bg) for the hero —
    // bg-[var(--primary)] would produce the wrong (lighter) teal users complained about.
    expect(pageSource).toContain('bg-[var(--marketing-hero-bg)]')
    expect(pageSource).not.toMatch(/<section[^>]+bg-\[var\(--primary\)\]/)
    expect(pageSource).toContain('bg-[var(--attention)]')
    expect(pageSource).toContain('Scheduling for RT teams')
  })

  it('does not use the old luminous light-mode wrapper classes', () => {
    expect(pageSource).not.toContain('teamwise-home-luminous')
    expect(pageSource).not.toContain('teamwise-home-preview-shell')
  })
})
