'use client'

import { useMemo } from 'react'
import { AlertCircle, AlertTriangle, Check, Clock, MinusCircle } from 'lucide-react'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { shiftEditorDialogLayout } from '@/components/coverage/shift-editor-dialog-layout'
import { countActive, type DayItem, type ShiftTab } from '@/lib/coverage/selectors'
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
  coverageCycleId: string | null
  isPastDate: boolean
  hasOperationalEntries: boolean
  assigning: boolean
  unassigningShiftId: string | null
  weeklyTherapistCounts: Map<string, number>
  assignError: string
  onOpenChange: (open: boolean) => void
  onAssignTherapist: (userId: string, role: 'lead' | 'staff') => Promise<void> | void
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
  // Lead-eligible row: staff assignment that day is still actionable (add coverage vs promote).
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
        shiftEditorDialogLayout.row,
        assignedInThisRole
          ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary/20'
          : priority.recommended
            ? 'border-[var(--success-border)]/65 bg-[var(--success-subtle)]/18'
            : 'border-border/90 bg-card',
        disabled && !assignedInThisRole && 'opacity-60'
      )}
    >
      <span className={shiftEditorDialogLayout.avatar}>{initials(therapist.full_name)}</span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className={shiftEditorDialogLayout.name}>
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
        <div className={shiftEditorDialogLayout.meta}>
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

      {role === 'lead' ? <span className={shiftEditorDialogLayout.leadBadge}>Lead</span> : null}

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
          shiftEditorDialogLayout.action,
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

export function ShiftEditorDialog({
  open,
  selectedDay,
  therapists,
  canEdit,
  coverageCycleId,
  isPastDate,
  hasOperationalEntries,
  assigning,
  unassigningShiftId,
  weeklyTherapistCounts,
  assignError,
  onOpenChange,
  onAssignTherapist,
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

  const hasLead = Boolean(selectedDay?.leadShift)
  const assignedCount = (selectedDay?.leadShift ? 1 : 0) + (selectedDay?.staffShifts.length ?? 0)
  const activeCount = selectedDay ? countActive(selectedDay) : 0
  const coverageStatusColorClass =
    assignedCount < 3
      ? 'text-[var(--error-text)]'
      : assignedCount > 5
        ? 'text-[var(--warning-text)]'
        : 'text-[var(--success-text)]'

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
        aria-label={
          selectedDay ? `${selectedDay.label} ${selectedDay.shiftType} Shift` : 'Shift editor'
        }
        data-testid="coverage-shift-editor-dialog"
        className={shiftEditorDialogLayout.dialogContent}
      >
        {selectedDay ? (
          <>
            <DialogHeader className={shiftEditorDialogLayout.header}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <DialogTitle className={shiftEditorDialogLayout.title}>
                    {selectedDay.label}
                  </DialogTitle>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className={shiftEditorDialogLayout.shiftLabel}>{selectedDay.shiftType} Shift</p>
                    <span className={cn('text-[12px] font-semibold', coverageStatusColorClass)}>
                      {assignedCount} / 5 covered
                    </span>
                    <span className="text-[12px] text-muted-foreground">{activeCount} active</span>
                    {!hasLead ? (
                      <span className="rounded-full border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-2 py-0.5 text-[10px] font-semibold text-[var(--warning-text)]">
                        No lead
                      </span>
                    ) : null}
                  </div>
                </div>
                <p className={shiftEditorDialogLayout.activeSummary}>Plan day</p>
              </div>
            </DialogHeader>

            <div className={shiftEditorDialogLayout.body}>
              {assignError ? (
                <div
                  role="alert"
                  data-testid="coverage-assign-error"
                  className={cn(
                    shiftEditorDialogLayout.alert,
                    'border border-[var(--error-border)] bg-[var(--error-subtle)] font-medium text-[var(--error-text)]'
                  )}
                >
                  {assignError}
                </div>
              ) : null}

              {!canEdit ? (
                <div
                  className={cn(
                    shiftEditorDialogLayout.alert,
                    'border border-[var(--warning-border)] bg-[var(--warning-subtle)] font-medium text-[var(--warning-text)]'
                  )}
                >
                  {!coverageCycleId
                    ? 'This view has no active schedule cycle, so assignments are read-only.'
                    : 'Staffing rows are manager-only. Leads can still set on-call, call-in, cancelled, and leave-early from therapist names on the calendar grid.'}
                </div>
              ) : null}

              {(isPastDate || hasOperationalEntries) && canEdit ? (
                <div
                  role="alert"
                  data-testid="coverage-guardrail-banner"
                  className={cn(
                    shiftEditorDialogLayout.alert,
                    'border border-[var(--warning-border)] bg-[var(--warning-subtle)] font-medium text-[var(--warning-text)]'
                  )}
                >
                  {isPastDate
                    ? 'This date is in the past. Changes will be logged as a post-publish modification.'
                    : 'This date has active operational entries. Changes will be logged as a post-publish modification.'}
                </div>
              ) : null}

              {!hasLead && canEdit ? (
                <div
                  className={cn(
                    shiftEditorDialogLayout.alert,
                    'flex items-start gap-2 border border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
                  )}
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>No lead assigned. A lead therapist is required for this shift.</span>
                </div>
              ) : null}

              <section className={shiftEditorDialogLayout.section}>
                <div className="sticky top-0 z-[1] -mx-1 flex items-center justify-between gap-2 rounded-lg bg-background/95 px-1 py-1 backdrop-blur">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Lead therapists
                  </h2>
                  <span className="text-[11px] text-muted-foreground">
                    {leadTherapists.length} options
                  </span>
                </div>
                <div className={shiftEditorDialogLayout.rowList}>
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

              <section className={shiftEditorDialogLayout.section}>
                <div className="sticky top-0 z-[1] -mx-1 flex items-center justify-between gap-2 rounded-lg bg-background/95 px-1 py-1 backdrop-blur">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Staff therapists
                  </h2>
                  <span className="text-[11px] text-muted-foreground">
                    {staffTherapists.length} options
                  </span>
                </div>
                <div className={shiftEditorDialogLayout.rowList}>
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
                <div
                  className={cn(
                    shiftEditorDialogLayout.alert,
                    'flex items-start gap-2 border border-[var(--error-border)] bg-[var(--error-subtle)] text-[var(--error-text)]'
                  )}
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>No eligible therapists for this shift because of current constraints.</span>
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
