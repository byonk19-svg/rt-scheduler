import { parseRole, type Role } from '@/lib/auth/roles'

export type Permission =
  | 'access_manager_ui'
  | 'manage_schedule'
  | 'manage_publish'
  | 'manage_directory'
  | 'manage_coverage'
  | 'review_shift_posts'
  | 'export_all_availability'
  | 'update_assignment_status'

type CanContext = {
  isLeadEligible?: boolean
}

function isManagerRole(role: Role | null): boolean {
  return role === 'manager'
}

export function can(roleInput: unknown, permission: Permission, context: CanContext = {}): boolean {
  const role = parseRole(roleInput)

  if (
    permission === 'access_manager_ui' ||
    permission === 'manage_schedule' ||
    permission === 'manage_publish' ||
    permission === 'manage_directory' ||
    permission === 'manage_coverage' ||
    permission === 'review_shift_posts' ||
    permission === 'export_all_availability'
  ) {
    return isManagerRole(role)
  }

  if (permission === 'update_assignment_status') {
    if (isManagerRole(role) || role === 'lead') return true
    if (role === 'therapist' || role === 'staff') return context.isLeadEligible === true
    return false
  }

  return false
}
