'use client'

import { useId, useState } from 'react'
import type { ReactNode, RefObject } from 'react'

import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { formatDisplayDate } from '@/lib/calendar-utils'
import {
  toScheduleGridAssignmentStatus,
  type ScheduleGridAssignmentStatus,
} from '@/lib/schedule/schedule-status-model'
import { cn } from '@/lib/utils'

import type { GridCell } from './schedule-grid-types'

const STATUS_LABELS: Array<{ value: ScheduleGridAssignmentStatus; label: string }> = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'on_call', label: 'On call' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'call_in', label: 'Call-in' },
  { value: 'left_early', label: 'Left early' },
]

type AssignmentStatusChange = {
  note?: string | null
  leftEarlyTime?: string | null
}

export function normalizeLeftEarlyTime(value: string): string | null {
  const trimmed = value.trim()
  if (/^\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed
  return null
}

export function getStatusConfirmationCopy(
  status: ScheduleGridAssignmentStatus,
  therapistName: string
) {
  switch (status) {
    case 'scheduled':
      return {
        title: 'Return to Scheduled?',
        body: `This clears the operational status for ${therapistName}. If this shift had an open call-in alert, it will be closed.`,
        confirmLabel: 'Set Scheduled',
        requiresTime: false,
      }
    case 'on_call':
      return {
        title: 'Mark On Call?',
        body: `${therapistName} will remain attached to this shift as on-call coverage.`,
        confirmLabel: 'Mark On Call',
        requiresTime: false,
      }
    case 'cancelled':
      return {
        title: 'Mark Cancelled?',
        body: `${therapistName} will be shown as cancelled for this shift. This changes coverage for the published schedule.`,
        confirmLabel: 'Mark Cancelled',
        requiresTime: false,
      }
    case 'call_in':
      return {
        title: 'Create Call-In Alert?',
        body: `${therapistName} will be marked call-in. Eligible staff will see a help-needed coverage alert for this shift.`,
        confirmLabel: 'Mark Call-In',
        requiresTime: false,
      }
    case 'left_early':
      return {
        title: 'Mark Left Early?',
        body: `Enter the time ${therapistName} left. This records an informational status without sending a new shift-change notice to the therapist.`,
        confirmLabel: 'Mark Left Early',
        requiresTime: true,
      }
  }
}

type StatusCellPopoverProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  anchorEl: HTMLElement | null
  therapistName: string
  date: string
  cell: GridCell
  allowStatusChange: boolean
  canUnassign: boolean
  canDesignateLead: boolean
  isCurrentlyLead: boolean
  isLeadEligible?: boolean
  onStatusChange: (
    status: ScheduleGridAssignmentStatus,
    change?: AssignmentStatusChange
  ) => Promise<void>
  onUnassign: () => Promise<void>
  onDesignateLead: () => Promise<void>
  isPending: boolean
  children?: ReactNode
}

export function StatusCellPopover({
  open,
  onOpenChange,
  anchorEl,
  therapistName,
  date,
  cell,
  allowStatusChange,
  canUnassign,
  canDesignateLead,
  isCurrentlyLead,
  isLeadEligible,
  onStatusChange,
  onUnassign,
  onDesignateLead,
  isPending,
  children,
}: StatusCellPopoverProps) {
  const virtualRef = anchorEl ? ({ current: anchorEl } as RefObject<HTMLElement>) : undefined
  const titleId = useId()
  const currentAssignment = toScheduleGridAssignmentStatus(cell.status)
  const [pendingStatus, setPendingStatus] = useState<ScheduleGridAssignmentStatus | null>(null)
  const [leftEarlyTime, setLeftEarlyTime] = useState('')
  const [note, setNote] = useState('')
  const pendingCopy = pendingStatus ? getStatusConfirmationCopy(pendingStatus, therapistName) : null
  const normalizedLeftEarlyTime =
    pendingStatus === 'left_early' ? normalizeLeftEarlyTime(leftEarlyTime) : null
  const canConfirmStatus =
    Boolean(pendingStatus) &&
    !isPending &&
    (!pendingCopy?.requiresTime || Boolean(normalizedLeftEarlyTime))
  const showLeadControl = canDesignateLead && !isCurrentlyLead
  const canUseLeadControl = showLeadControl && isLeadEligible !== false

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {virtualRef ? <PopoverAnchor virtualRef={virtualRef} /> : null}
      {children}
      <PopoverContent role="dialog" aria-labelledby={titleId} className="w-64 p-3">
        <p id={titleId} className="text-sm font-semibold text-foreground">
          {therapistName} -{' '}
          {formatDisplayDate(date, { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
        {cell.hasNeedsOff ? (
          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5">
            <p className="text-xs font-medium text-amber-800">Need Off is marked for this date.</p>
          </div>
        ) : null}
        {allowStatusChange ? (
          <div className="mt-3 flex flex-col gap-1">
            {STATUS_LABELS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={cn(
                  'flex items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60',
                  currentAssignment === value &&
                    'bg-primary text-primary-foreground hover:bg-primary'
                )}
                disabled={isPending || currentAssignment === value}
                onClick={() => {
                  setPendingStatus(value)
                  setLeftEarlyTime('')
                  setNote('')
                }}
              >
                <span>{label}</span>
                {currentAssignment === value ? <span className="text-xs">Current</span> : null}
              </button>
            ))}
          </div>
        ) : null}
        {pendingCopy ? (
          <div className="mt-3 rounded-md border border-border bg-muted/50 p-2">
            <p className="text-xs font-semibold text-foreground">{pendingCopy.title}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{pendingCopy.body}</p>
            {pendingCopy.requiresTime ? (
              <label className="mt-2 block text-xs font-medium text-foreground">
                Left at
                <input
                  type="time"
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={leftEarlyTime}
                  onChange={(event) => setLeftEarlyTime(event.target.value)}
                  disabled={isPending}
                  required
                />
              </label>
            ) : null}
            <label className="mt-2 block text-xs font-medium text-foreground">
              Note
              <input
                type="text"
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                disabled={isPending}
                placeholder="Optional"
              />
            </label>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="rounded-md bg-primary px-2 py-1.5 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canConfirmStatus}
                onClick={async () => {
                  if (!pendingStatus || !canConfirmStatus) return
                  await onStatusChange(pendingStatus, {
                    leftEarlyTime: pendingStatus === 'left_early' ? normalizedLeftEarlyTime : null,
                    note: note.trim() || null,
                  })
                  setPendingStatus(null)
                }}
              >
                {pendingCopy.confirmLabel}
              </button>
              <button
                type="button"
                className="rounded-md border border-border px-2 py-1.5 text-xs font-semibold text-foreground"
                disabled={isPending}
                onClick={() => setPendingStatus(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : allowStatusChange ? (
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Choose a status, then confirm before the schedule is changed.
          </p>
        ) : null}
        {canUnassign || showLeadControl ? (
          <div className="mt-2 flex flex-col gap-1 border-t border-border pt-2">
            {showLeadControl ? (
              <>
                {isLeadEligible === false ? (
                  <p className="rounded-md bg-muted px-2 py-1.5 text-xs leading-5 text-muted-foreground">
                    Not lead eligible. Update Team before designating this therapist as lead.
                  </p>
                ) : isLeadEligible === true ? (
                  <p className="px-2 pt-1 text-xs font-medium text-muted-foreground">
                    Lead eligible
                  </p>
                ) : null}
                {canUseLeadControl ? (
                  <button
                    type="button"
                    className="rounded-md px-2 py-1.5 text-left text-sm font-medium text-primary hover:bg-muted"
                    disabled={isPending}
                    onClick={onDesignateLead}
                  >
                    Designate as lead
                  </button>
                ) : null}
              </>
            ) : null}
            {canUnassign ? (
              <button
                type="button"
                className="rounded-md px-2 py-1.5 text-left text-sm font-medium text-destructive hover:bg-red-50"
                disabled={isPending}
                onClick={onUnassign}
              >
                Unassign
              </button>
            ) : null}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
