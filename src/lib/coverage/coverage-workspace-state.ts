import type { DayItem } from '@/lib/coverage/selectors'

type CoverageWorkspaceTone = 'neutral' | 'warning' | 'success'

type CoverageWorkspaceStatusArgs = {
  noCycleSelected: boolean
  activeCyclePublished: boolean
  showEmptyDraftState: boolean
}

type CoverageActionBarStatusHintArgs = {
  noCycleSelected: boolean
  selectedCycleHasShiftRows: boolean
  activeCyclePublished: boolean
  canSendPreliminary: boolean
  canPublishCycle: boolean
}

type CoverageNextActionLabelArgs = {
  noCycleSelected: boolean
  canManageCoverage: boolean
  showEmptyDraftState: boolean
  activeCyclePublished: boolean
}

type CoveragePlanningNoticesArgs = {
  successParam: string | null
  errorParam: string | null
  autoDraftFeedbackMessage: string | null
  publishErrorMessage: string | null
  error: string | null
}

type CoverageDescriptionArgs = {
  noCycleSelected: boolean
  canManageCoverage: boolean
  showEmptyDraftState: boolean
  canUpdateAssignmentStatus: boolean
}

export function getCoverageCycleRangeLabel(
  printCycle: { start_date: string; end_date: string } | null,
  formatCycleRange: (startDate: string, endDate: string) => string
): string {
  if (!printCycle) return 'No open 6-week block'
  return formatCycleRange(printCycle.start_date, printCycle.end_date)
}

export function getCoverageWorkspaceStatus({
  noCycleSelected,
  activeCyclePublished,
  showEmptyDraftState,
}: CoverageWorkspaceStatusArgs): {
  workspaceStatusTone: CoverageWorkspaceTone
  workspaceStatusLabel: string
} {
  if (noCycleSelected) {
    return {
      workspaceStatusTone: 'neutral',
      workspaceStatusLabel: 'No active cycle',
    }
  }

  if (activeCyclePublished) {
    return {
      workspaceStatusTone: 'success',
      workspaceStatusLabel: 'Published',
    }
  }

  if (showEmptyDraftState) {
    return {
      workspaceStatusTone: 'warning',
      workspaceStatusLabel: 'Setup required',
    }
  }

  return {
    workspaceStatusTone: 'neutral',
    workspaceStatusLabel: 'Draft',
  }
}

export function getCoverageSummary(days: DayItem[]): {
  missingLeadDays: number
  unassignedDays: number
  priorityGapDays: number
  staffedDays: number
} {
  const missingLeadDays = days.filter((day) => !day.leadShift).length
  const unassignedDays = days.filter((day) => !day.leadShift && day.staffShifts.length === 0).length
  const priorityGapDays = days.filter(
    (day) =>
      day.constraintBlocked ||
      !day.leadShift ||
      (day.leadShift ? 1 : 0) + day.staffShifts.filter((shift) => shift.status === 'active').length < 3
  ).length
  const staffedDays = days.filter(
    (day) =>
      Boolean(day.leadShift) &&
      ((day.leadShift ? 1 : 0) + day.staffShifts.filter((shift) => shift.status === 'active').length >= 4)
  ).length

  return {
    missingLeadDays,
    unassignedDays,
    priorityGapDays,
    staffedDays,
  }
}

export function getCoverageActionBarStatusHint({
  noCycleSelected,
  selectedCycleHasShiftRows,
  activeCyclePublished,
  canSendPreliminary,
  canPublishCycle,
}: CoverageActionBarStatusHintArgs): string {
  if (noCycleSelected) {
    return 'Create a 6-week block to start the scheduling workflow.'
  }

  if (!selectedCycleHasShiftRows) {
    return 'Draft first. Run Auto-draft or open a day to add the first assignments.'
  }

  if (activeCyclePublished) {
    return 'This block is live. Use Cycle tools for restart, delivery history, and print tasks.'
  }

  if (!canSendPreliminary) {
    return 'Draft enough staffing to send a preliminary schedule.'
  }

  if (!canPublishCycle) {
    return 'Complete the draft before publishing.'
  }

  return 'Review the draft, send preliminary if needed, then publish.'
}

export function getCoverageNextActionLabel({
  noCycleSelected,
  canManageCoverage,
  showEmptyDraftState,
  activeCyclePublished,
}: CoverageNextActionLabelArgs): string {
  if (noCycleSelected) {
    return canManageCoverage
      ? 'Create a 6-week block to start planning.'
      : 'Wait for a manager to open the next cycle.'
  }

  if (showEmptyDraftState) {
    return canManageCoverage
      ? 'Run Auto-draft or open a day to add the first assignments.'
      : 'Staffing is being prepared for this cycle.'
  }

  if (activeCyclePublished) {
    return canManageCoverage
      ? 'Review live staffing and handle exceptions.'
      : 'View live staffing and operational status.'
  }

  return canManageCoverage
    ? 'Finish draft checks, send preliminary if needed, then publish.'
    : 'Draft staffing is in progress.'
}

export function getCoveragePlanningNotices({
  successParam,
  errorParam,
  autoDraftFeedbackMessage,
  publishErrorMessage,
  error,
}: CoveragePlanningNoticesArgs): string[] {
  return [
    successParam === 'cycle_published' ? 'Published - visible to employees.' : null,
    successParam === 'preliminary_sent'
      ? 'Preliminary schedule sent. Therapists can now review it in the app.'
      : null,
    successParam === 'preliminary_refreshed'
      ? 'Preliminary schedule refreshed with the latest staffing draft.'
      : null,
    successParam === 'cycle_unpublished' ? 'Cycle unpublished.' : null,
    successParam === 'cycle_deleted' ? 'Cycle deleted.' : null,
    errorParam === 'delete_cycle_published' ? 'Cannot delete a live cycle. Unpublish it first.' : null,
    successParam === 'shift_added' ? 'Shift assigned.' : null,
    autoDraftFeedbackMessage,
    publishErrorMessage,
    errorParam === 'preliminary_cycle_published'
      ? 'Preliminary schedules can only be sent while the cycle is still a draft.'
      : null,
    errorParam === 'preliminary_send_failed'
      ? 'Could not send the preliminary schedule. Please try again.'
      : null,
    error,
  ].filter((notice): notice is string => Boolean(notice))
}

export function getCoverageWorkspaceDescription({
  noCycleSelected,
  canManageCoverage,
  showEmptyDraftState,
  canUpdateAssignmentStatus,
}: CoverageDescriptionArgs): string {
  if (noCycleSelected) {
    return canManageCoverage
      ? 'No open 6-week block — create a new draft block to start staffing.'
      : 'No published schedule is available right now.'
  }

  if (showEmptyDraftState) {
    return canManageCoverage
      ? 'No staffing drafted yet. Auto-draft or open a day to assign the first shifts.'
      : 'No staffing published yet.'
  }

  if (canManageCoverage) {
    return 'Execution workspace for staffing, lead coverage, and publish readiness.'
  }

  return canUpdateAssignmentStatus
    ? 'View staffing and assignment status — click a therapist token to update status.'
    : 'View staffing and assignment status.'
}
