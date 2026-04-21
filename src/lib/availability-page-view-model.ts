import { buildMissingAvailabilityRows } from '@/lib/employee-directory'
import type { AvailabilitySummaryChip } from '@/components/availability/availability-summary-chips'

type PlannerTherapist = {
  id: string
  full_name: string
}

type AvailabilityEntry = {
  id: string
  therapist_id: string
  cycle_id: string
  date: string
  shift_type: 'day' | 'night' | 'both'
  override_type: 'force_off' | 'force_on'
  note: string | null
  created_at: string
  source?: 'therapist' | 'manager' | null
}

type AvailabilityStatusRow = ReturnType<typeof buildMissingAvailabilityRows>[number]

export function getTodayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`
}

export function buildAvailabilitySubmissionMap(
  rows: Array<{ schedule_cycle_id: string; submitted_at: string; last_edited_at: string }>
): Record<string, { submittedAt: string; lastEditedAt: string }> {
  const submissionsByCycleId: Record<string, { submittedAt: string; lastEditedAt: string }> = {}
  for (const row of rows) {
    submissionsByCycleId[row.schedule_cycle_id] = {
      submittedAt: row.submitted_at,
      lastEditedAt: row.last_edited_at,
    }
  }
  return submissionsByCycleId
}

function toMissingAvailabilityRows(
  therapists: PlannerTherapist[],
  entries: AvailabilityEntry[],
  selectedCycleId: string,
  options?: {
    officialSubmissionTherapistIds?: Set<string>
    countAnyOverrideAsSubmitted?: boolean
  }
) {
  const buildOptions = options?.officialSubmissionTherapistIds
    ? {
        officialSubmissionTherapistIds: options.officialSubmissionTherapistIds,
        countAnyOverrideAsSubmitted: options.countAnyOverrideAsSubmitted,
      }
    : undefined

  return buildMissingAvailabilityRows(
    therapists.map((therapist) => ({
      id: therapist.id,
      full_name: therapist.full_name,
      is_active: true,
    })),
    entries.map((entry) => ({
      id: entry.id,
      therapist_id: entry.therapist_id,
      cycle_id: entry.cycle_id,
      date: entry.date,
      shift_type: entry.shift_type,
      override_type: entry.override_type,
      note: entry.note,
      created_at: entry.created_at,
      source: entry.source === 'manager' ? 'manager' : 'therapist',
    })),
    selectedCycleId,
    buildOptions
  )
}

export function buildManagerAvailabilityRosterViewModel(params: {
  therapists: PlannerTherapist[]
  entries: AvailabilityEntry[]
  selectedCycleId: string
  officialSubmissionTherapistIds: Set<string>
}): {
  officiallySubmittedRows: AvailabilityStatusRow[]
  awaitingOfficialSubmissionRows: AvailabilityStatusRow[]
  responseRosterSubmittedRows: AvailabilityStatusRow[]
  responseRosterMissingRows: AvailabilityStatusRow[]
} {
  const officialAvailabilityStatusRows = toMissingAvailabilityRows(
    params.therapists,
    params.entries,
    params.selectedCycleId,
    { officialSubmissionTherapistIds: params.officialSubmissionTherapistIds }
  )

  const responseRosterStatusRows = toMissingAvailabilityRows(
    params.therapists,
    params.entries,
    params.selectedCycleId,
    {
      officialSubmissionTherapistIds: params.officialSubmissionTherapistIds,
      countAnyOverrideAsSubmitted: true,
    }
  )

  return {
    officiallySubmittedRows: officialAvailabilityStatusRows.filter((row) => row.submitted),
    awaitingOfficialSubmissionRows: officialAvailabilityStatusRows.filter((row) => !row.submitted),
    responseRosterSubmittedRows: responseRosterStatusRows.filter((row) => row.submitted),
    responseRosterMissingRows: responseRosterStatusRows.filter((row) => !row.submitted),
  }
}

export function buildManagerAvailabilitySummaryChips(params: {
  awaitingOfficialSubmissionCount: number
  officiallySubmittedCount: number
  needOffRequests: number
  availableToWorkRequests: number
  initialRoster: string | undefined
  initialStatus: string | undefined
  buildHref: (updates: Record<string, string | undefined>, hash?: string) => string
}): AvailabilitySummaryChip[] {
  return [
    {
      label: 'Awaiting therapist submission',
      count: params.awaitingOfficialSubmissionCount,
      href: params.buildHref(
        { tab: 'planner', roster: 'missing' },
        '#availability-response-heading'
      ),
      tone: 'warning',
      active: params.initialRoster === 'missing',
    },
    {
      label: 'Officially submitted',
      count: params.officiallySubmittedCount,
      href: params.buildHref(
        { tab: 'planner', roster: 'submitted' },
        '#availability-response-heading'
      ),
      tone: 'success',
      active: params.initialRoster === 'submitted',
    },
    {
      label: 'Dates marked off',
      count: params.needOffRequests,
      href: params.buildHref(
        { tab: 'planner', status: 'force_off' },
        '#availability-request-inbox'
      ),
      tone: 'warning',
      active: params.initialStatus === 'force_off',
    },
    {
      label: 'Dates marked available',
      count: params.availableToWorkRequests,
      href: params.buildHref({ tab: 'planner', status: 'force_on' }, '#availability-request-inbox'),
      tone: 'info',
      active: params.initialStatus === 'force_on',
    },
  ]
}
