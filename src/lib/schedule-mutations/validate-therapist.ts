import {
  SCHEDULE_MUTATION_ERROR_CODES as ERROR_CODES,
  type ScheduleMutationErrorCode,
} from '@/lib/schedule-mutations/errors'
import type { createClient } from '@/lib/supabase/server'

type ScheduleMutationSupabaseClient = Awaited<ReturnType<typeof createClient>>
type ScheduleMutationStatus = 403 | 409

type ShiftType = 'day' | 'night'

export type AssignableTherapistProfile = {
  site_id: string | null
  shift_type: string | null
  is_active: boolean | null
  archived_at: string | null
  on_fmla: boolean | null
}

export type LeadEligibleTherapistProfile = AssignableTherapistProfile & {
  id: string
  role: string | null
  is_lead_eligible: boolean | null
}

type TherapistValidationFailure = {
  ok: false
  status: ScheduleMutationStatus
  error: string
  code: ScheduleMutationErrorCode
}

export type AssignableTherapistValidationResult =
  | {
      ok: true
      therapist: AssignableTherapistProfile
    }
  | TherapistValidationFailure

export type LeadEligibleTherapistValidationResult =
  | {
      ok: true
      therapist: LeadEligibleTherapistProfile
    }
  | TherapistValidationFailure

function validateAssignableProfile(
  therapist: AssignableTherapistProfile | null,
  managerSiteId: string,
  shiftType: ShiftType
): AssignableTherapistValidationResult {
  if (!therapist || therapist.site_id !== managerSiteId) {
    return {
      ok: false,
      status: 403,
      error: 'Therapist is outside your site scope.',
      code: ERROR_CODES.outsideSiteScope,
    }
  }

  if (therapist.shift_type !== shiftType) {
    return {
      ok: false,
      status: 409,
      error: 'Therapist shift type does not match the selected schedule shift.',
      code: ERROR_CODES.therapistShiftTypeMismatch,
    }
  }

  if (
    therapist.is_active === false ||
    Boolean(therapist.archived_at) ||
    therapist.on_fmla === true
  ) {
    return {
      ok: false,
      status: 409,
      error: 'This therapist cannot be assigned.',
      code: ERROR_CODES.therapistUnassignable,
    }
  }

  return {
    ok: true,
    therapist,
  }
}

export async function validateAssignableTherapist(
  supabase: ScheduleMutationSupabaseClient,
  therapistId: string,
  managerSiteId: string,
  shiftType: ShiftType
): Promise<AssignableTherapistValidationResult> {
  const { data, error } = await supabase
    .from('profiles')
    .select('site_id, shift_type, is_active, archived_at, on_fmla')
    .eq('id', therapistId)
    .maybeSingle()

  if (error) {
    return {
      ok: false,
      status: 403,
      error: 'Therapist is outside your site scope.',
      code: ERROR_CODES.outsideSiteScope,
    }
  }

  return validateAssignableProfile(
    (data as AssignableTherapistProfile | null) ?? null,
    managerSiteId,
    shiftType
  )
}

export async function validateLeadEligibleTherapist(
  supabase: ScheduleMutationSupabaseClient,
  therapistId: string,
  managerSiteId: string,
  shiftType: ShiftType
): Promise<LeadEligibleTherapistValidationResult> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, is_lead_eligible, site_id, shift_type, is_active, archived_at, on_fmla')
    .eq('id', therapistId)
    .maybeSingle()

  const therapist = (data as LeadEligibleTherapistProfile | null) ?? null

  if (
    error ||
    !therapist ||
    (therapist.role !== 'therapist' && therapist.role !== 'lead') ||
    !therapist.is_lead_eligible
  ) {
    return {
      ok: false,
      status: 409,
      error: 'Only lead-eligible therapists can be designated as lead.',
      code: ERROR_CODES.leadNotEligible,
    }
  }

  return validateAssignableProfile(therapist, managerSiteId, shiftType) as
    | {
        ok: true
        therapist: LeadEligibleTherapistProfile
      }
    | TherapistValidationFailure
}
