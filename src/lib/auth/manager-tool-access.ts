import { can, type Permission } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'

type ManagerToolProfile = {
  role?: unknown
  is_active?: boolean | null
  archived_at?: string | null
}

export type ManagerToolAccessState = 'allowed' | 'inactive' | 'forbidden'

export function resolveManagerToolAccess(
  profile: ManagerToolProfile | null | undefined,
  permission: Permission = 'access_manager_ui'
): ManagerToolAccessState {
  if (profile?.is_active === false || profile?.archived_at) {
    return 'inactive'
  }

  return can(parseRole(profile?.role), permission) ? 'allowed' : 'forbidden'
}
