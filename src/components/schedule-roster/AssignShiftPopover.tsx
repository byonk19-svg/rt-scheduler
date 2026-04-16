'use client'

import { type ReactElement, useEffect, useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { formatLongDate, type Assignment, type ShiftType } from '@/lib/mock-coverage-roster'

type AssignShiftPopoverProps = {
  trigger: ReactElement
  open: boolean
  onOpenChange: (open: boolean) => void
  staffName: string
  isoDate: string
  shiftType: ShiftType
  assignment: Assignment | null
  onConfirm: () => void
  onUnassign: () => void
}

function AssignShiftContent({
  staffName,
  isoDate,
  shiftType,
  assignment,
  onConfirm,
  onUnassign,
  onCancel,
}: {
  staffName: string
  isoDate: string
  shiftType: ShiftType
  assignment: Assignment | null
  onConfirm: () => void
  onUnassign: () => void
  onCancel: () => void
}) {
  const isAssigned = assignment != null

  return (
    <div className="space-y-4">
      <div className="space-y-3 text-sm">
        <div className="rounded-2xl border border-border/80 bg-muted/35 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Staff
          </p>
          <p className="mt-1 font-medium text-foreground">{staffName}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/80 bg-muted/35 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Date
            </p>
            <p className="mt-1 font-medium text-foreground">{formatLongDate(isoDate)}</p>
          </div>
          <div className="rounded-2xl border border-border/80 bg-muted/35 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Shift type
            </p>
            <p className="mt-1 font-medium capitalize text-foreground">{shiftType} shift</p>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        {isAssigned ? (
          <Button type="button" size="sm" variant="outline" onClick={onUnassign}>
            Unassign
          </Button>
        ) : null}
        {!isAssigned ? (
          <Button type="button" size="sm" onClick={onConfirm}>
            Confirm
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export function AssignShiftPopover({
  trigger,
  open,
  onOpenChange,
  staffName,
  isoDate,
  shiftType,
  assignment,
  onConfirm,
  onUnassign,
}: AssignShiftPopoverProps) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(media.matches)

    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  if (isMobile) {
    return (
      <>
        <span
          className="contents"
          onClick={() => onOpenChange(true)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onOpenChange(true)
            }
          }}
        >
          {trigger}
        </span>
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="max-w-md rounded-3xl p-0">
            <div className="p-6">
              <DialogHeader>
                <DialogTitle>Assign shift</DialogTitle>
                <DialogDescription>
                  Review the assignment details before saving this mock roster change.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4">
                <AssignShiftContent
                  staffName={staffName}
                  isoDate={isoDate}
                  shiftType={shiftType}
                  assignment={assignment}
                  onConfirm={() => {
                    onConfirm()
                    onOpenChange(false)
                  }}
                  onUnassign={() => {
                    onUnassign()
                    onOpenChange(false)
                  }}
                  onCancel={() => onOpenChange(false)}
                />
              </div>
            </div>
            <DialogFooter className="sr-only" />
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="center" side="bottom" className="w-[320px] rounded-3xl p-5">
        <div className="space-y-1 pb-3">
          <h3 className="text-base font-semibold tracking-[-0.03em] text-foreground">
            Assign shift
          </h3>
          <p className="text-sm text-muted-foreground">
            Review the assignment details before saving this mock roster change.
          </p>
        </div>
        <AssignShiftContent
          staffName={staffName}
          isoDate={isoDate}
          shiftType={shiftType}
          assignment={assignment}
          onConfirm={() => {
            onConfirm()
            onOpenChange(false)
          }}
          onUnassign={() => {
            onUnassign()
            onOpenChange(false)
          }}
          onCancel={() => onOpenChange(false)}
        />
      </PopoverContent>
    </Popover>
  )
}
