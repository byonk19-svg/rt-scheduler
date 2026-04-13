'use client'

import { AlertCircle, AlertTriangle, Check, Clock } from 'lucide-react'

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
  role: 'therapist' | 'lead'
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
  /** When set, non-managers see guidance instead of the empty-cycle message. */
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
  const assignedInThisRole = Boolean(assignment) && assignment!.isLead === (role === 'lead')
  const assignedElsewhere = Boolean(assignment) && !assignedInThisRole
  const leadSlotTaken = role === 'lead' && hasLead && !assignedInThisRole
  const shiftId = assignment?.shiftId ?? null
  const weekCount = weeklyTherapistCounts.get(therapist.id) ?? 0
  const limit = sanitizeWeeklyLimit(
    therapist.max_work_days_per_week,
    getDefaultWeeklyLimitForEmploymentType(therapist.employment_type)
  )
  const atLimit = weekCount >= limit
  const processing =
    (assigning && !assignedInThisRole) || (shiftId !== null && unassigningShiftId === shiftId)
  const disabled = !canEdit || leadSlotTaken || assignedElsewhere || processing
  const employmentTypeLabel =
    therapist.employment_type?.toLowerCase() === 'prn'
      ? '[PRN]'
      : therapist.employment_type?.toLowerCase() === 'part_time' ||
          therapist.employment_type?.toLowerCase() === 'pt'
        ? '[PT]'
        : null

  return (
    <div
      data-testid={`coverage-therapist-row-${therapist.id}-${role}`}
      className={cn(
        shiftEditorDialogLayout.row,
        assignedInThisRole
          ? 'border-[var(--info-border)] bg-[var(--info-subtle)]/70'
          : 'border-border/90 bg-card',
        disabled && !assignedInThisRole && 'opacity-60'
      )}
    >
      <span className={shiftEditorDialogLayout.avatar}>
        {initials(therapist.full_name)}
      </span>

      <div className="min-w-0 flex-1">
        <p className={shiftEditorDialogLayout.name}>
          {therapist.full_name}
          {employmentTypeLabel ? (
            <span className="ml-1 text-xs font-medium text-muted-foreground">{employmentTypeLabel}</span>
          ) : null}
        </p>
        <div className={shiftEditorDialogLayout.meta}>
          <span>{weekCount} shifts this week</span>
          {assignedElsewhere && (
            <>
              <span>·</span>
              <span>Already assigned on this day</span>
            </>
          )}
          {atLimit && (
            <>
              <span>·</span>
              <Clock className="h-3 w-3" />
              <span>Weekly limit reached</span>
            </>
          )}
        </div>
      </div>

      {role === 'lead' && (
        <span className={shiftEditorDialogLayout.leadBadge}>
          Lead
        </span>
      )}

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
            : 'border-border bg-background hover:border-primary/50',
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
        {assignedInThisRole && <Check className="h-4 w-4" />}
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
  const leadTherapists = therapists.filter((therapist) => therapist.role === 'lead')
  const assignedShiftMap = new Map<string, { shiftId: string; isLead: boolean }>()

  if (selectedDay?.leadShift) {
    assignedShiftMap.set(selectedDay.leadShift.userId, {
      shiftId: selectedDay.leadShift.id,
      isLead: true,
    })
  }

  for (const shift of selectedDay?.staffShifts ?? []) {
    assignedShiftMap.set(shift.userId, {
      shiftId: shift.id,
      isLead: false,
    })
  }

  const hasLead = Boolean(selectedDay?.leadShift)
  const assignedCount = (selectedDay?.leadShift ? 1 : 0) + (selectedDay?.staffShifts.length ?? 0)
  const coverageStatusColorClass =
    assignedCount < 3
      ? 'text-[var(--error-text)]'
      : assignedCount > 5
        ? 'text-[var(--warning-text)]'
        : 'text-[var(--success-text)]'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-label={
          selectedDay ? `${selectedDay.label} ${selectedDay.shiftType} Shift` : 'Shift editor'
        }
        data-testid="coverage-shift-editor-dialog"
        className={shiftEditorDialogLayout.dialogContent}
      >
        {selectedDay && (
          <>
            <DialogHeader className={shiftEditorDialogLayout.header}>
              <DialogTitle className={shiftEditorDialogLayout.title}>
                {selectedDay.label}
              </DialogTitle>
              <p className={shiftEditorDialogLayout.shiftLabel}>{selectedDay.shiftType} Shift</p>
              <p className={shiftEditorDialogLayout.activeSummary}>
                OK {countActive(selectedDay)} active
              </p>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span className={cn('font-semibold', coverageStatusColorClass)}>
                  {assignedCount} / 5 covered
                </span>
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      assignedCount < 3
                        ? 'bg-[var(--error-text)]'
                        : assignedCount > 5
                          ? 'bg-[var(--warning-text)]'
                          : 'bg-[var(--success-text)]'
                    )}
                    style={{ width: `${Math.min((assignedCount / 5) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </DialogHeader>

            <div className={shiftEditorDialogLayout.body}>
              {assignError && (
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
              )}

              {!canEdit && (
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
              )}

              {(isPastDate || hasOperationalEntries) && canEdit && (
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
              )}
              {!hasLead && canEdit && (
                <div
                  className={cn(
                    shiftEditorDialogLayout.alert,
                    'flex items-start gap-2 border border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
                  )}
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>No lead assigned — a lead therapist is required for this shift</span>
                </div>
              )}

              <section className={shiftEditorDialogLayout.section}>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Lead Therapists
                  </h2>
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
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Staff Therapists
                  </h2>
                </div>
                <div className={shiftEditorDialogLayout.rowList}>
                  {therapists.map((therapist) => (
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

              {selectedDay.constraintBlocked && (
                <div
                  className={cn(
                    shiftEditorDialogLayout.alert,
                    'flex items-start gap-2 border border-[var(--error-border)] bg-[var(--error-subtle)] text-[var(--error-text)]'
                  )}
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>No eligible therapists for this shift because of current constraints.</span>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
