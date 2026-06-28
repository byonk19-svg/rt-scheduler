import { formatEligibilityReason, resolveEligibility } from '@/lib/coverage/resolve-availability'
import type { AvailabilityOverrideRow } from '@/lib/coverage/types'
import { normalizeWorkPattern, type WorkPattern } from '@/lib/coverage/work-patterns'
import {
  SCHEDULE_MUTATION_ERROR_CODES as ERROR_CODES,
  type ScheduleMutationErrorCode,
} from '@/lib/schedule-mutations/errors'
import type { createClient } from '@/lib/supabase/server'

type ScheduleMutationSupabaseClient = Awaited<ReturnType<typeof createClient>>
type ShiftType = 'day' | 'night'

export type ScheduleMutationAvailabilityProfile = {
  full_name: string | null
  is_active: boolean | null
  archived_at: string | null
  on_fmla: boolean | null
  employment_type: string | null
}

export type ScheduleMutationWorkPatternRow = {
  therapist_id: string
  pattern_type: WorkPattern['pattern_type'] | null
  works_dow: number[] | null
  offs_dow: number[] | null
  weekend_rotation: string | null
  weekend_anchor_date: string | null
  works_dow_mode: string | null
  weekly_weekdays?: number[] | null
  weekend_rule?: WorkPattern['weekend_rule'] | null
  cycle_anchor_date?: string | null
  cycle_segments?: WorkPattern['cycle_segments'] | null
  shift_preference: WorkPattern['shift_preference'] | null
}

export type ScheduleMutationAvailabilityState = {
  therapistName: string
  blockedByConstraints: boolean
  unavailableReason: string | null
  forceOff: boolean
  forceOn: boolean
  inactiveOrFmla: boolean
  prnNotOffered: boolean
}

type ScheduleMutationAvailabilityFailure = {
  ok: false
  status: 409 | 500
  error: string
  code: ScheduleMutationErrorCode
  details?: Record<string, unknown>
}

export type ScheduleMutationAvailabilityValidationResult =
  | {
      ok: true
      availabilityState: ScheduleMutationAvailabilityState
    }
  | ScheduleMutationAvailabilityFailure

export async function validateScheduleMutationAvailability(
  supabase: ScheduleMutationSupabaseClient,
  params: {
    therapistId: string
    managerSiteId: string
    cycleId: string
    date: string
    shiftType: ShiftType
    availabilityOverride: boolean
  }
): Promise<ScheduleMutationAvailabilityValidationResult> {
  const availabilityState = await loadTherapistAvailabilityState(supabase, params)

  if ('error' in availabilityState) {
    return {
      ok: false,
      status: 500,
      error: availabilityState.error,
      code: ERROR_CODES.internalError,
    }
  }

  if (
    availabilityState.blockedByConstraints &&
    (availabilityState.inactiveOrFmla || availabilityState.prnNotOffered)
  ) {
    return {
      ok: false,
      status: 409,
      error: availabilityState.unavailableReason ?? 'This therapist cannot be assigned.',
      code: ERROR_CODES.therapistUnassignable,
    }
  }

  if (availabilityState.blockedByConstraints && params.availabilityOverride !== true) {
    return {
      ok: false,
      status: 409,
      error: 'Conflicts with scheduling constraints.',
      code: ERROR_CODES.availabilityConflict,
      details: {
        availability: {
          therapistId: params.therapistId,
          therapistName: availabilityState.therapistName,
          date: params.date,
          shiftType: params.shiftType,
          reason: availabilityState.unavailableReason,
        },
      },
    }
  }

  return {
    ok: true,
    availabilityState,
  }
}

async function loadTherapistAvailabilityState(
  supabase: ScheduleMutationSupabaseClient,
  params: {
    therapistId: string
    managerSiteId: string
    cycleId: string
    date: string
    shiftType: ShiftType
  }
): Promise<ScheduleMutationAvailabilityState | { error: string }> {
  const [profileResult, availabilityResult, patternResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, is_active, archived_at, on_fmla, employment_type')
      .eq('id', params.therapistId)
      .eq('site_id', params.managerSiteId)
      .maybeSingle(),
    supabase
      .from('availability_overrides')
      .select('cycle_id, therapist_id, date, shift_type, override_type, note')
      .eq('therapist_id', params.therapistId)
      .eq('cycle_id', params.cycleId)
      .eq('date', params.date),
    supabase
      .from('work_patterns')
      .select(
        'therapist_id, pattern_type, works_dow, offs_dow, weekend_rotation, weekend_anchor_date, works_dow_mode, weekly_weekdays, weekend_rule, cycle_anchor_date, cycle_segments, shift_preference'
      )
      .eq('therapist_id', params.therapistId)
      .maybeSingle(),
  ])

  if (
    profileResult.error ||
    availabilityResult.error ||
    patternResult.error ||
    !profileResult.data
  ) {
    return {
      error: 'Failed to validate availability constraints.',
    }
  }

  const profile = profileResult.data as ScheduleMutationAvailabilityProfile
  const therapistName = String(profile.full_name ?? 'Therapist')
  const pattern = buildWorkPattern(params.therapistId, patternResult.data)
  const overrides = (availabilityResult.data ?? []) as AvailabilityOverrideRow[]
  const resolution = resolveEligibility({
    therapist: {
      id: params.therapistId,
      is_active: profile.is_active !== false,
      on_fmla: Boolean(profile.archived_at) || profile.on_fmla === true,
      employment_type:
        profile.employment_type === 'prn'
          ? 'prn'
          : profile.employment_type === 'part_time'
            ? 'part_time'
            : 'full_time',
      pattern,
    },
    cycleId: params.cycleId,
    date: params.date,
    shiftType: params.shiftType,
    overrides,
  })
  const reasonLabel = formatEligibilityReason(resolution.reason)

  return {
    therapistName,
    blockedByConstraints: !resolution.allowed,
    unavailableReason: reasonLabel,
    forceOff: resolution.reason === 'override_force_off',
    forceOn: resolution.offeredByOverride,
    inactiveOrFmla: resolution.reason === 'inactive' || resolution.reason === 'on_fmla',
    prnNotOffered: resolution.prnNotOffered,
  }
}

function buildWorkPattern(therapistId: string, row: unknown): WorkPattern {
  const pattern = row as ScheduleMutationWorkPatternRow | null

  if (!pattern) {
    return normalizeWorkPattern({
      therapist_id: therapistId,
      works_dow: [],
      offs_dow: [],
      weekend_rotation: 'none',
      weekend_anchor_date: null,
      works_dow_mode: 'hard',
      shift_preference: 'either',
    })
  }

  return normalizeWorkPattern({
    therapist_id: therapistId,
    pattern_type: pattern.pattern_type ?? undefined,
    works_dow: pattern.works_dow ?? undefined,
    offs_dow: pattern.offs_dow ?? undefined,
    weekend_rotation: pattern.weekend_rotation === 'every_other' ? 'every_other' : undefined,
    weekend_anchor_date: pattern.weekend_anchor_date,
    works_dow_mode: pattern.works_dow_mode === 'soft' ? 'soft' : undefined,
    weekly_weekdays: pattern.weekly_weekdays ?? pattern.works_dow ?? [],
    weekend_rule: pattern.weekend_rule ?? undefined,
    cycle_anchor_date: pattern.cycle_anchor_date ?? null,
    cycle_segments: pattern.cycle_segments ?? [],
    shift_preference: pattern.shift_preference,
  })
}
