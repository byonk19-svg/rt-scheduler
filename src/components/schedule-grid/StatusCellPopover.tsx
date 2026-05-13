'use client'

import type { ReactNode, RefObject } from 'react'

import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { formatDisplayDate } from '@/lib/calendar-utils'
import { cn } from '@/lib/utils'

import type { GridCell, GridCellStatus } from './schedule-grid-types'

type AssignmentStatus = 'scheduled' | 'on_call' | 'cancelled' | 'call_in' | 'left_early'

const STATUS_LABELS: Array<{ value: AssignmentStatus; label: string }> = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'on_call', label: 'On call' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'call_in', label: 'Call-in' },
  { value: 'left_early', label: 'Left early' },
]

function cellStatusToAssignment(status: GridCellStatus): AssignmentStatus {
  if (status === 'on_call') return 'on_call'
  if (status === 'cancelled') return 'cancelled'
  if (status === 'call_in') return 'call_in'
  if (status === 'left_early') return 'left_early'
  return 'scheduled'
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
  onStatusChange: (status: AssignmentStatus) => Promise<void>
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
  onStatusChange,
  onUnassign,
  onDesignateLead,
  isPending,
  children,
}: StatusCellPopoverProps) {
  const virtualRef = anchorEl ? ({ current: anchorEl } as RefObject<HTMLElement>) : undefined
  const currentAssignment = cellStatusToAssignment(cell.status)

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {virtualRef ? <PopoverAnchor virtualRef={virtualRef} /> : null}
      {children}
      <PopoverContent className="w-60 p-3">
        <p className="text-sm font-semibold text-foreground">
          {therapistName} -{' '}
          {formatDisplayDate(date, { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
        {cell.hasNeedsOff ? (
          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5">
            <p className="text-xs font-medium text-amber-800">Requested this day off.</p>
          </div>
        ) : null}
        {allowStatusChange ? (
          <div className="mt-3 flex flex-col gap-1">
            {STATUS_LABELS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={cn(
                  'flex items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted',
                  currentAssignment === value &&
                    'bg-primary text-primary-foreground hover:bg-primary'
                )}
                disabled={isPending}
                onClick={() => onStatusChange(value)}
              >
                <span>{label}</span>
                {currentAssignment === value ? <span aria-hidden="true">✓</span> : null}
              </button>
            ))}
          </div>
        ) : null}
        {canUnassign || (canDesignateLead && !isCurrentlyLead) ? (
          <div className="mt-2 flex flex-col gap-1 border-t border-border pt-2">
            {canDesignateLead && !isCurrentlyLead ? (
              <button
                type="button"
                className="rounded-md px-2 py-1.5 text-left text-sm font-medium text-primary hover:bg-muted"
                disabled={isPending}
                onClick={onDesignateLead}
              >
                Designate as lead
              </button>
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
