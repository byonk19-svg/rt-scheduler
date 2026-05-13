import type { AvailabilityOverrideRow } from '@/app/schedule/types'
import {
  classifyOverrideOutcome,
  type OverrideScheduleShift,
} from '@/lib/availability-override-model'

export type AvailabilityPublishShiftRow = OverrideScheduleShift & {
  user_id: string
  availability_override?: boolean | null
  availability_override_reason?: string | null
  availability_override_by?: string | null
  availability_override_at?: string | null
}

export type AvailabilityPublishValidationInput = {
  overrides: AvailabilityOverrideRow[]
  scheduledShifts: AvailabilityPublishShiftRow[]
  expectedTherapistIds?: Iterable<string>
  submittedTherapistIds?: Iterable<string>
  availabilityProvidedTherapistIds?: Iterable<string>
}

export type AvailabilityPublishValidationSummary = {
  needToWorkMisses: number
  needOffOverridesMissingReason: number
  missingAvailabilitySubmissions: number
}

export function summarizeAvailabilityPublishIssues({
  overrides,
  scheduledShifts,
  expectedTherapistIds = [],
  submittedTherapistIds = [],
  availabilityProvidedTherapistIds,
}: AvailabilityPublishValidationInput): AvailabilityPublishValidationSummary {
  let needToWorkMisses = 0
  let needOffOverridesMissingReason = 0

  for (const override of overrides) {
    const outcome = classifyOverrideOutcome({ override, scheduledShifts })
    if (outcome.kind === 'violated' && outcome.reason === 'force_on_not_scheduled') {
      needToWorkMisses += 1
      continue
    }

    if (outcome.kind !== 'violated' || outcome.reason !== 'force_off_scheduled') continue

    const matchingScheduledShifts = scheduledShifts.filter(
      (shift) =>
        shift.user_id === override.therapist_id &&
        shift.date === override.date &&
        (override.shift_type === 'both' || shift.shift_type === override.shift_type)
    )
    if (
      matchingScheduledShifts.some(
        (shift) =>
          shift.availability_override !== true ||
          !shift.availability_override_reason?.trim() ||
          !shift.availability_override_by ||
          !shift.availability_override_at
      )
    ) {
      needOffOverridesMissingReason += 1
    }
  }

  const submitted = new Set(submittedTherapistIds)
  const provided =
    availabilityProvidedTherapistIds == null
      ? new Set(overrides.map((override) => override.therapist_id))
      : new Set(availabilityProvidedTherapistIds)
  let missingAvailabilitySubmissions = 0
  for (const therapistId of expectedTherapistIds) {
    if (!submitted.has(therapistId) && !provided.has(therapistId)) {
      missingAvailabilitySubmissions += 1
    }
  }

  return {
    needToWorkMisses,
    needOffOverridesMissingReason,
    missingAvailabilitySubmissions,
  }
}
