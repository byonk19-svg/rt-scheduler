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
  cycleId: string
  isPublished: boolean
}

export function AutoDraftConfirmDialog({
  open,
  onOpenChange,
  applyFormRef,
  cycleId,
  isPublished,
}: AutoDraftConfirmDialogProps) {
  const canSubmit = shouldAllowSubmit(cycleId, isPublished)

  function handleApply() {
    if (!canSubmit) return
    applyFormRef.current?.requestSubmit()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[34rem] overflow-hidden border-border/80 bg-card p-0 shadow-[0_32px_80px_-28px_rgba(15,23,42,0.45)]">
        <div className="teamwise-grid-bg-subtle teamwise-aurora-bg border-b border-border/70 px-5 py-4 sm:px-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--info-border)] bg-[var(--info-subtle)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--info-text)]">
            <Sparkles className="h-3.5 w-3.5" />
            Draft control
          </div>
          <DialogHeader className="mt-3 text-left">
            <DialogTitle className="font-heading text-[1.45rem] font-bold tracking-[-0.04em] text-foreground">
              Auto-Draft Schedule
            </DialogTitle>
            <DialogDescription className="max-w-[30rem] text-sm leading-relaxed text-muted-foreground">
              Builds a full schedule draft using availability, recurring patterns, and scheduling
              rules. Draft assignments are replaced — published schedules stay protected.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-5 py-5 sm:px-6">
          <div className="rounded-[20px] border border-[var(--warning-border)] bg-[var(--warning-subtle)]/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--warning-text)]">
              High-impact action
            </p>
            <p className="mt-2 text-sm font-medium leading-relaxed text-foreground">
              The draft engine rebuilds the current cycle&apos;s open schedule in one pass. Use
              it when you want a fresh staffing baseline before manual adjustments.
            </p>
          </div>

          <div className="rounded-[22px] border border-border/80 bg-card/90 p-4 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Autodraft ruleset
            </p>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {[
                'Hard force-off and FMLA blocks are never violated',
                'Manager and therapist force-on dates are prioritized',
                'Shifts are distributed to meet coverage targets (3-5 per slot)',
                'PRN therapists are only scheduled on explicit force-on dates',
                'Any forced-date misses are reported back after drafting',
              ].map((rule) => (
                <div
                  key={rule}
                  className="flex items-start gap-2 rounded-2xl border border-border/70 bg-muted/15 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground"
                >
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{rule}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border/70 bg-muted/15 px-5 py-4 sm:px-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="min-w-[7rem]"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleApply}
            disabled={!canSubmit}
            className="min-w-[8.5rem] gap-1.5 shadow-[0_10px_24px_-14px_rgba(6,103,169,0.55)]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generate draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
