import {
  addDays,
  dateFromKey,
  formatDateLabel,
  formatSubmittedDateTime,
  toIsoDate,
} from '@/lib/calendar-utils'

/** One row per therapist per cycle once they officially submit (see migration). */
export type TherapistAvailabilitySubmissionRow = {
  schedule_cycle_id: string
  submitted_at: string
  last_edited_at: string
}

export type TherapistAvailabilityCycleDeadlineInput = {
  start_date: string
  availability_due_at?: string | null
}

export type TherapistSubmissionUiState = {
  isSubmitted: boolean
  submittedAtDisplay: string | null
  lastEditedDisplay: string | null
}

const LAST_EDITED_EPSILON_MS = 2000

export function shouldShowLastEditedAfterSubmit(
  submittedAtIso: string,
  lastEditedAtIso: string
): boolean {
  const s = new Date(submittedAtIso).getTime()
  const l = new Date(lastEditedAtIso).getTime()
  if (!Number.isFinite(s) || !Number.isFinite(l)) return false
  return l > s + LAST_EDITED_EPSILON_MS
}

export function buildTherapistSubmissionUiState(
  submission: TherapistAvailabilitySubmissionRow | null | undefined
): TherapistSubmissionUiState {
  if (!submission) {
    return { isSubmitted: false, submittedAtDisplay: null, lastEditedDisplay: null }
  }
  const submittedAtDisplay = formatSubmittedDateTime(submission.submitted_at)
  const lastEditedDisplay = shouldShowLastEditedAfterSubmit(
    submission.submitted_at,
    submission.last_edited_at
  )
    ? formatSubmittedDateTime(submission.last_edited_at)
    : null
  return {
    isSubmitted: true,
    submittedAtDisplay,
    lastEditedDisplay,
  }
}

/**
 * Due line for staff dashboard + availability header when availability is not officially submitted.
 * Uses explicit cycle.availability_due_at when set; otherwise day-before-cycle-start (legacy).
 */
export function resolveAvailabilityDueSupportLine(
  cycle: TherapistAvailabilityCycleDeadlineInput,
  submitted: boolean,
  today?: string
): string | null {
  if (submitted) return null
  const todayKey = today ?? new Date().toISOString().slice(0, 10)

  if (cycle.availability_due_at) {
    const raw = cycle.availability_due_at
    const dueDateKey = raw.length >= 10 ? raw.slice(0, 10) : raw
    if (dueDateKey.length === 10 && dueDateKey < todayKey) {
      return 'Submit as soon as you can—your manager is still building this block.'
    }
    return `Due ${formatDateLabel(dueDateKey)}`
  }

  const preferredBy = toIsoDate(addDays(dateFromKey(cycle.start_date), -1))
  if (preferredBy < todayKey) {
    return 'Submit as soon as you can—your manager is still building this block.'
  }
  return `Due ${formatDateLabel(preferredBy)}`
}
