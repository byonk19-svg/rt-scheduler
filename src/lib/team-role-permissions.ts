export type TeamManagedRole = 'manager' | 'lead' | 'therapist'

export type TeamRolePermissionRow = {
  label: string
  allowed: boolean
}

const BASE_PERMISSIONS = ['View schedule', 'Submit availability', 'View team roster'] as const

const LEAD_EXTRA_PERMISSIONS = ['Update assignment status'] as const
const MANAGER_EXTRA_PERMISSIONS = [
  'Approve swaps',
  'Publish schedule',
  'Manage team',
  'Edit staffing',
] as const

export function getTeamRolePermissions(role: TeamManagedRole): TeamRolePermissionRow[] {
  const allowed = new Set<string>(BASE_PERMISSIONS)

  if (role === 'lead' || role === 'manager') {
    for (const permission of LEAD_EXTRA_PERMISSIONS) {
      allowed.add(permission)
    }
  }

  if (role === 'manager') {
    for (const permission of MANAGER_EXTRA_PERMISSIONS) {
      allowed.add(permission)
    }
  }

  return [...BASE_PERMISSIONS, ...LEAD_EXTRA_PERMISSIONS, ...MANAGER_EXTRA_PERMISSIONS].map(
    (label) => ({
      label,
      allowed: allowed.has(label),
    })
  )
}
