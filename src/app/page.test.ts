import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const pageSource = fs.readFileSync(path.join(process.cwd(), 'src/app/page.tsx'), 'utf8')

describe('public homepage redesign contract', () => {
  it('uses therapist-first trust-forward copy', () => {
    expect(pageSource).toContain('Keep your schedule, availability, and coverage in one calm view.')
    expect(pageSource).toContain(
      'Built for respiratory therapists who need quick shift clarity, fewer back-and-forth messages, and a workspace they can trust before the next handoff.'
    )
  })

  it('keeps the header and hero CTA roles aligned', () => {
    const signInMatches = pageSource.match(/>Sign in</g) ?? []
    expect(signInMatches.length).toBeGreaterThanOrEqual(2)

    expect(pageSource).toContain('<Link href="/signup">Get started</Link>')
  })

  it('makes the hero create-account CTA primary and sign-in secondary', () => {
    const createAccountIndex = pageSource.indexOf('<Link href="/signup">Create account</Link>')
    const heroSignInIndex = pageSource.indexOf(
      '<Link href="/login">Sign in</Link>',
      createAccountIndex
    )
    const approvalNoteIndex = pageSource.indexOf(
      'Your manager will need to approve your account before your first sign-in.'
    )

    expect(createAccountIndex).toBeGreaterThan(-1)
    expect(heroSignInIndex).toBeGreaterThan(createAccountIndex)
    expect(heroSignInIndex).toBeLessThan(approvalNoteIndex)

    const createAccountButton = pageSource.slice(
      pageSource.lastIndexOf('<Button', createAccountIndex),
      pageSource.indexOf('</Button>', createAccountIndex) + '</Button>'.length
    )
    const heroSignInButton = pageSource.slice(
      pageSource.lastIndexOf('<Button', heroSignInIndex),
      pageSource.indexOf('</Button>', heroSignInIndex) + '</Button>'.length
    )

    expect(createAccountButton).not.toContain('variant="outline"')
    expect(heroSignInButton).toContain('variant="outline"')
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

  it('anchors the preview beside the hero content on large screens', () => {
    expect(pageSource).toContain('lg:grid lg:grid-cols-[minmax(0,0.94fr)_minmax(340px,0.88fr)]')
    expect(pageSource).toContain('lg:col-start-2 lg:row-span-3 lg:row-start-1')
  })
})
