import { describe, expect, it } from 'vitest'

import { getTeamRolePermissions } from '@/lib/team-role-permissions'

describe('getTeamRolePermissions', () => {
  it('returns full manager permissions', () => {
    expect(getTeamRolePermissions('manager')).toEqual([
      { label: 'View schedule', allowed: true },
      { label: 'Submit availability', allowed: true },
      { label: 'View team roster', allowed: true },
      { label: 'Update assignment status', allowed: true },
      { label: 'Approve swaps', allowed: true },
      { label: 'Publish schedule', allowed: true },
      { label: 'Manage team', allowed: true },
      { label: 'Edit staffing', allowed: true },
    ])
  })

  it('returns lead permissions', () => {
    expect(getTeamRolePermissions('lead')).toEqual([
      { label: 'View schedule', allowed: true },
      { label: 'Submit availability', allowed: true },
      { label: 'View team roster', allowed: true },
      { label: 'Update assignment status', allowed: true },
      { label: 'Approve swaps', allowed: false },
      { label: 'Publish schedule', allowed: false },
      { label: 'Manage team', allowed: false },
      { label: 'Edit staffing', allowed: false },
    ])
  })

  it('returns therapist permissions', () => {
    expect(getTeamRolePermissions('therapist')).toEqual([
      { label: 'View schedule', allowed: true },
      { label: 'Submit availability', allowed: true },
      { label: 'View team roster', allowed: true },
      { label: 'Update assignment status', allowed: false },
      { label: 'Approve swaps', allowed: false },
      { label: 'Publish schedule', allowed: false },
      { label: 'Manage team', allowed: false },
      { label: 'Edit staffing', allowed: false },
    ])
  })
})
