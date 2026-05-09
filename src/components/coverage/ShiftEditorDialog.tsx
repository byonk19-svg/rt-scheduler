'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, Search, X } from 'lucide-react'

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
  actorUserId: string | null
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

type PickerMode = 'lead' | 'staff'

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

type PickerCandidate = {
  therapist: TherapistOption
  priority: ReturnType<typeof getCandidatePriority>
}

function PanelHeader({
  selectedDay,
  activeCount,
  assignedCount,
  coverageBadge,
  canEdit,
  canUpdateAssignmentStatus,
}: {
  selectedDay: SelectedDay
  activeCount: number
  assignedCount: number
  coverageBadge: ReturnType<typeof coverageState>
  canEdit: boolean
  canUpdateAssignmentStatus: boolean
}) {
  const progress = Math.min((activeCount / 4) * 100, 100)
  const drawerModeLabel = canEdit ? 'Coverage shift editor' : 'Team Schedule details'
  const drawerModeDescription = canEdit
    ? 'Manager staffing changes and post-publish guardrails for this selected shift.'
    : canUpdateAssignmentStatus
      ? 'Shared schedule context with lead-only operational status updates.'
      : 'Read-only shared schedule context for this selected shift.'

  return (
    <DialogHeader className="sticky top-0 z-10 gap-2 border-b border-border bg-background px-5 pb-3 pt-4 text-left">
      <div className="flex flex-wrap items-start justify-between gap-3 pr-10">
        <div className="min-w-0">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {drawerModeLabel}
          </p>
          <DialogTitle className="font-heading text-[1.25rem] font-semibold tracking-tight text-foreground">
            {formatDrawerDate(selectedDay.isoDate)} - {selectedDay.shiftType} shift
          </DialogTitle>
          <DialogDescription className="sr-only">
            {canEdit
              ? 'Review manager staffing actions and guardrails for this selected shift.'
              : 'Review shared schedule details for this selected shift.'}
          </DialogDescription>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <div
              className="h-1.5 w-28 overflow-hidden rounded-full bg-muted"
              aria-label={`${activeCount} of 4 active`}
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
            <span className="tabular-nums">
              {activeCount} / 4 active
            </span>
            <span className="text-muted-foreground/70">({assignedCount} assigned)</span>
          </div>
          <p className="mt-1 max-w-[34rem] text-xs text-muted-foreground">
            {drawerModeDescription}
          </p>
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
  )
}

function PastDateBar({
  canEdit,
  canUpdateAssignmentStatus,
  coverageCycleId,
  isPastDate,
  hasOperationalEntries,
}: {
  canEdit: boolean
  canUpdateAssignmentStatus: boolean
  coverageCycleId: string | null
  isPastDate: boolean
  hasOperationalEntries: boolean
}) {
  let message: string | null = null

  if (!coverageCycleId) {
    message = 'Read-only: no active schedule cycle is available for this shift.'
  } else if (!canEdit) {
    message = canUpdateAssignmentStatus
      ? 'Read-only staffing: operational status updates are still available.'
      : 'Read-only schedule: staffing and operational updates are unavailable.'
  } else if (isPastDate) {
    message = 'Past date: staffing edits will be logged as post-publish changes.'
  } else if (hasOperationalEntries) {
    message = 'Operational activity exists: staffing edits will be logged as post-publish changes.'
  }

  if (!message) return null

  return (
    <div className="border-b border-[var(--warning-border)] bg-[var(--warning-subtle)] px-5 py-1.5 text-[11px] font-medium text-[var(--warning-text)]">
      {message}
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
  canUnassign = false,
  unassigning = false,
  operationalDetail,
  onChangeStatus,
  onUnassign,
}: {
  dayId: string
  shift: ShiftItem
  isLead: boolean
  canUpdateAssignmentStatus: boolean
  canUnassign?: boolean
  unassigning?: boolean
  operationalDetail: ActiveOperationalDetail | null
  onChangeStatus: (dayId: string, shiftId: string, isLead: boolean, nextStatus: UiStatus) => Promise<void> | void
  onUnassign?: (dayId: string, shiftId: string, isLead: boolean) => Promise<void> | void
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
      <div className="flex shrink-0 items-center gap-1.5">
        <StatusAction
          dayId={dayId}
          shift={shift}
          isLead={isLead}
          canUpdateAssignmentStatus={canUpdateAssignmentStatus}
          onChangeStatus={onChangeStatus}
        />
        {canUnassign ? (
          <button
            type="button"
            disabled={unassigning}
            data-testid={`coverage-unassign-${shift.id}`}
            aria-label={`Remove ${shift.name} from this shift`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:border-[var(--error-border)] hover:text-[var(--error-text)] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onUnassign?.(dayId, shift.id, isLead)}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  )
}

function SectionHeading({
  title,
  trailing,
}: {
  title: string
  trailing?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </h2>
      {trailing}
    </div>
  )
}

function LeadSection({
  selectedDay,
  canEdit,
  canUpdateAssignmentStatus,
  unassigningShiftId,
  operationalDetail,
  onOpenPicker,
  onChangeStatus,
  onUnassign,
}: {
  selectedDay: SelectedDay
  canEdit: boolean
  canUpdateAssignmentStatus: boolean
  unassigningShiftId: string | null
  operationalDetail: ActiveOperationalDetail | null
  onOpenPicker: () => void
  onChangeStatus: (dayId: string, shiftId: string, isLead: boolean, nextStatus: UiStatus) => Promise<void> | void
  onUnassign: (dayId: string, shiftId: string, isLead: boolean) => Promise<void> | void
}) {
  return (
    <section className="space-y-2">
      <SectionHeading title="Lead" />
      {selectedDay.leadShift ? (
        <div className="space-y-2">
          <DrawerPersonRow
            dayId={selectedDay.id}
            shift={selectedDay.leadShift}
            isLead
            canUpdateAssignmentStatus={canUpdateAssignmentStatus}
            canUnassign={canEdit}
            unassigning={unassigningShiftId === selectedDay.leadShift.id}
            operationalDetail={operationalDetail}
            onChangeStatus={onChangeStatus}
            onUnassign={onUnassign}
          />
          {canEdit ? (
            <button
              type="button"
              className="inline-flex min-h-9 items-center rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              onClick={onOpenPicker}
            >
              Change
            </button>
          ) : null}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-[var(--warning-border)] bg-[var(--warning-subtle)]/35 px-3 py-3">
          <span className="text-sm font-medium text-[var(--warning-text)]">No lead assigned</span>
          {canEdit ? (
            <button
              type="button"
              className="inline-flex min-h-9 shrink-0 items-center rounded-lg border border-[var(--warning-border)] bg-background px-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              onClick={onOpenPicker}
            >
              Assign lead
            </button>
          ) : null}
        </div>
      )}
    </section>
  )
}

function StaffSection({
  selectedDay,
  canEdit,
  canUpdateAssignmentStatus,
  unassigningShiftId,
  activeOperationalDetails,
  onOpenPicker,
  onChangeStatus,
  onUnassign,
}: {
  selectedDay: SelectedDay
  canEdit: boolean
  canUpdateAssignmentStatus: boolean
  unassigningShiftId: string | null
  activeOperationalDetails: Map<string, ActiveOperationalDetail>
  onOpenPicker: () => void
  onChangeStatus: (dayId: string, shiftId: string, isLead: boolean, nextStatus: UiStatus) => Promise<void> | void
  onUnassign: (dayId: string, shiftId: string, isLead: boolean) => Promise<void> | void
}) {
  return (
    <section className="space-y-2">
      <SectionHeading
        title="Staff"
        trailing={
          <span className="text-xs text-muted-foreground">
            {selectedDay.staffShifts.length} assigned
          </span>
        }
      />
      {selectedDay.staffShifts.length > 0 ? (
        <div className="space-y-2">
          {selectedDay.staffShifts.map((shift) => (
            <DrawerPersonRow
              key={shift.id}
              dayId={selectedDay.id}
              shift={shift}
              isLead={false}
              canUpdateAssignmentStatus={canUpdateAssignmentStatus}
              canUnassign={canEdit}
              unassigning={unassigningShiftId === shift.id}
              operationalDetail={activeOperationalDetails.get(shift.id) ?? null}
              onChangeStatus={onChangeStatus}
              onUnassign={onUnassign}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border/70 bg-card px-3 py-2 text-sm text-muted-foreground">
          No staff assigned.
        </div>
      )}
      {canEdit ? (
        <button
          type="button"
          className="inline-flex min-h-9 items-center rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          onClick={onOpenPicker}
        >
          + Add therapist
        </button>
      ) : null}
    </section>
  )
}

function PickerRow({
  mode,
  candidate,
  assigning,
  onAssign,
}: {
  mode: PickerMode
  candidate: PickerCandidate
  assigning: boolean
  onAssign: (userId: string, role: 'lead' | 'staff') => void
}) {
  const { therapist, priority } = candidate
  const actionLabel = mode === 'lead' ? 'Assign lead' : 'Add to shift'
  const employmentTypeLabel =
    therapist.employment_type?.toLowerCase() === 'prn'
      ? 'PRN'
      : therapist.employment_type?.toLowerCase() === 'part_time' ||
          therapist.employment_type?.toLowerCase() === 'pt'
        ? 'PT'
        : null

  return (
    <div
      data-testid={`coverage-picker-row-${therapist.id}-${mode}`}
      className={cn(
        'flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors',
        priority.recommended
          ? 'border-[var(--success-border)]/65 bg-[var(--success-subtle)]/18'
          : 'border-border/90 bg-card'
      )}
    >
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-extrabold text-muted-foreground">
        {initials(therapist.full_name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-foreground">{therapist.full_name}</p>
          {employmentTypeLabel ? (
            <span className="rounded-full border border-border/70 bg-background px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {employmentTypeLabel}
            </span>
          ) : null}
          {priority.recommended ? (
            <span className="rounded-full border border-[var(--success-border)] bg-[var(--success-subtle)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--success-text)]">
              Recommended
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <span
            className={cn(
              'rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]',
              priority.atLimit
                ? 'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
                : 'border-border/70 bg-background text-muted-foreground'
            )}
          >
            Week {priority.weekCount}/{priority.weeklyLimit}
          </span>
          {mode === 'lead' && therapist.isLeadEligible ? <span>Lead eligible</span> : null}
        </div>
      </div>
      <button
        type="button"
        disabled={assigning}
        className="inline-flex h-9 min-w-[96px] shrink-0 items-center justify-center rounded-lg border border-input bg-background px-3 text-[11px] font-semibold text-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => onAssign(therapist.id, mode)}
      >
        {actionLabel}
      </button>
    </div>
  )
}

function TherapistPicker({
  mode,
  candidates,
  query,
  assigning,
  onQueryChange,
  onAssign,
  onClose,
}: {
  mode: PickerMode
  candidates: PickerCandidate[]
  query: string
  assigning: boolean
  onQueryChange: (query: string) => void
  onAssign: (userId: string, role: 'lead' | 'staff') => void
  onClose: () => void
}) {
  const normalizedQuery = query.trim().toLowerCase()
  const filteredCandidates = candidates.filter(({ therapist }) => {
    if (!normalizedQuery) return true
    return [therapist.full_name, therapist.employment_type ?? '', therapist.shift_type]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery)
  })
  const recommended = filteredCandidates.filter(({ priority }) => priority.recommended)
  const all = filteredCandidates.filter(({ priority }) => !priority.recommended)
  const title = mode === 'lead' ? 'Choose lead' : 'Add therapist'
  const placeholder = mode === 'lead' ? 'Search lead-eligible therapists...' : 'Search therapists...'

  return (
    <section className="space-y-3 rounded-xl border border-border/80 bg-muted/15 p-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <button
          type="button"
          aria-label="Close therapist picker"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:bg-muted"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <label className="flex min-h-10 items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm text-muted-foreground focus-within:border-primary/60">
        <Search className="h-4 w-4" />
        <input
          autoFocus
          value={query}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>
      {recommended.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Recommended
          </p>
          {recommended.map((candidate) => (
            <PickerRow
              key={`recommended-${mode}-${candidate.therapist.id}`}
              mode={mode}
              candidate={candidate}
              assigning={assigning}
              onAssign={onAssign}
            />
          ))}
        </div>
      ) : null}
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          All
        </p>
        {all.length > 0 ? (
          all.map((candidate) => (
            <PickerRow
              key={`all-${mode}-${candidate.therapist.id}`}
              mode={mode}
              candidate={candidate}
              assigning={assigning}
              onAssign={onAssign}
            />
          ))
        ) : (
          <div className="rounded-xl border border-border/70 bg-card px-3 py-2 text-sm text-muted-foreground">
            {filteredCandidates.length === 0
              ? 'No therapists match this search.'
              : 'No additional therapists in this group.'}
          </div>
        )}
      </div>
    </section>
  )
}

function OperationalNotesSection({
  operationalEntries,
  selectedDayNotes,
  showLotteryLink,
  lotteryHref,
  lotteryLinkReason,
}: {
  operationalEntries: Array<{
    shift: ShiftItem
    isLead: boolean
    detail: ActiveOperationalDetail | null
  }>
  selectedDayNotes: string[]
  showLotteryLink: boolean
  lotteryHref: string
  lotteryLinkReason: string
}) {
  const operationalNotes = operationalEntries.flatMap(({ detail }) => (detail?.note ? [detail.note] : []))
  const notes = Array.from(new Set([...operationalNotes, ...selectedDayNotes].filter(Boolean)))
  const hasContent = operationalEntries.length > 0 || notes.length > 0 || showLotteryLink

  return (
    <details className="group rounded-xl border border-border/70 bg-card" open={hasContent}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Operational notes
        </span>
        <span className="text-xs text-muted-foreground">
          {hasContent ? 'Review' : 'None'}
        </span>
      </summary>
      <div className="space-y-3 border-t border-border/70 px-3 py-3">
        {operationalEntries.length > 0 ? (
          <div className="space-y-2">
            {operationalEntries.map(({ shift, isLead, detail }) => (
              <div key={`operational-${shift.id}`} className="rounded-xl border border-border/70 bg-background px-3 py-2">
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
              </div>
            ))}
          </div>
        ) : null}
        {notes.length > 0 ? (
          <div className="space-y-2">
            {notes.map((note) => (
              <div key={note} className="rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground/80">
                {note}
              </div>
            ))}
          </div>
        ) : null}
        {showLotteryLink ? (
          <div className="rounded-xl border border-border/70 bg-muted/15 px-3 py-3 text-sm">
            <p className="font-semibold text-foreground">Lottery decision available</p>
            <p className="mt-1 text-xs text-muted-foreground">{lotteryLinkReason}</p>
            <Link
              href={lotteryHref}
              className="mt-3 inline-flex min-h-9 items-center rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground hover:bg-muted"
            >
              Open Lottery for this shift
            </Link>
          </div>
        ) : null}
        {!hasContent ? (
          <div className="rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-muted-foreground">
            No operational notes.
          </div>
        ) : null}
      </div>
    </details>
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
  const selectedDayId = selectedDay?.id ?? null
  const [pickerState, setPickerState] = useState<{
    mode: PickerMode | null
    query: string
    dayId: string | null
  }>({
    mode: null,
    query: '',
    dayId: null,
  })
  const pickerMode = pickerState.dayId === selectedDayId ? pickerState.mode : null
  const pickerQuery = pickerState.dayId === selectedDayId ? pickerState.query : ''

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
  const hasLotteryStatus = operationalEntries.some(
    ({ shift }) => shift.status === 'cancelled' || shift.status === 'oncall'
  )
  const showLotteryLink = assignedCount > 4 || hasLotteryStatus
  const lotteryHref = selectedDay
    ? `/lottery?date=${selectedDay.isoDate}&shift=${selectedDay.shiftType.toLowerCase()}`
    : '/lottery'
  const lotteryLinkReason =
    assignedCount > 4
      ? 'This shift has more scheduled staff than the normal active target.'
      : 'This shift has Cancelled or On Call status in Team Schedule.'

  const pickerCandidates = useMemo<PickerCandidate[]>(() => {
    if (!pickerMode) return []

    const baseTherapists =
      pickerMode === 'lead'
        ? therapists.filter((therapist) => {
            if (!therapist.isLeadEligible) return false
            const assignment = assignedShiftMap.get(therapist.id)
            if (assignment?.isLead) return false
            return hasLead ? assignment?.isLead === false : true
          })
        : therapists.filter((therapist) => !assignedShiftMap.has(therapist.id))

    return baseTherapists
      .map((therapist) => ({
        therapist,
        priority: getCandidatePriority({
          role: pickerMode,
          therapist,
          assignment: assignedShiftMap.get(therapist.id),
          weeklyTherapistCounts,
          hasLead,
        }),
      }))
      .sort(
        (a, b) =>
          a.priority.sortValue - b.priority.sortValue ||
          a.therapist.full_name.localeCompare(b.therapist.full_name)
      )
  }, [assignedShiftMap, hasLead, pickerMode, therapists, weeklyTherapistCounts])

  const openPicker = (mode: PickerMode) => {
    setPickerState({ mode, query: '', dayId: selectedDayId })
  }

  const closePicker = () => {
    setPickerState({ mode: null, query: '', dayId: selectedDayId })
  }

  const setPickerQuery = (query: string) => {
    setPickerState({ mode: pickerMode, query, dayId: selectedDayId })
  }

  const handleAssign = (userId: string, role: 'lead' | 'staff') => {
    closePicker()
    void onAssignTherapist(userId, role)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-label={selectedDay ? `${selectedDay.label} ${selectedDay.shiftType} Shift` : 'Shift details'}
        data-testid="coverage-shift-editor-dialog"
        className="left-auto right-0 top-0 flex h-dvh w-[min(460px,100vw)] translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-b-0 border-r-0 border-t-0 p-0 shadow-tw-modal sm:max-w-[min(460px,100vw)]"
      >
        {selectedDay ? (
          <>
            <PanelHeader
              selectedDay={selectedDay}
              activeCount={activeCount}
              assignedCount={assignedCount}
              coverageBadge={coverageBadge}
              canEdit={canEdit}
              canUpdateAssignmentStatus={canUpdateAssignmentStatus}
            />
            <PastDateBar
              canEdit={canEdit}
              canUpdateAssignmentStatus={canUpdateAssignmentStatus}
              coverageCycleId={coverageCycleId}
              isPastDate={isPastDate}
              hasOperationalEntries={hasOperationalEntries}
            />
            <div key={selectedDay.id} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {assignError ? (
                <div
                  role="alert"
                  data-testid="coverage-assign-error"
                  className="rounded-xl border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-[12px] font-medium text-[var(--error-text)]"
                >
                  {assignError}
                </div>
              ) : null}

              <LeadSection
                selectedDay={selectedDay}
                canEdit={canEdit}
                canUpdateAssignmentStatus={canUpdateAssignmentStatus}
                unassigningShiftId={unassigningShiftId}
                operationalDetail={
                  selectedDay.leadShift
                    ? activeOperationalDetails.get(selectedDay.leadShift.id) ?? null
                    : null
                }
                onOpenPicker={() => openPicker('lead')}
                onChangeStatus={onChangeStatus}
                onUnassign={onUnassign}
              />

              {pickerMode === 'lead' ? (
                <TherapistPicker
                  mode="lead"
                  candidates={pickerCandidates}
                  query={pickerQuery}
                  assigning={assigning}
                  onQueryChange={setPickerQuery}
                  onAssign={handleAssign}
                  onClose={closePicker}
                />
              ) : null}

              <StaffSection
                selectedDay={selectedDay}
                canEdit={canEdit}
                canUpdateAssignmentStatus={canUpdateAssignmentStatus}
                unassigningShiftId={unassigningShiftId}
                activeOperationalDetails={activeOperationalDetails}
                onOpenPicker={() => openPicker('staff')}
                onChangeStatus={onChangeStatus}
                onUnassign={onUnassign}
              />

              {pickerMode === 'staff' ? (
                <TherapistPicker
                  mode="staff"
                  candidates={pickerCandidates}
                  query={pickerQuery}
                  assigning={assigning}
                  onQueryChange={setPickerQuery}
                  onAssign={handleAssign}
                  onClose={closePicker}
                />
              ) : null}

              {selectedDay.constraintBlocked ? (
                <div className="flex items-start gap-2 rounded-xl border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-[12px] text-[var(--error-text)]">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>No eligible therapists for this shift because of current constraints.</span>
                </div>
              ) : null}

              <OperationalNotesSection
                operationalEntries={operationalEntries}
                selectedDayNotes={selectedDayNotes}
                showLotteryLink={showLotteryLink}
                lotteryHref={lotteryHref}
                lotteryLinkReason={lotteryLinkReason}
              />
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
