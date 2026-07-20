import type {
  AvailabilityRosterFilter,
  AvailabilityStatusSummaryRow,
} from '@/components/availability/AvailabilityStatusSummary'

const VALID_ROSTER_FILTERS = new Set<AvailabilityRosterFilter>([
  'all',
  'missing',
  'submitted_with_exceptions',
  'submitted_no_exceptions',
  'submitted',
  'has_requests',
])

function parseAvailabilityRosterFilter(
  value: string | null | undefined
): AvailabilityRosterFilter | null {
  return VALID_ROSTER_FILTERS.has(value as AvailabilityRosterFilter)
    ? (value as AvailabilityRosterFilter)
    : null
}

function requestCount(row: AvailabilityStatusSummaryRow) {
  return row.overridesCount + (row.managerEnteredCount ?? 0)
}

export function resolveAvailabilityRosterFilter(params: {
  requestedFilter?: string | null
  selectedTherapistId?: string | null
  submittedRows: AvailabilityStatusSummaryRow[]
  missingRows: AvailabilityStatusSummaryRow[]
}): AvailabilityRosterFilter {
  const requestedFilter = parseAvailabilityRosterFilter(params.requestedFilter)
  if (requestedFilter) return requestedFilter

  const selectedTherapistId = params.selectedTherapistId
  if (!selectedTherapistId) return 'missing'

  const submittedRow = params.submittedRows.find((row) => row.therapistId === selectedTherapistId)
  if (submittedRow) {
    return requestCount(submittedRow) > 0 ? 'submitted_with_exceptions' : 'submitted_no_exceptions'
  }

  const missingRow = params.missingRows.find((row) => row.therapistId === selectedTherapistId)
  if (missingRow) return 'missing'

  return 'missing'
}
