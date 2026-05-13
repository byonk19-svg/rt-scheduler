'use client'

import type { RefObject, ReactNode } from 'react'

import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { formatDisplayDate } from '@/lib/calendar-utils'

import type { GridCell } from './schedule-grid-types'

type AssignCellPopoverProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  anchorEl: HTMLElement | null
  therapistName: string
  date: string
  cell: GridCell
  onAssign: () => Promise<void>
  isPending: boolean
  children?: ReactNode
}

export function AssignCellPopover({
  open,
  onOpenChange,
  anchorEl,
  therapistName,
  date,
  cell,
  onAssign,
  isPending,
  children,
}: AssignCellPopoverProps) {
  const virtualRef = anchorEl ? ({ current: anchorEl } as RefObject<HTMLElement>) : undefined

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {virtualRef ? <PopoverAnchor virtualRef={virtualRef} /> : null}
      {children}
      <PopoverContent className="w-60 p-3">
        <p className="text-sm font-semibold text-foreground">
          {therapistName} -{' '}
          {formatDisplayDate(date, { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Assign this therapist to the selected shift?
        </p>
        {cell.hasNeedsOff ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5">
            <p className="text-xs font-medium text-amber-800">Requested this day off.</p>
          </div>
        ) : null}
        <div className="mt-3 flex flex-col gap-1.5">
          <Button size="sm" onClick={onAssign} disabled={isPending}>
            {cell.hasNeedsOff ? 'Assign anyway' : 'Assign'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
