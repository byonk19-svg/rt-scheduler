'use client'

import { AlertCircle, Check, Clock } from 'lucide-react'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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

  return (
    <div
      data-testid={`coverage-therapist-row-${therapist.id}-${role}`}
      className={cn(
        'flex items-center gap-3 rounded-[24px] border px-4 py-4 transition-colors',
        assignedInThisRole
          ? 'border-[var(--info-border)] bg-[var(--info-subtle)]/70'
          : 'border-border/90 bg-card',
        disabled && !assignedInThisRole && 'opacity-60'
      )}
    >
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-extrabold text-muted-foreground">
        {initials(therapist.full_name)}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[1.05rem] font-semibold text-foreground">{therapist.full_name}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
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
        <span className="rounded-md border border-[var(--info-border)] bg-[var(--info-subtle)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--info-text)]">
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
          'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
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
  assigning,
  unassigningShiftId,
  weeklyTherapistCounts,
  assignError,
  onOpenChange,
  onAssignTherapist,
  onUnassign,
}: ShiftEditorDialogProps) {
  const leadTherapists = therapists.filter((therapist) => therapist.isLeadEligible)
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-label={
          selectedDay ? `${selectedDay.label} ${selectedDay.shiftType} Shift` : 'Shift editor'
        }
        data-testid="coverage-shift-editor-dialog"
        className="max-h-[calc(100vh-2rem)] overflow-y-auto px-0 pb-0 pt-0 sm:max-w-[640px]"
      >
        {selectedDay && (
          <>
            <DialogHeader className="gap-1 border-b border-border px-6 pb-5 pt-6">
              <DialogTitle className="font-heading text-[2rem] font-bold tracking-[-0.04em] text-foreground">
                {selectedDay.label}
              </DialogTitle>
              <p className="text-[1.1rem] text-foreground/80">{selectedDay.shiftType} Shift</p>
              <p className="pt-2 text-[1.1rem] font-semibold text-[var(--success-text)]">
                OK {countActive(selectedDay)} active
              </p>
            </DialogHeader>

            <div className="space-y-5 px-6 py-5">
              {assignError && (
              <div
                role="alert"
                data-testid="coverage-assign-error"
                className="rounded-xl border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-sm font-medium text-[var(--error-text)]"
              >
                {assignError}
              </div>
              )}

              {!canEdit && (
              <div className="rounded-xl border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-3 py-2 text-sm font-medium text-[var(--warning-text)]">
                This view has no active schedule cycle, so assignments are read-only.
              </div>
              )}

              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Lead Therapists
                  </h2>
                </div>
                <div className="space-y-2.5">
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

              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Staff Therapists
                  </h2>
                </div>
                <div className="space-y-2.5">
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
                <div className="flex items-start gap-2 rounded-xl border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-sm text-[var(--error-text)]">
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
