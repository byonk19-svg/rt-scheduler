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

  it('keeps the approval note in the hero', () => {
    expect(pageSource).toContain('Manager approval required.')
  })

  it('does not include the legacy three-up marketing feature strip', () => {
    expect(pageSource).not.toContain('Availability stays visible before the next handoff')
    expect(pageSource).not.toContain('Coverage changes stay clear without the back-and-forth.')
  })

  it('uses the dark teal hero with decorative elements', () => {
    expect(pageSource).toContain('bg-[var(--primary)]')
    expect(pageSource).toContain('bg-[var(--attention)]')
    expect(pageSource).toContain('Scheduling for RT teams')
  })

  it('does not use the old luminous light-mode wrapper classes', () => {
    expect(pageSource).not.toContain('teamwise-home-luminous')
    expect(pageSource).not.toContain('teamwise-home-preview-shell')
  })
})
