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
  end_date?: string
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

function localDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function daysBetweenDateKeys(fromKey: string, toKey: string): number {
  const from = dateFromKey(fromKey)
  const to = dateFromKey(toKey)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0
  return Math.round((to.getTime() - from.getTime()) / 86400000)
}

function endOfLocalDay(dateKey: string): Date {
  const d = dateFromKey(dateKey)
  d.setHours(23, 59, 59, 999)
  return d
}

function resolveAvailabilityDeadline(cycle: TherapistAvailabilityCycleDeadlineInput): {
  deadlineDateKey: string
  deadlineInstant: Date
} {
  if (cycle.availability_due_at) {
    const raw = cycle.availability_due_at
    const parsed = new Date(raw)
    if (!Number.isNaN(parsed.getTime())) {
      return {
        deadlineDateKey: localDateKey(parsed),
        deadlineInstant: parsed,
      }
    }

    const fallbackKey =
      raw.length >= 10 ? raw.slice(0, 10) : toIsoDate(addDays(dateFromKey(cycle.start_date), -1))
    const deadlineDateKey =
      fallbackKey.length === 10 ? fallbackKey : toIsoDate(dateFromKey(cycle.start_date))
    return {
      deadlineDateKey,
      deadlineInstant: endOfLocalDay(deadlineDateKey),
    }
  }

  const deadlineDateKey = toIsoDate(addDays(dateFromKey(cycle.start_date), -1))
  return {
    deadlineDateKey,
    deadlineInstant: endOfLocalDay(deadlineDateKey),
  }
}

export type TherapistAvailabilityWritePermission =
  | { allowed: true; reason: 'ok' }
  | { allowed: false; reason: 'deadline_passed' | 'cycle_ended' }

export function resolveTherapistAvailabilityWritePermission(
  cycle: Pick<
    TherapistAvailabilityCycleDeadlineInput,
    'start_date' | 'end_date' | 'availability_due_at'
  >,
  hasOfficialSubmission: boolean,
  now?: Date
): TherapistAvailabilityWritePermission {
  const clock = now ?? new Date()
  const todayKey = localDateKey(clock)

  if (cycle.end_date && todayKey > cycle.end_date) {
    return { allowed: false, reason: 'cycle_ended' }
  }

  if (hasOfficialSubmission) {
    return { allowed: true, reason: 'ok' }
  }

  const { deadlineInstant } = resolveAvailabilityDeadline(cycle)
  if (clock.getTime() > deadlineInstant.getTime()) {
    return { allowed: false, reason: 'deadline_passed' }
  }

  return { allowed: true, reason: 'ok' }
}

export type TherapistDeadlineEmphasis = 'neutral' | 'urgent' | 'past' | 'submitted'

export type TherapistDeadlinePresentation = {
  /** Not submitted: prominent deadline message. Submitted: null. */
  deadlineHeadline: string | null
  /** Submitted: primary status line with timestamp(s). */
  submittedPrimaryLine: string | null
  /** Submitted: optional context about the cycle deadline date. */
  submittedDeadlineContextLine: string | null
  emphasis: TherapistDeadlineEmphasis
}

function resolveNotSubmittedHeadline(
  cycle: TherapistAvailabilityCycleDeadlineInput,
  now: Date
): { headline: string; emphasis: TherapistDeadlineEmphasis } {
  const todayKey = localDateKey(now)
  const { deadlineDateKey, deadlineInstant } = resolveAvailabilityDeadline(cycle)

  const isPast = now.getTime() > deadlineInstant.getTime()

  if (isPast) {
    return {
      headline: `Past due — final deadline was ${formatDateLabel(deadlineDateKey)}`,
      emphasis: 'past',
    }
  }

  const dayDiff = daysBetweenDateKeys(todayKey, deadlineDateKey)
  if (dayDiff === 0) {
    return { headline: 'Due today', emphasis: 'urgent' }
  }
  if (dayDiff === 1) {
    return { headline: 'Due tomorrow', emphasis: 'urgent' }
  }
  return {
    headline: `Due ${formatDateLabel(deadlineDateKey)}`,
    emphasis: 'neutral',
  }
}

/**
 * Therapist availability page: deadline + submission lines with correct instant-based past logic.
 */
export function resolveTherapistDeadlinePresentation(
  cycle: TherapistAvailabilityCycleDeadlineInput,
  submission: TherapistSubmissionUiState,
  now?: Date
): TherapistDeadlinePresentation {
  const clock = now ?? new Date()

  const { deadlineDateKey: deadlineDateKeyForContext } = resolveAvailabilityDeadline(cycle)

  if (!submission.isSubmitted) {
    const { headline, emphasis } = resolveNotSubmittedHeadline(cycle, clock)
    return {
      deadlineHeadline: headline,
      submittedPrimaryLine: null,
      submittedDeadlineContextLine: null,
      emphasis,
    }
  }

  const primaryParts: string[] = []
  if (submission.submittedAtDisplay) {
    primaryParts.push(`Submitted ${submission.submittedAtDisplay}`)
  }
  if (submission.lastEditedDisplay) {
    primaryParts.push(`Last edited ${submission.lastEditedDisplay}`)
  }

  return {
    deadlineHeadline: null,
    submittedPrimaryLine: primaryParts.length > 0 ? primaryParts.join(' · ') : null,
    submittedDeadlineContextLine: `Final deadline was ${formatDateLabel(deadlineDateKeyForContext)}`,
    emphasis: 'submitted',
  }
}

/**
 * Short due line for staff dashboard when availability is not officially submitted.
 * Uses the same deadline rules as the therapist availability page.
 */
export function resolveAvailabilityDueSupportLine(
  cycle: TherapistAvailabilityCycleDeadlineInput,
  submitted: boolean,
  now?: Date
): string | null {
  if (submitted) return null
  const clock = now ?? new Date()
  return resolveNotSubmittedHeadline(cycle, clock).headline
}
