'use client'

import { Check, Clock, MinusCircle } from 'lucide-react'

import { shiftEditorDialogLayout } from '@/components/coverage/shift-editor-dialog-layout'
import type { DayItem, ShiftTab } from '@/lib/coverage/selectors'
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

type CandidatePriorityInput = {
  role: 'lead' | 'staff'
  therapist: TherapistOption
  assignment: { shiftId: string; isLead: boolean } | undefined
  weeklyTherapistCounts: Map<string, number>
  hasLead: boolean
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
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

export function ShiftEditorTherapistRow({
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
}: {
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
}) {
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
