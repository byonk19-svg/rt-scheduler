import { parseRole, type Role } from '@/lib/auth/roles'

export function resolveUserRole(profileRole: unknown): Role | null {
  return parseRole(profileRole)
}
