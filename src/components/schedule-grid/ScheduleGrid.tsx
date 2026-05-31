'use client'

import { useCallback, useMemo, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { FeedbackToast } from '@/components/feedback-toast'
import { createCoverageShiftMutator, type CoverageMutationError } from '@/lib/coverage/mutations'
import { shiftTabToQueryValue } from '@/lib/coverage/coverage-shift-tab'
import {
  toScheduleGridMutationPayload,
  type ScheduleGridAssignmentStatus,
} from '@/lib/schedule/schedule-status-model'
import { cn } from '@/lib/utils'

import { AssignCellPopover } from './AssignCellPopover'
import { ScheduleGridTable } from './ScheduleGridTable'
import { ScheduleGridToolbar } from './ScheduleGridToolbar'
import { StatusCellPopover } from './StatusCellPopover'
import type {
  GridCell,
  GridDataset,
  ScheduleGridPreFlightSummary,
  ScheduleInteractionMode,
} from './schedule-grid-types'

type CellTarget = {
  userId: string
  date: string
  cell: GridCell
  therapistName: string
  isLeadEligible?: boolean
  anchorEl: HTMLElement
}

type ScheduleGridProps = {
  initialDataset: GridDataset
  initialShiftTab: 'Day' | 'Night'
  autoDraftAction?: (formData: FormData) => void | Promise<void>
  preliminaryAction?: (formData: FormData) => void | Promise<void>
  publishAction?: (formData: FormData) => void | Promise<void>
  preFlightSummary?: ScheduleGridPreFlightSummary | null
}

type ScheduleGridFeedback = {
  id: number
  message: string
  variant: 'error'
}

const SCHEDULE_GRID_MUTATION_ERROR_MESSAGES = {
  assign: 'Could not assign this shift. Refresh Schedule and try again.',
  unassign: 'Could not remove this assignment. Refresh Schedule and try again.',
  status: 'Could not update this shift status. Refresh Schedule and try again.',
  designateLead: 'Could not set the lead for this shift. Refresh Schedule and try again.',
} as const

type ScheduleGridMutationAction = keyof typeof SCHEDULE_GRID_MUTATION_ERROR_MESSAGES

const SAFE_MUTATION_ERROR_MESSAGES = [
  'A designated lead already exists for that shift.',
  'Date is outside this Schedule Block',
  'Operational statuses can only be applied after the Schedule Block is published.',
  'Operational statuses require an assigned therapist.',
  'Left early status requires the time the shift ended.',
  'Left early time can only be set with left early status.',
  'Left early time must be HH:MM or HH:MM:SS.',
  'Only lead-eligible therapists can be designated as lead.',
  'That therapist already has a shift on this date.',
  'Therapist shift type does not match the selected schedule shift.',
] as const

function resolveScheduleGridMutationErrorMessage(
  action: ScheduleGridMutationAction,
  error: CoverageMutationError
) {
  const fallback = SCHEDULE_GRID_MUTATION_ERROR_MESSAGES[action]
  const message = error?.message?.trim()
  if (!message) return fallback

  const normalized = message.toLowerCase()

  if (error?.code === 'availability_conflict') {
    return 'This therapist has a scheduling conflict. Review their availability before assigning.'
  }
  if (normalized === 'unauthorized') {
    return 'Your session expired. Sign in again, then retry this schedule change.'
  }
  if (
    normalized.includes('not authorized') ||
    normalized.includes('manager access required') ||
    normalized.includes('site scope') ||
    normalized.includes('only leads or managers') ||
    normalized.includes('forbidden') ||
    normalized.includes('actor site is missing') ||
    normalized.includes('manager site scope required')
  ) {
    return 'You do not have permission to make this schedule change.'
  }
  if (normalized.includes('read-only')) {
    return 'This Schedule Block is read-only until it is republished.'
  }
  if (normalized.includes('not found')) {
    return 'This schedule changed since you opened it. Refresh Schedule and try again.'
  }
  if (
    SAFE_MUTATION_ERROR_MESSAGES.some((safeMessage) =>
      normalized.includes(safeMessage.toLowerCase())
    )
  ) {
    return message
  }
  if (
    normalized.includes('at most') ||
    normalized.includes('limited to') ||
    normalized.includes('cannot be assigned')
  ) {
    return message
  }

  return fallback
}

const SCHEDULE_LEGEND_ITEMS = [
  {
    label: 'Staff',
    code: '1',
    className: 'text-[var(--print-ink)]',
  },
  { label: 'Lead', code: 'L', className: 'border border-yellow-300 bg-yellow-200 text-yellow-900' },
  {
    label: 'On call',
    code: 'OC',
    className:
      'border border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]',
  },
  {
    label: 'Cancelled',
    code: 'CX',
    className:
      'border border-[var(--error-border)] bg-[var(--error-subtle)] text-[var(--error-text)]',
  },
  {
    label: 'Call in',
    code: 'CI',
    className:
      'border border-[var(--success-border)] bg-[var(--success-subtle)] text-[var(--success-text)]',
  },
  {
    label: 'Left early',
    code: 'LE',
    className: 'border border-orange-200 bg-orange-100 text-orange-800',
  },
  { label: 'Need Off', code: '*', className: 'text-foreground' },
] as const

const MAX_VISIBLE_PREFLIGHT_ISSUES = 6

function getScheduleInteractionHint(interactionMode: ScheduleInteractionMode): string {
  switch (interactionMode.kind) {
    case 'manager_edit':
      return 'Select actionable cells to edit coverage or update shift status.'
    case 'lead_status':
      return 'Select assigned published shifts to update live status. Off cells are read-only.'
    case 'combined_readonly':
      return 'Read-only combined schedule view.'
    case 'staff_view':
      return 'Read-only team schedule. Your row is highlighted for quick reference.'
  }
}

function getReadinessSeverityClass(
  severity: ScheduleGridPreFlightSummary['readinessIssues'][number]['severity']
) {
  switch (severity) {
    case 'blocking':
      return 'border-[var(--error-border)] bg-[var(--error-subtle)] text-[var(--error-text)]'
    case 'warning':
      return 'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
    case 'info':
      return 'border-border bg-muted text-muted-foreground'
  }
}

function getReadinessTargetLabel(
  issue: ScheduleGridPreFlightSummary['readinessIssues'][number]
): string | null {
  if (!issue.target) return null
  if (issue.target.kind === 'slot') {
    return `${issue.target.date} ${issue.target.shiftType} shift`
  }
  if (issue.target.kind === 'therapist') {
    return issue.therapistName ?? 'Therapist'
  }
  if (issue.target.kind === 'shift_board_request') {
    if (issue.target.date && issue.target.shiftType) {
      return `${issue.target.date} ${issue.target.shiftType} shift`
    }
    return 'Shift Board'
  }
  return `${issue.target.date} ${issue.target.shiftType} shift · ${issue.therapistName ?? 'Therapist'}`
}

export function ScheduleGrid({
  initialDataset,
  initialShiftTab,
  autoDraftAction,
  preliminaryAction,
  publishAction,
  preFlightSummary,
}: ScheduleGridProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const loadedShiftTab = initialDataset.shiftType === 'night' ? 'Night' : 'Day'
  const [shiftTab, setShiftTab] = useState<'Day' | 'Night'>(initialShiftTab)
  const [activeCellTarget, setActiveCellTarget] = useState<CellTarget | null>(null)
  const [showPreFlight, setShowPreFlight] = useState(false)
  const [feedback, setFeedback] = useState<ScheduleGridFeedback | null>(null)
  const autoDraftFormRef = useRef<HTMLFormElement | null>(null)
  const preliminaryFormRef = useRef<HTMLFormElement | null>(null)
  const publishFormRef = useRef<HTMLFormElement | null>(null)
  const mutator = useMemo(() => createCoverageShiftMutator(), [])
  const latestQueryRef = useRef(searchParams.toString())
  const interactionMode = initialDataset.interactionMode
  const cellsLocked = isPending
  const acknowledgeMissingAvailability =
    searchParams.get('error') === 'publish_missing_availability_warning' ||
    searchParams.get('acknowledge_missing_availability') === 'true'
  const preserveWeeklyOverride = searchParams.get('override_weekly_rules') === 'true'
  const preserveShiftOverride = searchParams.get('override_shift_rules') === 'true'
  const publishLabel = acknowledgeMissingAvailability
    ? 'Publish with missing availability'
    : 'Publish'

  const replaceScheduleQuery = useCallback(
    (params: URLSearchParams) => {
      const query = params.toString()
      latestQueryRef.current = query
      startTransition(() => {
        router.replace(`${pathname}?${query}`, { scroll: false })
      })
    },
    [pathname, router, startTransition]
  )

  const getCurrentScheduleParams = useCallback(() => {
    const currentSearch =
      typeof window === 'undefined' ? latestQueryRef.current : window.location.search
    return new URLSearchParams(currentSearch)
  }, [])

  const handleShiftTabChange = useCallback(
    (tab: 'Day' | 'Night') => {
      const params = getCurrentScheduleParams()
      const nextShift = shiftTabToQueryValue(tab)
      if (tab === shiftTab && params.get('shift') === nextShift) {
        return
      }
      setShiftTab(tab)
      setActiveCellTarget(null)
      params.set('shift', nextShift)
      replaceScheduleQuery(params)
    },
    [getCurrentScheduleParams, replaceScheduleQuery, shiftTab]
  )

  const handleCycleChange = useCallback(
    (cycleId: string) => {
      const params = getCurrentScheduleParams()
      params.set('cycle', cycleId)
      setActiveCellTarget(null)
      replaceScheduleQuery(params)
    },
    [getCurrentScheduleParams, replaceScheduleQuery]
  )

  const handleCellClick = useCallback(
    (userId: string, date: string, cell: GridCell, anchorEl: HTMLElement) => {
      if (cellsLocked) return
      const row = initialDataset.therapistRows.find((candidate) => candidate.userId === userId)
      if (!row) return
      if (cell.status === 'off' && !interactionMode.canAssignShifts) {
        return
      }
      if (
        cell.status !== 'off' &&
        !interactionMode.canUnassignShifts &&
        !interactionMode.canDesignateLead &&
        !interactionMode.canUpdateAssignmentStatus
      ) {
        return
      }
      setActiveCellTarget({
        userId,
        date,
        cell,
        therapistName: row.name,
        isLeadEligible: row.isLeadEligible,
        anchorEl,
      })
    },
    [cellsLocked, initialDataset, interactionMode]
  )

  const refreshAfterMutation = useCallback(() => {
    setFeedback(null)
    setActiveCellTarget(null)
    startTransition(() => router.refresh())
  }, [router])

  const showMutationError = useCallback(
    (action: ScheduleGridMutationAction, error: CoverageMutationError) => {
      const message = resolveScheduleGridMutationErrorMessage(action, error)

      setFeedback((current) => ({
        id: (current?.id ?? 0) + 1,
        message,
        variant: 'error',
      }))
    },
    []
  )

  const handleAssign = useCallback(async () => {
    if (!activeCellTarget || !interactionMode.canAssignShifts || cellsLocked) return
    setFeedback(null)
    const { error } = await mutator.assign({
      cycleId: initialDataset.cycleId,
      userId: activeCellTarget.userId,
      isoDate: activeCellTarget.date,
      shiftType: initialDataset.shiftType,
      role: 'staff',
      availabilityOverride: activeCellTarget.cell.hasNeedsOff,
      availabilityOverrideReason: activeCellTarget.cell.hasNeedsOff
        ? 'Manager assigned from schedule grid despite requested day off.'
        : undefined,
    })
    if (error) {
      showMutationError('assign', error)
      return
    }
    refreshAfterMutation()
  }, [
    activeCellTarget,
    cellsLocked,
    initialDataset,
    interactionMode,
    mutator,
    refreshAfterMutation,
    showMutationError,
  ])

  const handleUnassign = useCallback(async () => {
    if (!activeCellTarget?.cell.shiftId || !interactionMode.canUnassignShifts || cellsLocked) {
      return
    }
    setFeedback(null)
    const { error } = await mutator.unassign({
      cycleId: initialDataset.cycleId,
      shiftId: activeCellTarget.cell.shiftId,
    })
    if (error) {
      showMutationError('unassign', error)
      return
    }
    refreshAfterMutation()
  }, [
    activeCellTarget,
    cellsLocked,
    initialDataset,
    interactionMode,
    mutator,
    refreshAfterMutation,
    showMutationError,
  ])

  const handleStatusChange = useCallback(
    async (
      status: ScheduleGridAssignmentStatus,
      change?: { note?: string | null; leftEarlyTime?: string | null }
    ) => {
      if (!activeCellTarget?.cell.shiftId) return
      if (cellsLocked) return
      if (!interactionMode.canUpdateAssignmentStatus) return
      setFeedback(null)
      const { error } = await mutator.updateStatus(activeCellTarget.cell.shiftId, {
        ...toScheduleGridMutationPayload(status),
        note: change?.note ?? null,
        leftEarlyTime: status === 'left_early' ? (change?.leftEarlyTime ?? null) : null,
      })
      if (error) {
        showMutationError('status', error)
        return
      }
      refreshAfterMutation()
    },
    [
      activeCellTarget,
      cellsLocked,
      interactionMode,
      mutator,
      refreshAfterMutation,
      showMutationError,
    ]
  )

  const handleDesignateLead = useCallback(async () => {
    if (!activeCellTarget?.cell.shiftId || !interactionMode.canDesignateLead || cellsLocked) {
      return
    }
    setFeedback(null)
    const { error } = await mutator.setDesignatedLead({
      cycleId: initialDataset.cycleId,
      therapistId: activeCellTarget.userId,
      isoDate: activeCellTarget.date,
      shiftType: initialDataset.shiftType,
    })
    if (error) {
      showMutationError('designateLead', error)
      return
    }
    refreshAfterMutation()
  }, [
    activeCellTarget,
    cellsLocked,
    initialDataset,
    interactionMode,
    mutator,
    refreshAfterMutation,
    showMutationError,
  ])

  const isAssignTarget = activeCellTarget?.cell.status === 'off'
  const isStatusTarget = Boolean(activeCellTarget && activeCellTarget.cell.status !== 'off')
  const sheetTitle =
    loadedShiftTab === 'Night' ? 'Respiratory Therapy Night Shift' : 'Respiratory Therapy Day Shift'
  const sheetDayCount = `${initialDataset.cycleDates.length} days`
  const interactionHint = getScheduleInteractionHint(interactionMode)
  const visiblePreFlightIssues =
    preFlightSummary?.readinessIssues.slice(0, MAX_VISIBLE_PREFLIGHT_ISSUES) ?? []
  const hiddenPreFlightIssueCount =
    (preFlightSummary?.readinessIssues.length ?? 0) - visiblePreFlightIssues.length
  const missingAvailabilityIssueCount =
    preFlightSummary?.readinessIssues.filter(
      (issue) => issue.type === 'missing_availability_submission'
    ).length ?? 0
  const missingAvailabilityIssueLabel = `${missingAvailabilityIssueCount} missing availability ${
    missingAvailabilityIssueCount === 1 ? 'submission' : 'submissions'
  }`
  const openShiftBoardIssueCount =
    preFlightSummary?.readinessIssues.filter((issue) => issue.type === 'open_shift_board_request')
      .length ?? 0
  const openShiftBoardIssueLabel = `${openShiftBoardIssueCount} open Shift Board ${
    openShiftBoardIssueCount === 1 ? 'request' : 'requests'
  }`

  return (
    <div className="rounded-xl border border-border/60 bg-[color-mix(in_srgb,var(--muted)_68%,var(--background))] p-3 shadow-inner sm:p-4 lg:p-5">
      {autoDraftAction ? (
        <form ref={autoDraftFormRef} action={autoDraftAction} className="hidden">
          <input type="hidden" name="cycle_id" value={initialDataset.cycleId} />
          <input type="hidden" name="return_to" value="schedule" />
          <input type="hidden" name="view" value="grid" />
        </form>
      ) : null}
      {publishAction ? (
        <form ref={publishFormRef} action={publishAction} className="hidden">
          <input type="hidden" name="cycle_id" value={initialDataset.cycleId} />
          <input
            type="hidden"
            name="currently_published"
            value={String(initialDataset.isPublished)}
          />
          <input
            type="hidden"
            name="acknowledge_missing_availability"
            value={String(acknowledgeMissingAvailability)}
          />
          <input
            type="hidden"
            name="override_weekly_rules"
            value={String(preserveWeeklyOverride)}
          />
          <input type="hidden" name="override_shift_rules" value={String(preserveShiftOverride)} />
          <input type="hidden" name="return_to" value="schedule" />
          <input type="hidden" name="view" value="grid" />
        </form>
      ) : null}
      {preliminaryAction ? (
        <form ref={preliminaryFormRef} action={preliminaryAction} className="hidden">
          <input type="hidden" name="cycle_id" value={initialDataset.cycleId} />
          <input type="hidden" name="return_to" value="schedule" />
          <input type="hidden" name="view" value="grid" />
        </form>
      ) : null}
      <div className="space-y-3">
        <ScheduleGridToolbar
          cycleId={initialDataset.cycleId}
          cycleDateRangeLabel={initialDataset.cycleDateRangeLabel}
          availableCycles={initialDataset.availableCycles}
          isPublished={initialDataset.isPublished}
          cycleStatus={initialDataset.cycleStatus}
          shiftTab={shiftTab}
          isPending={isPending}
          interactionMode={interactionMode}
          onCycleChange={handleCycleChange}
          onShiftTabChange={handleShiftTabChange}
          onAutoDraft={
            autoDraftAction ? () => autoDraftFormRef.current?.requestSubmit() : undefined
          }
          onPreFlight={preFlightSummary ? () => setShowPreFlight((value) => !value) : undefined}
          onSendPreliminary={
            preliminaryAction ? () => preliminaryFormRef.current?.requestSubmit() : undefined
          }
          onPrint={() => window.print()}
          onPublish={publishAction ? () => publishFormRef.current?.requestSubmit() : undefined}
          publishLabel={publishLabel}
        />
        {showPreFlight && preFlightSummary ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-tw-2xs">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">Pre-flight summary</p>
                <p className="mt-1">
                  {preFlightSummary.unfilledSlots} unfilled assignments,{' '}
                  {preFlightSummary.missingLeadSlots} missing lead slots,{' '}
                  {preFlightSummary.forcedMustWorkMisses} need-to-work misses,{' '}
                  {missingAvailabilityIssueLabel}, {openShiftBoardIssueLabel}.
                </p>
              </div>
              {preFlightSummary.readinessIssues.length > 0 ? (
                <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-950">
                  {preFlightSummary.readinessIssues.length} readiness issues
                </span>
              ) : (
                <span className="rounded-full border border-[var(--success-border)] bg-[var(--success-subtle)] px-2 py-0.5 text-xs font-bold text-[var(--success-text)]">
                  No readiness issues
                </span>
              )}
            </div>
            {visiblePreFlightIssues.length > 0 ? (
              <div
                className="mt-3 divide-y divide-amber-200 overflow-hidden rounded-md border border-amber-200 bg-background/80"
                aria-label="Pre-flight readiness issues"
              >
                {visiblePreFlightIssues.map((issue) => {
                  const targetLabel = getReadinessTargetLabel(issue)
                  return (
                    <div
                      key={issue.id}
                      className="grid gap-2 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto]"
                      data-readiness-issue-id={issue.id}
                      data-readiness-issue-type={issue.type}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              'inline-flex rounded-full border px-2 py-0.5 text-[11px] font-black uppercase',
                              getReadinessSeverityClass(issue.severity)
                            )}
                          >
                            {issue.severity}
                          </span>
                          <p className="font-semibold text-foreground">{issue.title}</p>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {issue.detail}
                        </p>
                        {issue.recommendedAction ? (
                          <p className="mt-1 text-xs font-medium text-foreground">
                            {issue.recommendedAction}
                          </p>
                        ) : null}
                      </div>
                      {targetLabel ? (
                        <span className="self-start rounded border border-border bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                          {targetLabel}
                        </span>
                      ) : null}
                    </div>
                  )
                })}
                {hiddenPreFlightIssueCount > 0 ? (
                  <p className="px-3 py-2 text-xs font-medium text-muted-foreground">
                    {hiddenPreFlightIssueCount} more readiness issues not shown.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        <article className="mx-auto max-w-[96rem] overflow-hidden rounded-[6px] border border-border/80 bg-[var(--print-paper)] text-[var(--print-ink)] shadow-[0_22px_54px_-38px_rgba(15,23,42,0.58)]">
          <div className="border-b border-border/60 bg-[var(--print-paper)] px-5 py-4">
            <div>
              <p className="text-[13px] font-black uppercase tracking-[0.12em] text-[var(--print-ink)]">
                {sheetTitle}
              </p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.04em] text-[var(--print-ink-muted)]">
                {initialDataset.cycleDateRangeLabel} | {sheetDayCount}
              </p>
            </div>
          </div>
          <div
            aria-label="Schedule legend"
            className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/55 bg-[color-mix(in_srgb,var(--print-paper)_94%,var(--muted))] px-5 py-1.5 text-[9px] text-[var(--print-ink-muted)]"
          >
            <span className="font-black uppercase tracking-[0.1em]">Legend</span>
            {SCHEDULE_LEGEND_ITEMS.map((item) => (
              <span key={item.label} className="inline-flex items-center gap-1.5">
                <span
                  className={cn(
                    'inline-flex min-h-3.5 min-w-3.5 items-center justify-center rounded-[2px] px-0.5 text-[8px] font-black leading-none',
                    item.className
                  )}
                >
                  {item.code}
                </span>
                <span>{item.label}</span>
              </span>
            ))}
            <span className="ml-auto border-l border-border/60 pl-3 font-medium text-[var(--print-ink-muted)]">
              {interactionHint}
            </span>
          </div>
          <ScheduleGridTable
            dataset={initialDataset}
            interactionMode={interactionMode}
            onCellClick={handleCellClick}
            interactionsDisabled={cellsLocked}
          />
        </article>
      </div>
      {isAssignTarget && activeCellTarget ? (
        <AssignCellPopover
          open
          onOpenChange={(open) => {
            if (!open) setActiveCellTarget(null)
          }}
          anchorEl={activeCellTarget.anchorEl}
          therapistName={activeCellTarget.therapistName}
          date={activeCellTarget.date}
          cell={activeCellTarget.cell}
          onAssign={handleAssign}
          isPending={isPending}
        />
      ) : null}
      {isStatusTarget && activeCellTarget ? (
        <StatusCellPopover
          key={`${activeCellTarget.userId}:${activeCellTarget.date}:${activeCellTarget.cell.shiftId ?? 'unassigned'}`}
          open
          onOpenChange={(open) => {
            if (!open) setActiveCellTarget(null)
          }}
          anchorEl={activeCellTarget.anchorEl}
          therapistName={activeCellTarget.therapistName}
          date={activeCellTarget.date}
          cell={activeCellTarget.cell}
          allowStatusChange={interactionMode.canUpdateAssignmentStatus}
          canUnassign={interactionMode.canUnassignShifts}
          canDesignateLead={interactionMode.canDesignateLead}
          isCurrentlyLead={activeCellTarget.cell.status === 'lead'}
          isLeadEligible={activeCellTarget.isLeadEligible}
          onStatusChange={handleStatusChange}
          onUnassign={handleUnassign}
          onDesignateLead={handleDesignateLead}
          isPending={isPending}
        />
      ) : null}
      {feedback ? (
        <FeedbackToast key={feedback.id} message={feedback.message} variant={feedback.variant} />
      ) : null}
    </div>
  )
}
