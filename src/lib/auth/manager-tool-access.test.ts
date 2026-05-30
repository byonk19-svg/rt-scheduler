import { describe, expect, it } from 'vitest'

import { resolveManagerToolAccess } from '@/lib/auth/manager-tool-access'

describe('resolveManagerToolAccess', () => {
  it('allows active managers for manager permissions', () => {
    expect(
      resolveManagerToolAccess({
        role: 'manager',
        is_active: true,
        archived_at: null,
      })
    ).toBe('allowed')
  })

  it('returns forbidden for active non-manager roles', () => {
    expect(
      resolveManagerToolAccess({
        role: 'therapist',
        is_active: true,
        archived_at: null,
      })
    ).toBe('forbidden')
    expect(
      resolveManagerToolAccess({
        role: 'lead',
        is_active: true,
        archived_at: null,
      })
    ).toBe('forbidden')
  })

  it('returns inactive before role denial for inactive or archived accounts', () => {
    expect(
      resolveManagerToolAccess({
        role: 'manager',
        is_active: false,
        archived_at: null,
      })
    ).toBe('inactive')
    expect(
      resolveManagerToolAccess({
        role: 'therapist',
        is_active: true,
        archived_at: '2026-05-30T12:00:00.000Z',
      })
    ).toBe('inactive')
  })

  it('honors specific manager-only permissions', () => {
    expect(
      resolveManagerToolAccess(
        {
          role: 'manager',
          is_active: true,
          archived_at: null,
        },
        'manage_publish'
      )
    ).toBe('allowed')
    expect(
      resolveManagerToolAccess(
        {
          role: 'lead',
          is_active: true,
          archived_at: null,
        },
        'manage_publish'
      )
    ).toBe('forbidden')
  })
})
