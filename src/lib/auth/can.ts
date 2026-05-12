import { parseRole, type Role } from '@/lib/auth/roles'

export type Permission =
  | 'access_manager_ui'
  | 'access_lead_tools'
  | 'manage_schedule'
  | 'manage_publish'
  | 'manage_directory'
  | 'manage_coverage'
  | 'review_shift_posts'
  | 'export_all_availability'
  | 'view_audit_log'
  | 'update_assignment_status'

type CanContext = {
  isLeadEligible?: boolean
  isActive?: boolean
  archivedAt?: string | null
}

function isManagerRole(role: Role | null): boolean {
  return role === 'manager'
}

function isLeadToolsRole(role: Role | null): boolean {
  return role === 'manager' || role === 'lead'
}

export function can(roleInput: unknown, permission: Permission, context: CanContext = {}): boolean {
  const role = parseRole(roleInput)
  void context

  if (context.isActive === false || context.archivedAt) {
    return false
  }

  if (
    permission === 'access_manager_ui' ||
    permission === 'manage_schedule' ||
    permission === 'manage_publish' ||
    permission === 'manage_directory' ||
    permission === 'manage_coverage' ||
    permission === 'review_shift_posts' ||
    permission === 'export_all_availability' ||
    permission === 'view_audit_log'
  ) {
    return isManagerRole(role)
  }

  if (permission === 'access_lead_tools') {
    return isLeadToolsRole(role)
  }

  if (permission === 'update_assignment_status') {
    return isLeadToolsRole(role)
  }

  return false
}
