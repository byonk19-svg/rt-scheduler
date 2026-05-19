import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  FUNCTIONAL_DEMO_ACCOUNTS,
  FUNCTIONAL_DEMO_ROSTER,
  getFunctionalDemoRequestAnchor,
  toSeedEmail,
} from '../../scripts/fixtures/functional-demo-roster.mjs'

describe('functional demo real-roster fixture', () => {
  it('uses actual day and night employees with unique synthetic emails', () => {
    expect(FUNCTIONAL_DEMO_ROSTER).toHaveLength(21)
    expect(FUNCTIONAL_DEMO_ROSTER.map((member) => member.fullName)).toEqual([
      'Julie D.',
      'Adrienne',
      'Kim',
      'Brianna',
      'Barbara',
      'Layne',
      'Tannie',
      'Aleyce',
      'Lynn',
      'Lisa',
      'Irene',
      'Kristine',
      'Matthew',
      'Rosa',
      'Sarah',
      'Audbriana',
      'Gayle',
      'Julie C.',
      'Ruth',
      'Nicole',
      'Mark',
    ])

    const emails = FUNCTIONAL_DEMO_ROSTER.map((member) => toSeedEmail(member))
    expect(new Set(emails).size).toBe(emails.length)
    expect(emails).toContain('julie.d@teamwise.test')
    expect(emails).toContain('julie.c@teamwise.test')
  })

  it('exposes login accounts only for selected roster members', () => {
    expect(FUNCTIONAL_DEMO_ACCOUNTS).toEqual([
      'julie.d@teamwise.test',
      'kim@teamwise.test',
      'brianna@teamwise.test',
      'layne@teamwise.test',
      'lisa@teamwise.test',
      'irene@teamwise.test',
      'kristine@teamwise.test',
      'rosa@teamwise.test',
      'audbriana@teamwise.test',
      'ruth@teamwise.test',
      'mark@teamwise.test',
    ])
    expect(FUNCTIONAL_DEMO_ACCOUNTS).not.toContain('adrienne@teamwise.test')
    expect(FUNCTIONAL_DEMO_ACCOUNTS).not.toContain('nicole@teamwise.test')
  })

  it('marks FMLA users and PRN users for the intended scheduling behavior', () => {
    const fmlaNames = FUNCTIONAL_DEMO_ROSTER.filter((member) => member.onFmla).map(
      (member) => member.fullName
    )
    const prnNames = FUNCTIONAL_DEMO_ROSTER.filter((member) => member.employmentType === 'prn').map(
      (member) => member.fullName
    )

    expect(fmlaNames).toEqual(['Kim', 'Mark'])
    expect(prnNames).toEqual(['Lisa', 'Irene', 'Kristine', 'Matthew', 'Rosa'])
    expect(FUNCTIONAL_DEMO_ROSTER.find((member) => member.fullName === 'Kim')?.login).toBe(true)
    expect(FUNCTIONAL_DEMO_ROSTER.find((member) => member.fullName === 'Mark')?.login).toBe(true)
  })

  it('keeps Layne as the seeded request-workflow staff account', () => {
    expect(getFunctionalDemoRequestAnchor()).toMatchObject({
      fullName: 'Layne',
      email: 'layne@teamwise.test',
      role: 'therapist',
      shiftType: 'day',
    })
  })

  it('leaves the functional demo draft block empty for Auto-draft testing', () => {
    const source = readFileSync(resolve(process.cwd(), 'scripts/seed-functional-demo.mjs'), 'utf8')

    expect(source).toContain('const draftCount = 0')
    expect(source).toContain('empty for Auto-draft testing')
    expect(source).toContain('requestAnchorEmail')
    expect(source).toContain("access_status: 'approved'")
    expect(source).toContain('staff_onboarding_required: false')
  })
})
