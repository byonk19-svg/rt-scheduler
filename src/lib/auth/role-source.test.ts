import { describe, expect, it } from 'vitest'

import { resolveUserRole } from '@/lib/auth/role-source'

describe('resolveUserRole', () => {
  it('prefers the profile role when present', () => {
    expect(resolveUserRole('therapist')).toBe('therapist')
  })

  it('does not grant a role when the profile role is missing', () => {
    expect(resolveUserRole(null)).toBeNull()
  })

  it('does not treat auth metadata as an authorization source', () => {
    expect(resolveUserRole(undefined)).toBeNull()
  })
})
