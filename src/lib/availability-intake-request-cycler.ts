import {
  sanitizeParsedRequests,
  type ParsedAvailabilityRequest,
} from '@/lib/availability-email-intake'

const DEFAULT_SOURCE_LINE = 'Imported email'

type IntakeRequestChipTarget = Pick<
  ParsedAvailabilityRequest,
  'date' | 'override_type' | 'shift_type'
>

function sortParsedRequests(requests: ParsedAvailabilityRequest[]): ParsedAvailabilityRequest[] {
  return [...requests].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.override_type.localeCompare(b.override_type) ||
      a.shift_type.localeCompare(b.shift_type) ||
      (a.note ?? '').localeCompare(b.note ?? '') ||
      a.source_line.localeCompare(b.source_line)
  )
}

function matchesChipTarget(
  request: ParsedAvailabilityRequest,
  target: IntakeRequestChipTarget
): boolean {
  return (
    request.date === target.date &&
    request.override_type === target.override_type &&
    request.shift_type === target.shift_type
  )
}

function buildDefaultParsedRequest(
  target: IntakeRequestChipTarget
): ParsedAvailabilityRequest | null {
  return (
    sanitizeParsedRequests([
      {
        date: target.date,
        override_type: 'force_off',
        shift_type: target.shift_type,
        note: null,
        source_line: DEFAULT_SOURCE_LINE,
      },
    ])[0] ?? null
  )
}

export function cycleIntakeRequest(params: {
  requests: unknown
  target: IntakeRequestChipTarget
}): ParsedAvailabilityRequest[] {
  const requests = sanitizeParsedRequests(params.requests)
  const existingRequest = requests.find((request) => matchesChipTarget(request, params.target))
  const nextRequests = requests.filter((request) => !matchesChipTarget(request, params.target))

  if (!existingRequest) {
    const createdRequest = buildDefaultParsedRequest(params.target)
    if (createdRequest) {
      nextRequests.push(createdRequest)
    }
    return sortParsedRequests(nextRequests)
  }

  if (existingRequest.override_type === 'force_off') {
    nextRequests.push({
      ...existingRequest,
      override_type: 'force_on',
    })
    return sortParsedRequests(nextRequests)
  }

  if (existingRequest.override_type === 'force_on') {
    nextRequests.push({
      ...existingRequest,
      override_type: 'force_off',
    })
  }

  return sortParsedRequests(nextRequests)
}

/** Drops the request that matches the chip target (used only after explicit manager confirm). */
export function removeIntakeRequest(params: {
  requests: unknown
  target: IntakeRequestChipTarget
}): ParsedAvailabilityRequest[] {
  const requests = sanitizeParsedRequests(params.requests)
  return sortParsedRequests(
    requests.filter((request) => !matchesChipTarget(request, params.target))
  )
}

function serializeParsedRequests(requests: unknown): string {
  return JSON.stringify(sortParsedRequests(sanitizeParsedRequests(requests)))
}

export function markRequestsEdited(params: {
  originalRequests: unknown
  currentRequests: unknown
}): boolean {
  return (
    serializeParsedRequests(params.originalRequests) !==
    serializeParsedRequests(params.currentRequests)
  )
}
