'use client'

import type { RefObject } from 'react'
import { Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function shouldAllowSubmit(cycleId: string, isPublished: boolean): boolean {
  return cycleId.length > 0 && !isPublished
}

type AutoDraftConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  applyFormRef: RefObject<HTMLFormElement | null>
}

export function AutoDraftConfirmDialog({
  open,
  onOpenChange,
  applyFormRef,
}: AutoDraftConfirmDialogProps) {
  function handleApply() {
    applyFormRef.current?.requestSubmit()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Auto-Draft Schedule
          </DialogTitle>
          <DialogDescription>
            Generate a draft that respects therapist availability, patterns, and scheduling
            rules. This replaces all current unfinalized assignments.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
          <p className="text-sm font-medium text-foreground">How it works</p>
          <p>- Hard force-off and FMLA blocks are never violated</p>
          <p>- Manager and therapist force-on dates are prioritized</p>
          <p>- Shifts are distributed to meet coverage targets (3-5 per slot)</p>
          <p>- PRN therapists are only scheduled on explicit force-on dates</p>
          <p>- Any forced-date misses are reported back after drafting</p>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleApply} className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Apply Draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
