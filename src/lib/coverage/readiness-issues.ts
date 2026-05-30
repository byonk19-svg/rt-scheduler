import type { GenerateDraftResult } from '@/lib/coverage/generate-draft'

type ShiftType = 'day' | 'night'

export type ReadinessIssueSeverity = 'blocking' | 'warning' | 'info'

export type ReadinessIssueType =
  | 'unfilled_assignment'
  | 'missing_lead'
  | 'need_to_work_miss'
  | 'need_off_conflict'

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

function sortReadinessIssues(issues: ReadinessIssue[]): ReadinessIssue[] {
  return issues.sort((left, right) => {
    const leftDate = left.date ?? ''
    const rightDate = right.date ?? ''
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
  >
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
      severity: 'warning',
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

  return sortReadinessIssues(issues)
}
