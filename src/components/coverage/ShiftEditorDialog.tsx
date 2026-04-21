'use client'

import { useMemo } from 'react'
import { AlertCircle, AlertTriangle } from 'lucide-react'

import {
  getCandidatePriority,
  ShiftEditorTherapistSections,
} from '@/components/coverage/ShiftEditorTherapistSections'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { shiftEditorDialogLayout } from '@/components/coverage/shift-editor-dialog-layout'
import { countActive, type DayItem, type ShiftTab } from '@/lib/coverage/selectors'
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

export { getCandidatePriority } from '@/components/coverage/ShiftEditorTherapistSections'

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

              <ShiftEditorTherapistSections
                leadTherapists={leadTherapists}
                staffTherapists={staffTherapists}
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
