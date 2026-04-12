'use client'

import type { RefObject } from 'react'
import { Eraser } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function canClearDraft(cycleId: string, isPublished: boolean) {
  return cycleId.length > 0 && !isPublished
}

type ClearDraftConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  applyFormRef: RefObject<HTMLFormElement | null>
  cycleId: string
  cycleLabel: string | null
  isPublished: boolean
}

export function ClearDraftConfirmDialog({
  open,
  onOpenChange,
  applyFormRef,
  cycleId,
  cycleLabel,
  isPublished,
}: ClearDraftConfirmDialogProps) {
  const canSubmit = canClearDraft(cycleId, isPublished)

  function handleApply() {
    if (!canSubmit) return
    applyFormRef.current?.requestSubmit()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[32rem] border-border/80 bg-card shadow-tw-modal">
        <DialogHeader className="text-left">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--error-text)]">
            <Eraser className="h-3.5 w-3.5" />
            Draft reset
          </div>
          <DialogTitle className="font-heading text-[1.4rem] font-bold tracking-[-0.04em] text-foreground">
            Clear current draft
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            Remove all draft assignments for {cycleLabel ?? 'this cycle'} and return to an empty
            staffing slate.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-[20px] border border-[var(--warning-border)] bg-[var(--warning-subtle)]/70 p-4 text-sm leading-relaxed text-foreground">
          Published schedules stay protected. This action is only available while the cycle is
          still a draft.
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={!canSubmit}
            onClick={handleApply}
            className="gap-1.5"
          >
            <Eraser className="h-3.5 w-3.5" />
            Clear draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
