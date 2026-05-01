'use client'

import { useMemo } from 'react'
import { AlertCircle, AlertTriangle, Check, Clock, MinusCircle } from 'lucide-react'

import {
  AssignmentStatusPopover,
  StatusPill,
} from '@/components/coverage/AssignmentStatusPopover'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { ActiveOperationalDetail } from '@/lib/operational-codes'
import { countActive, type DayItem, type ShiftItem, type ShiftTab, type UiStatus } from '@/lib/coverage/selectors'
import { getCoverageStatusLabel } from '@/lib/coverage/status-ui'
import {
  getDefaultWeeklyLimitForEmploymentType,
  sanitizeWeeklyLimit,
} from '@/lib/scheduling-constants'
import { cn } from '@/lib/utils'

type TherapistOption = {
  id: string
  full_name: string
  shift_type: 'day' | 'night'
  isLeadEligible: boolean
  employment_type: string | null
  max_work_days_per_week: number | null
}

type SelectedDay = DayItem & { shiftType: ShiftTab }

type ShiftEditorDialogProps = {
  open: boolean
  selectedDay: SelectedDay | null
  therapists: TherapistOption[]
  canEdit: boolean
  canUpdateAssignmentStatus: boolean
  coverageCycleId: string | null
  isPastDate: boolean
  hasOperationalEntries: boolean
  activeOperationalDetails: Map<string, ActiveOperationalDetail>
  selectedDayNotes: string[]
  assigning: boolean
  unassigningShiftId: string | null
  weeklyTherapistCounts: Map<string, number>
  assignError: string
  onOpenChange: (open: boolean) => void
  onAssignTherapist: (userId: string, role: 'lead' | 'staff') => Promise<void> | void
  onChangeStatus: (dayId: string, shiftId: string, isLead: boolean, nextStatus: UiStatus) => Promise<void> | void
  onUnassign: (dayId: string, shiftId: string, isLead: boolean) => Promise<void> | void
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function formatDrawerDate(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return isoDate
  return parsed.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatLeftEarlyTime(value: string | null): string | null {
  if (!value) return null
  const parsed = new Date(`1970-01-01T${value}`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function coverageState(selectedDay: SelectedDay | null, activeCount: number): {
  label: string
  tone: 'success' | 'warning' | 'critical'
} {
  if (!selectedDay) return { label: 'Not available', tone: 'warning' }
  if (selectedDay.constraintBlocked) return { label: 'No eligible therapists', tone: 'critical' }
  if (!selectedDay.leadShift && activeCount === 0) return { label: 'Unassigned', tone: 'critical' }
  if (!selectedDay.leadShift) return { label: 'Missing lead', tone: 'critical' }

  const gapCount = Math.max(4 - activeCount, 0)
  if (gapCount > 0) {
    return {
      label: `${gapCount} ${gapCount === 1 ? 'gap' : 'gaps'}`,
      tone: 'warning',
    }
  }

  return { label: 'Fully staffed', tone: 'success' }
}

function InlineStatusChip({ status }: { status: UiStatus }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center rounded-full border border-border/70 bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        Active
      </span>
    )
  }

  return <StatusPill status={status} />
}

type CandidatePriorityInput = {
  role: 'lead' | 'staff'
  therapist: TherapistOption
  assignment: { shiftId: string; isLead: boolean } | undefined
  weeklyTherapistCounts: Map<string, number>
  hasLead: boolean
}

export function getCandidatePriority({
  role,
  therapist,
  assignment,
  weeklyTherapistCounts,
  hasLead,
}: CandidatePriorityInput) {
  const assignedInRole = Boolean(assignment) && (assignment?.isLead ?? false) === (role === 'lead')
  const assignedElsewhere =
    Boolean(assignment) &&
    !assignedInRole &&
    !(role === 'lead' && assignment && assignment.isLead === false)
  const leadSlotTaken = role === 'lead' && hasLead && !assignedInRole
  const weekCount = weeklyTherapistCounts.get(therapist.id) ?? 0
  const weeklyLimit = sanitizeWeeklyLimit(
    therapist.max_work_days_per_week,
    getDefaultWeeklyLimitForEmploymentType(therapist.employment_type)
  )
  const atLimit = weekCount >= weeklyLimit
  const employmentPenalty =
    therapist.employment_type?.toLowerCase() === 'prn'
      ? 20
      : therapist.employment_type?.toLowerCase() === 'part_time' ||
          therapist.employment_type?.toLowerCase() === 'pt'
        ? 10
        : 0

  let sortValue = weekCount + employmentPenalty
  if (assignedElsewhere) sortValue += 1000
  if (leadSlotTaken) sortValue += 750
  if (atLimit) sortValue += 500
  if (assignedInRole) sortValue -= 1000

  const recommended =
    !assignedInRole &&
    !assignedElsewhere &&
    !leadSlotTaken &&
    !atLimit &&
    weekCount < Math.max(weeklyLimit - 1, 1)

  return {
    sortValue,
    weekCount,
    weeklyLimit,
    atLimit,
    assignedInRole,
    assignedElsewhere,
    leadSlotTaken,
    recommended,
  }
}

type TherapistRowProps = {
  therapist: TherapistOption
  role: 'lead' | 'staff'
  selectedDay: SelectedDay
  canEdit: boolean
  assigning: boolean
  unassigningShiftId: string | null
  weeklyTherapistCounts: Map<string, number>
  assignedShiftMap: Map<string, { shiftId: string; isLead: boolean }>
  hasLead: boolean
  onAssignTherapist: (userId: string, role: 'lead' | 'staff') => Promise<void> | void
  onUnassign: (dayId: string, shiftId: string, isLead: boolean) => Promise<void> | void
}

function TherapistRow({
  therapist,
  role,
  selectedDay,
  canEdit,
  assigning,
  unassigningShiftId,
  weeklyTherapistCounts,
  assignedShiftMap,
  hasLead,
  onAssignTherapist,
  onUnassign,
}: TherapistRowProps) {
  const assignment = assignedShiftMap.get(therapist.id)
  const priority = getCandidatePriority({
    role,
    therapist,
    assignment,
    weeklyTherapistCounts,
    hasLead,
  })
  const assignedInThisRole = priority.assignedInRole
  const assignedElsewhere = priority.assignedElsewhere
  const shiftId = assignment?.shiftId ?? null
  const processing =
    (assigning && !assignedInThisRole) || (shiftId !== null && unassigningShiftId === shiftId)
  const disabled = !canEdit || assignedElsewhere || processing
  const employmentTypeLabel =
    therapist.employment_type?.toLowerCase() === 'prn'
      ? '[PRN]'
      : therapist.employment_type?.toLowerCase() === 'part_time' ||
          therapist.employment_type?.toLowerCase() === 'pt'
        ? '[PT]'
        : null
  const badgeClassName =
    'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]'

  return (
    <div
      data-testid={`coverage-therapist-row-${therapist.id}-${role}`}
      className={cn(
        'flex items-center gap-2 rounded-[16px] border px-3 py-2 transition-colors',
        assignedInThisRole
          ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary/20'
          : priority.recommended
            ? 'border-[var(--success-border)]/65 bg-[var(--success-subtle)]/18'
            : 'border-border/90 bg-card',
        disabled && !assignedInThisRole && 'opacity-60'
      )}
    >
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-extrabold text-muted-foreground">
        {initials(therapist.full_name)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-[14px] font-semibold text-foreground">
            {therapist.full_name}
            {employmentTypeLabel ? (
              <span className="ml-1 text-xs font-medium text-muted-foreground">
                {employmentTypeLabel}
              </span>
            ) : null}
          </p>
          {priority.recommended ? (
            <span
              className={cn(
                badgeClassName,
                'border-[var(--success-border)] bg-[var(--success-subtle)] text-[var(--success-text)]'
              )}
            >
              Best fit
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
          <span
            className={cn(
              badgeClassName,
              priority.atLimit
                ? 'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
                : 'border-border/70 bg-background text-muted-foreground'
            )}
          >
            Week {priority.weekCount}/{priority.weeklyLimit}
          </span>
          {role === 'lead' && therapist.isLeadEligible ? (
            <span
              className={cn(
                badgeClassName,
                'border-[var(--info-border)] bg-[var(--info-subtle)] text-[var(--info-text)]'
              )}
            >
              Lead eligible
            </span>
          ) : null}
          {assignedElsewhere ? (
            <span
              className={cn(
                badgeClassName,
                'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
              )}
            >
              Already on day
            </span>
          ) : null}
          {priority.atLimit ? (
            <span className="inline-flex items-center gap-1 text-[var(--warning-text)]">
              <Clock className="h-3 w-3" />
              At limit
            </span>
          ) : null}
        </div>
      </div>

      {role === 'lead' ? (
        <span className="rounded-full border border-[var(--info-border)] bg-[var(--info-subtle)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--info-text)]">
          Lead
        </span>
      ) : null}

      <button
        type="button"
        disabled={disabled}
        data-testid={
          assignedInThisRole && shiftId
            ? `coverage-unassign-${shiftId}`
            : `coverage-assign-toggle-${therapist.id}-${role}`
        }
        aria-label={
          assignedInThisRole
            ? `Unassign ${therapist.full_name}`
            : `Assign ${therapist.full_name} as ${role}`
        }
        className={cn(
          'inline-flex h-9 min-w-[82px] shrink-0 items-center justify-center rounded-full border px-3 text-[11px] font-semibold transition-colors',
          assignedInThisRole
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border bg-background text-foreground hover:border-primary/50 hover:bg-primary/5',
          disabled && 'cursor-not-allowed opacity-50'
        )}
        onClick={() => {
          if (disabled) return
          if (assignedInThisRole && shiftId) {
            void onUnassign(selectedDay.id, shiftId, role === 'lead')
            return
          }
          void onAssignTherapist(therapist.id, role)
        }}
      >
        {assignedInThisRole ? (
          <>
            <Check className="h-4 w-4" />
            Selected
          </>
        ) : assignedElsewhere ? (
          <>
            <MinusCircle className="h-4 w-4" />
            Unavailable
          </>
        ) : (
          <>
            <span className="inline-block h-2.5 w-2.5 rounded-full border border-current" />
            {role === 'lead'
              ? assignment && !assignment.isLead
                ? 'Make lead'
                : hasLead
                  ? 'Add to day'
                  : 'Assign lead'
              : 'Select'}
          </>
        )}
      </button>
    </div>
  )
}

function StatusAction({
  dayId,
  shift,
  isLead,
  canUpdateAssignmentStatus,
  onChangeStatus,
}: {
  dayId: string
  shift: ShiftItem
  isLead: boolean
  canUpdateAssignmentStatus: boolean
  onChangeStatus: (dayId: string, shiftId: string, isLead: boolean, nextStatus: UiStatus) => Promise<void> | void
}) {
  const trigger = (
    <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background px-2 py-0.5 text-[10px] font-medium text-foreground">
      {shift.status === 'active' ? (
        <span className="text-muted-foreground">Active</span>
      ) : (
        <span className="inline-flex items-center gap-1">
          <span>{getCoverageStatusLabel(shift.status)}</span>
          <InlineStatusChip status={shift.status} />
        </span>
      )}
    </span>
  )

  if (!canUpdateAssignmentStatus) {
    return trigger
  }

  return (
    <AssignmentStatusPopover
      therapistName={shift.name}
      currentStatus={shift.status}
      isLead={isLead}
      triggerTestId={`coverage-drawer-status-${dayId}-${shift.id}`}
      onChangeStatus={(nextStatus) => onChangeStatus(dayId, shift.id, isLead, nextStatus)}
    >
      {trigger}
    </AssignmentStatusPopover>
  )
}

function DrawerPersonRow({
  dayId,
  shift,
  isLead,
  canUpdateAssignmentStatus,
  operationalDetail,
  onChangeStatus,
}: {
  dayId: string
  shift: ShiftItem
  isLead: boolean
  canUpdateAssignmentStatus: boolean
  operationalDetail: ActiveOperationalDetail | null
  onChangeStatus: (dayId: string, shiftId: string, isLead: boolean, nextStatus: UiStatus) => Promise<void> | void
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-card px-3 py-2.5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-foreground">{shift.name}</p>
          {isLead ? (
            <span className="rounded-full border border-[var(--info-border)] bg-[var(--info-subtle)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--info-text)]">
              Lead
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <InlineStatusChip status={shift.status} />
          {operationalDetail?.leftEarlyTime ? (
            <span>Left at {formatLeftEarlyTime(operationalDetail.leftEarlyTime)}</span>
          ) : null}
        </div>
      </div>
      <div className="shrink-0">
        <StatusAction
          dayId={dayId}
          shift={shift}
          isLead={isLead}
          canUpdateAssignmentStatus={canUpdateAssignmentStatus}
          onChangeStatus={onChangeStatus}
        />
      </div>
    </div>
  )
}

export function ShiftEditorDialog({
  open,
  selectedDay,
  therapists,
  canEdit,
  canUpdateAssignmentStatus,
  coverageCycleId,
  isPastDate,
  hasOperationalEntries,
  activeOperationalDetails,
  selectedDayNotes,
  assigning,
  unassigningShiftId,
  weeklyTherapistCounts,
  assignError,
  onOpenChange,
  onAssignTherapist,
  onChangeStatus,
  onUnassign,
}: ShiftEditorDialogProps) {
  const assignedShiftMap = useMemo(() => {
    const map = new Map<string, { shiftId: string; isLead: boolean }>()

    if (selectedDay?.leadShift) {
      map.set(selectedDay.leadShift.userId, {
        shiftId: selectedDay.leadShift.id,
        isLead: true,
      })
    }

    for (const shift of selectedDay?.staffShifts ?? []) {
      map.set(shift.userId, {
        shiftId: shift.id,
        isLead: false,
      })
    }

    return map
  }, [selectedDay])

  const dayAssignments = useMemo(
    () =>
      selectedDay
        ? [
            ...(selectedDay.leadShift ? [{ shift: selectedDay.leadShift, isLead: true as const }] : []),
            ...selectedDay.staffShifts.map((shift) => ({ shift, isLead: false as const })),
          ]
        : [],
    [selectedDay]
  )

  const operationalEntries = useMemo(
    () =>
      dayAssignments.filter(({ shift }) => shift.status !== 'active').map((entry) => ({
        ...entry,
        detail: activeOperationalDetails.get(entry.shift.id) ?? null,
      })),
    [activeOperationalDetails, dayAssignments]
  )

  const hasLead = Boolean(selectedDay?.leadShift)
  const assignedCount = dayAssignments.length
  const activeCount = selectedDay ? countActive(selectedDay) : 0
  const coverageBadge = coverageState(selectedDay, activeCount)

  const leadTherapists = useMemo(
    () =>
      therapists
        .filter((therapist) => therapist.isLeadEligible)
        .sort(
          (a, b) =>
            getCandidatePriority({
              role: 'lead',
              therapist: a,
              assignment: assignedShiftMap.get(a.id),
              weeklyTherapistCounts,
              hasLead,
            }).sortValue -
              getCandidatePriority({
                role: 'lead',
                therapist: b,
                assignment: assignedShiftMap.get(b.id),
                weeklyTherapistCounts,
                hasLead,
              }).sortValue || a.full_name.localeCompare(b.full_name)
        ),
    [assignedShiftMap, hasLead, therapists, weeklyTherapistCounts]
  )

  const staffTherapists = useMemo(
    () =>
      [...therapists].sort(
        (a, b) =>
          getCandidatePriority({
            role: 'staff',
            therapist: a,
            assignment: assignedShiftMap.get(a.id),
            weeklyTherapistCounts,
            hasLead,
          }).sortValue -
            getCandidatePriority({
              role: 'staff',
              therapist: b,
              assignment: assignedShiftMap.get(b.id),
              weeklyTherapistCounts,
              hasLead,
            }).sortValue || a.full_name.localeCompare(b.full_name)
      ),
    [assignedShiftMap, hasLead, therapists, weeklyTherapistCounts]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-label={selectedDay ? `${selectedDay.label} ${selectedDay.shiftType} Shift` : 'Shift details'}
        data-testid="coverage-shift-editor-dialog"
        className="left-auto right-0 top-0 flex h-dvh w-[min(460px,100vw)] translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-b-0 border-r-0 border-t-0 p-0 shadow-tw-modal sm:max-w-[min(460px,100vw)]"
      >
        {selectedDay ? (
          <>
            <DialogHeader className="gap-2 border-b border-border bg-background px-5 pb-3 pt-4 text-left">
              <div className="flex flex-wrap items-start justify-between gap-3 pr-10">
                <div className="min-w-0">
                  <DialogTitle className="font-heading text-[1.4rem] font-semibold tracking-tight text-foreground">
                    {formatDrawerDate(selectedDay.isoDate)}
                  </DialogTitle>
                  <DialogDescription className="sr-only">
                    Review daily staffing details, operational statuses, notes, and edit actions for this shift.
                  </DialogDescription>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{selectedDay.shiftType} shift</span>
                    <span className="tabular-nums">{assignedCount} scheduled / 4 needed</span>
                    <span className="tabular-nums">{activeCount} active</span>
                  </div>
                </div>
                <span
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]',
                    coverageBadge.tone === 'success' &&
                      'border-[var(--success-border)] bg-[var(--success-subtle)] text-[var(--success-text)]',
                    coverageBadge.tone === 'warning' &&
                      'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]',
                    coverageBadge.tone === 'critical' &&
                      'border-[var(--error-border)] bg-[var(--error-subtle)] text-[var(--error-text)]'
                  )}
                >
                  {coverageBadge.label}
                </span>
              </div>
            </DialogHeader>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {assignError ? (
                <div
                  role="alert"
                  data-testid="coverage-assign-error"
                  className="rounded-xl border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-[12px] font-medium text-[var(--error-text)]"
                >
                  {assignError}
                </div>
              ) : null}

              {!canEdit ? (
                <div className="rounded-xl border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-3 py-2 text-[12px] font-medium text-[var(--warning-text)]">
                  {!coverageCycleId
                    ? 'This view has no active schedule cycle, so assignments are read-only.'
                    : canUpdateAssignmentStatus
                      ? 'Managers edit staffing assignments. Leads can still update on-call, call-in, cancelled, and leave-early statuses from this drawer.'
                      : 'This schedule is read-only. Managers or leads handle staffing and operational updates.'}
                </div>
              ) : null}

              {(isPastDate || hasOperationalEntries) && canEdit ? (
                <div
                  role="alert"
                  data-testid="coverage-guardrail-banner"
                  className="rounded-xl border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-3 py-2 text-[12px] font-medium text-[var(--warning-text)]"
                >
                  {isPastDate
                    ? 'This date is in the past. Changes will be logged as a post-publish modification.'
                    : 'This date has active operational entries. Changes will be logged as a post-publish modification.'}
                </div>
              ) : null}

              {!hasLead && canEdit ? (
                <div className="flex items-start gap-2 rounded-xl border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-3 py-2 text-[12px] text-[var(--warning-text)]">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>No lead assigned. A lead therapist is required for this shift.</span>
                </div>
              ) : null}

              <section className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Coverage details
                  </h2>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-border/70 bg-card px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Target
                    </p>
                    <p className="mt-1 tabular-nums text-sm font-semibold text-foreground">4</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-card px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Scheduled
                    </p>
                    <p className="mt-1 tabular-nums text-sm font-semibold text-foreground">
                      {assignedCount}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-card px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Active
                    </p>
                    <p className="mt-1 tabular-nums text-sm font-semibold text-foreground">
                      {activeCount}
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-2">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Lead
                </h2>
                {selectedDay.leadShift ? (
                  <DrawerPersonRow
                    dayId={selectedDay.id}
                    shift={selectedDay.leadShift}
                    isLead
                    canUpdateAssignmentStatus={canUpdateAssignmentStatus}
                    operationalDetail={activeOperationalDetails.get(selectedDay.leadShift.id) ?? null}
                    onChangeStatus={onChangeStatus}
                  />
                ) : (
                  <div className="rounded-xl border border-dashed border-[var(--warning-border)] bg-[var(--warning-subtle)]/35 px-3 py-2 text-sm text-[var(--warning-text)]">
                    No lead assigned.
                  </div>
                )}
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Staff
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {selectedDay.staffShifts.length} assigned
                  </span>
                </div>
                {selectedDay.staffShifts.length > 0 ? (
                  <div className="space-y-2">
                    {selectedDay.staffShifts.map((shift) => (
                      <DrawerPersonRow
                        key={shift.id}
                        dayId={selectedDay.id}
                        shift={shift}
                        isLead={false}
                        canUpdateAssignmentStatus={canUpdateAssignmentStatus}
                        operationalDetail={activeOperationalDetails.get(shift.id) ?? null}
                        onChangeStatus={onChangeStatus}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-border/70 bg-card px-3 py-2 text-sm text-muted-foreground">
                    No staff assigned.
                  </div>
                )}
              </section>

              <section className="space-y-2">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Operational statuses
                </h2>
                {operationalEntries.length > 0 ? (
                  <div className="space-y-2">
                    {operationalEntries.map(({ shift, isLead, detail }) => (
                      <div
                        key={`operational-${shift.id}`}
                        className="rounded-xl border border-border/70 bg-card px-3 py-2.5"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{shift.name}</p>
                          {isLead ? (
                            <span className="rounded-full border border-[var(--info-border)] bg-[var(--info-subtle)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--info-text)]">
                              Lead
                            </span>
                          ) : null}
                          <InlineStatusChip status={shift.status} />
                        </div>
                        {detail?.leftEarlyTime ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Left at {formatLeftEarlyTime(detail.leftEarlyTime)}
                          </p>
                        ) : null}
                        {detail?.note ? (
                          <p className="mt-1 text-xs text-foreground/75">{detail.note}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-border/70 bg-card px-3 py-2 text-sm text-muted-foreground">
                    None
                  </div>
                )}
              </section>

              <section className="space-y-2">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Notes
                </h2>
                {selectedDayNotes.length > 0 ? (
                  <div className="space-y-2">
                    {selectedDayNotes.map((note) => (
                      <div key={note} className="rounded-xl border border-border/70 bg-card px-3 py-2 text-sm text-foreground/80">
                        {note}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-border/70 bg-card px-3 py-2 text-sm text-muted-foreground">
                    —
                  </div>
                )}
              </section>

              {canEdit ? (
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Edit staffing
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      Manager-only actions
                    </span>
                  </div>

                  <section className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-foreground">Lead therapists</h3>
                      <span className="text-[11px] text-muted-foreground">
                        {leadTherapists.length} options
                      </span>
                    </div>
                    <div className="space-y-1">
                      {leadTherapists.map((therapist) => (
                        <TherapistRow
                          key={`lead-${therapist.id}`}
                          therapist={therapist}
                          role="lead"
                          selectedDay={selectedDay}
                          canEdit={canEdit}
                          assigning={assigning}
                          unassigningShiftId={unassigningShiftId}
                          weeklyTherapistCounts={weeklyTherapistCounts}
                          assignedShiftMap={assignedShiftMap}
                          hasLead={hasLead}
                          onAssignTherapist={onAssignTherapist}
                          onUnassign={onUnassign}
                        />
                      ))}
                    </div>
                  </section>

                  <section className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-foreground">Staff therapists</h3>
                      <span className="text-[11px] text-muted-foreground">
                        {staffTherapists.length} options
                      </span>
                    </div>
                    <div className="space-y-1">
                      {staffTherapists.map((therapist) => (
                        <TherapistRow
                          key={`staff-${therapist.id}`}
                          therapist={therapist}
                          role="staff"
                          selectedDay={selectedDay}
                          canEdit={canEdit}
                          assigning={assigning}
                          unassigningShiftId={unassigningShiftId}
                          weeklyTherapistCounts={weeklyTherapistCounts}
                          assignedShiftMap={assignedShiftMap}
                          hasLead={hasLead}
                          onAssignTherapist={onAssignTherapist}
                          onUnassign={onUnassign}
                        />
                      ))}
                    </div>
                  </section>

                  {selectedDay.constraintBlocked ? (
                    <div className="flex items-start gap-2 rounded-xl border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-[12px] text-[var(--error-text)]">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>No eligible therapists for this shift because of current constraints.</span>
                    </div>
                  ) : null}
                </section>
              ) : null}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
