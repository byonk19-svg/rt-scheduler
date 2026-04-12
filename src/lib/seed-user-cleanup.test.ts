import { describe, expect, it } from 'vitest'

import { buildCleanupPlan, type AuthUserLike } from '../../scripts/lib/seed-user-cleanup-core.mjs'

function makeUser(overrides: Partial<AuthUserLike> = {}): AuthUserLike {
  return {
    id: 'user-1',
    email: 'demo-therapist01@teamwise.test',
    ...overrides,
  }
}

describe('buildCleanupPlan', () => {
  it('selects seeded demo accounts by default', () => {
    const plan = buildCleanupPlan([
      makeUser({ id: 'demo-1', email: 'demo-manager@teamwise.test' }),
      makeUser({ id: 'demo-2', email: 'employee04@teamwise.test' }),
      makeUser({ id: 'real-1', email: 'manager@clinic.org' }),
    ])

    expect(plan.summary.matched).toBe(2)
    expect(plan.matches.map((entry) => entry.user.id)).toEqual(['demo-1', 'demo-2'])
    expect(plan.matches[0]?.reasons).toContain('matches seeded test domain')
  })

  it('does not match real staff outside the seed patterns', () => {
    const plan = buildCleanupPlan([
      makeUser({ id: 'real-1', email: 'barbara@hospital.org' }),
      makeUser({ id: 'real-2', email: 'demo-support@hospital.org' }),
    ])

    expect(plan.matches).toEqual([])
    expect(plan.summary.skipped).toBe(2)
  })

  it('supports tighter domain scoping for shared environments', () => {
    const plan = buildCleanupPlan(
      [
        makeUser({ id: 'match-1', email: 'demo-therapist01@staging.local' }),
        makeUser({ id: 'skip-1', email: 'demo-therapist02@teamwise.test' }),
      ],
      {
        allowedDomains: ['staging.local'],
      }
    )

    expect(plan.matches.map((entry) => entry.user.id)).toEqual(['match-1'])
  })

  it('falls back to default rules when empty overrides are passed', () => {
    const plan = buildCleanupPlan(
      [makeUser({ id: 'demo-1', email: 'demo-therapist01@teamwise.test' })],
      {
        allowedDomains: [],
        emailPrefixes: [],
        exactEmails: [],
      }
    )

    expect(plan.matches.map((entry) => entry.user.id)).toEqual(['demo-1'])
  })
})
