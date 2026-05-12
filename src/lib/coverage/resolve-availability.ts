import type { AvailabilityOverrideRow, ShiftTypeForAvailability } from '@/lib/coverage/types'
import type { WorkPattern } from '@/lib/coverage/work-patterns'
import { findMatchingOverride } from '@/lib/availability-override-model'
import { isAllowedByPattern } from '@/lib/coverage/work-patterns'

export type EligibilityReason =
  | 'inactive'
  | 'on_fmla'
  | 'override_force_off'
  | 'override_force_on'
  | 'blocked_offs_dow'
  | 'blocked_every_other_weekend'
  | 'blocked_outside_works_dow_hard'
  | 'blocked_repeating_cycle_off_segment'
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
  /** True when a `force_on` override should drive auto-draft prioritization (manager or therapist request-to-work). */
  forcedByManager: boolean
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
    forcedByManager: false,
  }
}

export function resolveEligibility(params: ResolveEligibilityParams): EligibilityResolution {
  if (!params.therapist.is_active) {
    return buildResolution('inactive')
  }

  if (params.therapist.on_fmla) {
    return buildResolution('on_fmla')
  }

  const override = findMatchingOverride({
    overrides: params.overrides,
    therapistId: params.therapist.id,
    cycleId: params.cycleId,
    date: params.date,
    shiftType: params.shiftType,
  })

  if (override?.override_type === 'force_off') {
    const resolution = buildResolution('override_force_off', {
      overrideNote: override.note ?? null,
    })
    resolution.forcedByManager = override.source === 'manager'
    return resolution
  }

  if (override?.override_type === 'force_on') {
    const resolution = buildResolution('override_force_on', {
      overrideNote: override.note ?? null,
    })
    resolution.forcedByManager =
      override.source === 'manager' || override.source === 'therapist'
    return resolution
  }

  if (
    params.therapist.employment_type === 'prn' &&
    (!params.therapist.pattern || params.therapist.pattern.pattern_type === 'none')
  ) {
    return buildResolution('prn_not_offered_for_date')
  }

  if (params.therapist.pattern) {
    const patternDecision = isAllowedByPattern(params.therapist.pattern, params.date)
    if (!patternDecision.allowed) {
      return buildResolution(patternDecision.reason, {
        penalty: patternDecision.penalty,
      })
    }
    if (patternDecision.reason === 'soft_outside_works_dow') {
      return buildResolution('soft_outside_works_dow', {
        penalty: patternDecision.penalty,
      })
    }
  }

  return buildResolution('allowed')
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
  if (reason === 'blocked_repeating_cycle_off_segment') return 'Off in repeating cycle'
  if (reason === 'inactive') return 'Inactive therapist'
  if (reason === 'on_fmla') return 'Therapist on FMLA'
  if (reason === 'prn_not_offered_for_date') return 'PRN not offered for this date'
  return null
}
