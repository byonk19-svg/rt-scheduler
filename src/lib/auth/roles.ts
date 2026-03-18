export const ROLE_VALUES = ['manager', 'therapist', 'lead'] as const
export const TEAM_MEMBER_ROLE_VALUES = ['therapist', 'lead'] as const
export const MANAGED_TEAM_ROLE_VALUES = ['manager', 'therapist', 'lead'] as const

export type Role = (typeof ROLE_VALUES)[number]
export type UiRole = 'manager' | 'therapist'

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && ROLE_VALUES.includes(value as Role)
}

export function parseRole(value: unknown): Role | null {
  if (!isRole(value)) return null
  return value
}

export function toUiRole(value: unknown): UiRole {
  return parseRole(value) === 'manager' ? 'manager' : 'therapist'
}
