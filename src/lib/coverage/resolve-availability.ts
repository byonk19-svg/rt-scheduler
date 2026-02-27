import type { AvailabilityOverrideRow, ShiftTypeForAvailability } from '@/lib/coverage/types'
import type { WorkPattern } from '@/lib/coverage/work-patterns'
import { isAllowedByPattern, shiftTypeMatches } from '@/lib/coverage/work-patterns'

export type ResolveAvailabilityParams = {
  therapistId: string
  cycleId: string
  date: string
  shiftType: Exclude<ShiftTypeForAvailability, 'both'>
  isActive: boolean
  onFmla: boolean
  pattern: WorkPattern | null
  overrides: AvailabilityOverrideRow[]
}

export type AvailabilityResolution = {
  allowed: boolean
  reason:
    | 'inactive'
    | 'on_fmla'
    | 'override_force_off'
    | 'override_force_on'
    | 'blocked_offs_dow'
    | 'blocked_every_other_weekend'
    | 'blocked_outside_works_dow_hard'
    | 'soft_outside_works_dow'
    | 'allowed'
  penalty: number
  overrideNote?: string | null
}

function findMatchingOverride(
  overrides: AvailabilityOverrideRow[],
  therapistId: string,
  cycleId: string,
  date: string,
  shiftType: Exclude<ShiftTypeForAvailability, 'both'>
): AvailabilityOverrideRow | null {
  const sameScope = overrides.filter(
    (override) =>
      override.therapist_id === therapistId &&
      override.cycle_id === cycleId &&
      override.date === date &&
      shiftTypeMatches(override.shift_type, shiftType)
  )
  if (sameScope.length === 0) return null

  const exact = sameScope.find((override) => override.shift_type === shiftType)
  if (exact) return exact

  return sameScope[0] ?? null
}

export function resolveAvailability(params: ResolveAvailabilityParams): AvailabilityResolution {
  if (!params.isActive) {
    return {
      allowed: false,
      reason: 'inactive',
      penalty: 0,
    }
  }

  if (params.onFmla) {
    return {
      allowed: false,
      reason: 'on_fmla',
      penalty: 0,
    }
  }

  const override = findMatchingOverride(
    params.overrides,
    params.therapistId,
    params.cycleId,
    params.date,
    params.shiftType
  )

  if (override?.override_type === 'force_off') {
    return {
      allowed: false,
      reason: 'override_force_off',
      penalty: 0,
      overrideNote: override.note ?? null,
    }
  }

  if (override?.override_type === 'force_on') {
    return {
      allowed: true,
      reason: 'override_force_on',
      penalty: 0,
      overrideNote: override.note ?? null,
    }
  }

  if (!params.pattern) {
    return {
      allowed: true,
      reason: 'allowed',
      penalty: 0,
    }
  }

  const decision = isAllowedByPattern(params.pattern, params.date)
  return {
    allowed: decision.allowed,
    reason: decision.reason,
    penalty: decision.penalty,
  }
}
