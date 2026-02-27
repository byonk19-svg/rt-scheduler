import type { AvailabilityOverrideRow, ShiftTypeForAvailability } from '@/lib/coverage/types'
import type { WorkPattern } from '@/lib/coverage/work-patterns'
import { isAllowedByPattern, shiftTypeMatches } from '@/lib/coverage/work-patterns'

export type EligibilityReason =
  | 'inactive'
  | 'on_fmla'
  | 'override_force_off'
  | 'override_force_on'
  | 'blocked_offs_dow'
  | 'blocked_every_other_weekend'
  | 'blocked_outside_works_dow_hard'
  | 'soft_outside_works_dow'
  | 'prn_not_offered_for_date'
  | 'allowed'

export type EligibilityTherapist = {
  id: string
  is_active: boolean
  on_fmla: boolean
  employment_type: 'full_time' | 'part_time' | 'prn'
  pattern: WorkPattern | null
}

export type ResolveEligibilityParams = {
  therapist: EligibilityTherapist
  cycleId: string
  date: string
  shiftType: Exclude<ShiftTypeForAvailability, 'both'>
  overrides: AvailabilityOverrideRow[]
}

export type EligibilityResolution = {
  allowed: boolean
  reason: EligibilityReason
  reasons: EligibilityReason[]
  penalty: number
  overrideNote?: string | null
  offeredByOverride: boolean
  prnNotOffered: boolean
}

export type ResolveAvailabilityParams = {
  therapistId: string
  cycleId: string
  date: string
  shiftType: Exclude<ShiftTypeForAvailability, 'both'>
  isActive: boolean
  onFmla: boolean
  employmentType?: 'full_time' | 'part_time' | 'prn'
  pattern: WorkPattern | null
  overrides: AvailabilityOverrideRow[]
}

export type AvailabilityResolution = EligibilityResolution

function getWeekdayIndex(value: string): number | null {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.getDay()
}

function buildResolution(
  reason: EligibilityReason,
  options?: {
    overrideNote?: string | null
    penalty?: number
  }
): EligibilityResolution {
  const allowed =
    reason === 'allowed' ||
    reason === 'override_force_on' ||
    reason === 'soft_outside_works_dow'

  return {
    allowed,
    reason,
    reasons: [reason],
    penalty: options?.penalty ?? 0,
    overrideNote: options?.overrideNote,
    offeredByOverride: reason === 'override_force_on',
    prnNotOffered: reason === 'prn_not_offered_for_date',
  }
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

export function resolveEligibility(params: ResolveEligibilityParams): EligibilityResolution {
  if (!params.therapist.is_active) {
    return buildResolution('inactive')
  }

  if (params.therapist.on_fmla) {
    return buildResolution('on_fmla')
  }

  const override = findMatchingOverride(
    params.overrides,
    params.therapist.id,
    params.cycleId,
    params.date,
    params.shiftType
  )

  if (override?.override_type === 'force_off') {
    return buildResolution('override_force_off', {
      overrideNote: override.note ?? null,
    })
  }

  if (override?.override_type === 'force_on') {
    return buildResolution('override_force_on', {
      overrideNote: override.note ?? null,
    })
  }

  if (!params.therapist.pattern) {
    if (params.therapist.employment_type === 'prn') {
      return buildResolution('prn_not_offered_for_date')
    }
    return buildResolution('allowed')
  }

  const patternDecision = isAllowedByPattern(params.therapist.pattern, params.date)
  if (!patternDecision.allowed) {
    return buildResolution(patternDecision.reason, { penalty: patternDecision.penalty })
  }

  if (params.therapist.employment_type === 'prn') {
    const weekday = getWeekdayIndex(params.date)
    const dayOfferedByPattern =
      weekday !== null && params.therapist.pattern.works_dow.includes(weekday)
    if (!dayOfferedByPattern) {
      return buildResolution('prn_not_offered_for_date')
    }
  }

  return buildResolution(patternDecision.reason, { penalty: patternDecision.penalty })
}

export function resolveAvailability(params: ResolveAvailabilityParams): AvailabilityResolution {
  return resolveEligibility({
    therapist: {
      id: params.therapistId,
      is_active: params.isActive,
      on_fmla: params.onFmla,
      employment_type: params.employmentType ?? 'full_time',
      pattern: params.pattern,
    },
    cycleId: params.cycleId,
    date: params.date,
    shiftType: params.shiftType,
    overrides: params.overrides,
  })
}

export function formatEligibilityReason(reason: EligibilityReason): string | null {
  if (reason === 'override_force_off') return 'Force off override'
  if (reason === 'blocked_offs_dow') return 'Never works this weekday'
  if (reason === 'blocked_every_other_weekend') return 'Off weekend by alternating rotation'
  if (reason === 'blocked_outside_works_dow_hard') return 'Outside hard works-day rule'
  if (reason === 'inactive') return 'Inactive therapist'
  if (reason === 'on_fmla') return 'Therapist on FMLA'
  if (reason === 'prn_not_offered_for_date') return 'PRN not offered for this date'
  return null
}
