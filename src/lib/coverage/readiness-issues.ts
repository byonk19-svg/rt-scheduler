import type { GenerateDraftResult } from '@/lib/coverage/generate-draft'

type ShiftType = 'day' | 'night'

export type ReadinessIssueSeverity = 'blocking' | 'warning' | 'info'

export type ReadinessIssueType =
  | 'unfilled_assignment'
  | 'missing_lead'
  | 'need_to_work_miss'
  | 'need_off_conflict'
  | 'ineligible_assignment'
  | 'open_shift_board_request'
  | 'missing_availability_submission'

export type ReadinessIssueTarget =
  | {
      kind: 'slot'
      date: string
      shiftType: ShiftType
      role?: 'lead' | 'staff'
    }
  | {
      kind: 'therapist_date'
      date: string
      shiftType: ShiftType | 'both'
      therapistId: string
    }
  | {
      kind: 'therapist'
      therapistId: string
    }
  | {
      kind: 'shift_board_request'
      requestId: string
      date?: string
      shiftType?: ShiftType
    }

export type ReadinessIssue = {
  id: string
  severity: ReadinessIssueSeverity
  type: ReadinessIssueType
  date?: string
  shiftType?: ShiftType | 'both'
  therapistId?: string
  therapistName?: string
  role?: 'lead' | 'staff'
  title: string
  detail: string
  recommendedAction?: string
  target?: ReadinessIssueTarget
}

const ISSUE_TYPE_ORDER: Record<ReadinessIssueType, number> = {
  unfilled_assignment: 0,
  missing_lead: 1,
  need_to_work_miss: 2,
  need_off_conflict: 3,
  ineligible_assignment: 4,
  open_shift_board_request: 5,
  missing_availability_submission: 6,
}

export type MissingAvailabilitySubmissionReadinessInput = {
  expectedTherapists: ReadonlyArray<{ id: string; fullName: string | null | undefined }>
  submittedTherapistIds?: Iterable<string>
  availabilityProvidedTherapistIds?: Iterable<string>
}

export type OpenShiftBoardRequestReadinessInput = {
  id: string
  requestType: 'coverage' | 'trade'
  date?: string | null
  shiftType?: ShiftType | null
}

export type IneligibleAssignmentReason = 'inactive' | 'archived' | 'fmla'

export type IneligibleAssignmentReadinessInput = {
  shiftId: string
  therapistId: string
  therapistName: string | null | undefined
  date: string
  shiftType: ShiftType
  reason: IneligibleAssignmentReason
}

function formatShiftType(shiftType: ShiftType | 'both'): string {
  if (shiftType === 'both') return 'Day or night shift'
  return `${shiftType[0].toUpperCase()}${shiftType.slice(1)} shift`
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

function therapistLabel(name: string | null | undefined): string {
  return name?.trim() || 'Unknown therapist'
}

function stableNameSegment(name: string | null | undefined): string {
  return name?.trim().toLowerCase().replace(/\s+/g, '-') || 'unknown'
}

function formatIneligibleAssignmentReason(reason: IneligibleAssignmentReason): string {
  if (reason === 'fmla') return 'on FMLA'
  if (reason === 'archived') return 'archived'
  return 'inactive'
}

function sortReadinessIssues(issues: ReadinessIssue[]): ReadinessIssue[] {
  return issues.sort((left, right) => {
    const leftDate = left.date ?? '9999-12-31'
    const rightDate = right.date ?? '9999-12-31'
    if (leftDate !== rightDate) return leftDate.localeCompare(rightDate)

    const leftShift = left.shiftType ?? ''
    const rightShift = right.shiftType ?? ''
    if (leftShift !== rightShift) return leftShift.localeCompare(rightShift)

    const typeOrder = ISSUE_TYPE_ORDER[left.type] - ISSUE_TYPE_ORDER[right.type]
    if (typeOrder !== 0) return typeOrder

    return left.id.localeCompare(right.id)
  })
}

export function buildReadinessIssues(
  result: Pick<
    GenerateDraftResult,
    | 'unfilledConstraintSlots'
    | 'missingLeadSlotDetails'
    | 'forcedMustWorkMissDetails'
    | 'needOffConflictDetails'
  >,
  options?: {
    missingAvailabilitySubmissions?: MissingAvailabilitySubmissionReadinessInput
    openShiftBoardRequests?: ReadonlyArray<OpenShiftBoardRequestReadinessInput>
    ineligibleAssignments?: ReadonlyArray<IneligibleAssignmentReadinessInput>
  }
): ReadinessIssue[] {
  const issues: ReadinessIssue[] = []

  for (const slot of result.unfilledConstraintSlots) {
    issues.push({
      id: `unfilled-assignment:${slot.date}:${slot.shiftType}`,
      severity: 'blocking',
      type: 'unfilled_assignment',
      date: slot.date,
      shiftType: slot.shiftType,
      role: 'staff',
      title: `${formatShiftType(slot.shiftType)} is short ${pluralize(slot.missingCount, 'assignment')}`,
      detail: `${formatShiftType(slot.shiftType)} on ${slot.date} is projected to miss minimum staffing by ${pluralize(slot.missingCount, 'assignment')}.`,
      recommendedAction: 'Assign eligible staff or adjust coverage targets before publishing.',
      target: {
        kind: 'slot',
        date: slot.date,
        shiftType: slot.shiftType,
        role: 'staff',
      },
    })
  }

  for (const slot of result.missingLeadSlotDetails) {
    issues.push({
      id: `missing-lead:${slot.date}:${slot.shiftType}`,
      severity: 'blocking',
      type: 'missing_lead',
      date: slot.date,
      shiftType: slot.shiftType,
      role: 'lead',
      title: `${formatShiftType(slot.shiftType)} needs a lead`,
      detail: `${formatShiftType(slot.shiftType)} on ${slot.date} has no lead assigned.`,
      recommendedAction: 'Designate an eligible lead for this shift.',
      target: {
        kind: 'slot',
        date: slot.date,
        shiftType: slot.shiftType,
        role: 'lead',
      },
    })
  }

  for (const miss of result.forcedMustWorkMissDetails) {
    const name = therapistLabel(miss.therapistName)
    issues.push({
      id: `need-to-work-miss:${miss.date}:${miss.shiftType}:${miss.therapistId || stableNameSegment(miss.therapistName)}`,
      severity: 'blocking',
      type: 'need_to_work_miss',
      date: miss.date,
      shiftType: miss.shiftType,
      therapistId: miss.therapistId,
      therapistName: name,
      title: `${name} is not scheduled on a Need to Work date`,
      detail: `${name} marked Need to Work for ${formatShiftType(miss.shiftType).toLowerCase()} on ${miss.date}, but no matching assignment is projected.`,
      recommendedAction: 'Schedule the therapist on that date or update the availability exception.',
      target: {
        kind: 'therapist_date',
        date: miss.date,
        shiftType: miss.shiftType,
        therapistId: miss.therapistId,
      },
    })
  }

  for (const conflict of result.needOffConflictDetails) {
    const name = therapistLabel(conflict.therapistName)
    issues.push({
      id: `need-off-conflict:${conflict.date}:${conflict.shiftType}:${conflict.therapistId || stableNameSegment(conflict.therapistName)}`,
      severity: 'blocking',
      type: 'need_off_conflict',
      date: conflict.date,
      shiftType: conflict.shiftType,
      therapistId: conflict.therapistId,
      therapistName: name,
      title: `${name} is scheduled on a Need Off date`,
      detail: `${name} marked Need Off for ${formatShiftType(conflict.shiftType).toLowerCase()} on ${conflict.date}, but a matching assignment is projected.`,
      recommendedAction: 'Move the assignment or record the required manager override before publishing.',
      target: {
        kind: 'therapist_date',
        date: conflict.date,
        shiftType: conflict.shiftType,
        therapistId: conflict.therapistId,
      },
    })
  }

  for (const assignment of options?.ineligibleAssignments ?? []) {
    const name = therapistLabel(assignment.therapistName)
    const reason = formatIneligibleAssignmentReason(assignment.reason)
    issues.push({
      id: `ineligible-assignment:${assignment.shiftId}`,
      severity: 'blocking',
      type: 'ineligible_assignment',
      date: assignment.date,
      shiftType: assignment.shiftType,
      therapistId: assignment.therapistId,
      therapistName: name,
      title: `${name} is assigned while ${reason}`,
      detail: `${name} is assigned to ${formatShiftType(assignment.shiftType).toLowerCase()} on ${assignment.date}, but this therapist is ${reason}.`,
      recommendedAction: 'Move the assignment to an eligible therapist before sending or publishing.',
      target: {
        kind: 'therapist_date',
        date: assignment.date,
        shiftType: assignment.shiftType,
        therapistId: assignment.therapistId,
      },
    })
  }

  for (const request of options?.openShiftBoardRequests ?? []) {
    const requestLabel = request.requestType === 'trade' ? 'Trade request' : 'Coverage request'
    const shiftLabel =
      request.date && request.shiftType
        ? `${formatShiftType(request.shiftType).toLowerCase()} on ${request.date}`
        : 'this Schedule Block'

    issues.push({
      id: `open-shift-board-request:${request.id}`,
      severity: 'warning',
      type: 'open_shift_board_request',
      date: request.date ?? undefined,
      shiftType: request.shiftType ?? undefined,
      title: `${requestLabel} is still open`,
      detail: `${requestLabel} touching ${shiftLabel} may change staffing after publish.`,
      recommendedAction:
        'Review the request on Shift Board before publishing, or continue knowing the schedule may change.',
      target: {
        kind: 'shift_board_request',
        requestId: request.id,
        date: request.date ?? undefined,
        shiftType: request.shiftType ?? undefined,
      },
    })
  }

  if (options?.missingAvailabilitySubmissions) {
    const submitted = new Set(options.missingAvailabilitySubmissions.submittedTherapistIds ?? [])
    const provided = new Set(
      options.missingAvailabilitySubmissions.availabilityProvidedTherapistIds ?? []
    )

    for (const therapist of options.missingAvailabilitySubmissions.expectedTherapists) {
      if (submitted.has(therapist.id) || provided.has(therapist.id)) continue

      const name = therapistLabel(therapist.fullName)
      issues.push({
        id: `missing-availability-submission:${therapist.id}`,
        severity: 'warning',
        type: 'missing_availability_submission',
        therapistId: therapist.id,
        therapistName: name,
        title: `${name} has not submitted availability`,
        detail: `${name} has no official availability submission or manager-entered availability for this Schedule Block.`,
        recommendedAction:
          'Send a reminder, enter manager-confirmed availability, or review the risk before publishing with missing availability.',
        target: {
          kind: 'therapist',
          therapistId: therapist.id,
        },
      })
    }
  }

  return sortReadinessIssues(issues)
}

export function getBlockingReadinessIssues(
  issues: readonly ReadinessIssue[]
): ReadinessIssue[] {
  return issues.filter((issue) => issue.severity === 'blocking')
}
