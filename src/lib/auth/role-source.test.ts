import { describe, expect, it } from 'vitest'

import { resolveUserRole } from '@/lib/auth/role-source'

const user = {
  app_metadata: {},
  user_metadata: {},
}

describe('resolveUserRole', () => {
  it('prefers the profile role when present', () => {
    expect(
      resolveUserRole('therapist', {
        ...user,
        user_metadata: { role: 'manager' },
      })
    ).toBe('therapist')
  })

  it('falls back to user metadata role for local seeded auth sessions without a profile row', () => {
    expect(
      resolveUserRole(null, {
        ...user,
        user_metadata: { role: 'manager' },
      })
    ).toBe('manager')
  })

  it('supports the user_role metadata key used by auth claims', () => {
    expect(
      resolveUserRole(null, {
        app_metadata: { user_role: 'lead' },
        user_metadata: {},
      })
    ).toBe('lead')
  })
})
