import type { User } from '@supabase/supabase-js'

import { parseRole, type Role } from '@/lib/auth/roles'

export function resolveUserRole(
  profileRole: unknown,
  user: Pick<User, 'app_metadata' | 'user_metadata'>
): Role | null {
  return (
    parseRole(profileRole) ??
    parseRole(user.app_metadata?.user_role) ??
    parseRole(user.app_metadata?.role) ??
    parseRole(user.user_metadata?.user_role) ??
    parseRole(user.user_metadata?.role)
  )
}
