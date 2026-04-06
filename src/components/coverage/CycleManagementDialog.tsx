'use client'

import { useState } from 'react'
import { CalendarPlus, Copy, Trash2 } from 'lucide-react'

import { FormSubmitButton } from '@/components/form-submit-button'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { addDays, toIsoDate } from '@/lib/calendar-utils'
import type { Cycle } from '@/app/schedule/types'

function formatShortLabel(value: string): string {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function buildCycleDraft(latestCycleEndDate: string | null, fallbackStartDate: string) {
  const parsedLatest = latestCycleEndDate ? new Date(`${latestCycleEndDate}T00:00:00`) : null
  const parsedFallback = new Date(`${fallbackStartDate}T00:00:00`)
  const start =
    parsedLatest && !Number.isNaN(parsedLatest.getTime())
      ? addDays(parsedLatest, 1)
      : Number.isNaN(parsedFallback.getTime())
        ? new Date()
        : parsedFallback
  const end = addDays(start, 41)
  const startDate = toIsoDate(start)
  const endDate = toIsoDate(end)

  return {
    label: `${formatShortLabel(startDate)} - ${formatShortLabel(endDate)}`,
    startDate,
    endDate,
  }
}

type CycleManagementDialogProps = {
  cycles: Cycle[]
  open: boolean
  onOpenChange: (open: boolean) => void
  createCycleAction: (formData: FormData) => void | Promise<void>
  deleteCycleAction: (formData: FormData) => void | Promise<void>
}

export function CycleManagementDialog({
  cycles,
  open,
  onOpenChange,
  createCycleAction,
  deleteCycleAction,
}: CycleManagementDialogProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const latestCycle = [...cycles].sort((a, b) => b.end_date.localeCompare(a.end_date))[0] ?? null
  const defaultDraft = buildCycleDraft(latestCycle?.end_date ?? null, toIsoDate(new Date()))
  const [label, setLabel] = useState(defaultDraft.label)
  const [startDate, setStartDate] = useState(defaultDraft.startDate)
  const [endDate, setEndDate] = useState(defaultDraft.endDate)

  function handleStartDateChange(nextStartDate: string) {
    setStartDate(nextStartDate)
    const draft = buildCycleDraft(null, nextStartDate)
    setEndDate(draft.endDate)
    setLabel(draft.label)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[34rem] border-border/80 bg-card shadow-[0_30px_80px_-28px_rgba(15,23,42,0.45)]">
        <DialogHeader className="text-left">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--info-border)] bg-[var(--info-subtle)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--info-text)]">
            <CalendarPlus className="h-3.5 w-3.5" />
            Cycle setup
          </div>
          <DialogTitle className="font-heading text-[1.45rem] font-bold tracking-[-0.04em] text-foreground">
            New 6-week block
          </DialogTitle>
          <DialogDescription className="max-w-[30rem] text-sm leading-relaxed text-muted-foreground">
            Create the next schedule block as a draft, then staff it in Coverage before sending
            preliminary or publishing.
          </DialogDescription>
        </DialogHeader>

        <form action={createCycleAction} className="space-y-4">
          <input type="hidden" name="view" value="week" />

          <div className="rounded-[20px] border border-border/80 bg-muted/15 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Suggested range
            </p>
            <p className="mt-2 text-sm font-medium leading-relaxed text-foreground">
              {latestCycle
                ? `Starts right after ${latestCycle.label} ends on ${formatShortLabel(latestCycle.end_date)}.`
                : 'Starts from the next available date and spans 42 days.'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="coverage-cycle-label">Label</Label>
            <Input
              id="coverage-cycle-label"
              name="label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Apr 6 - May 17"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="coverage-cycle-start-date">Start date</Label>
              <Input
                id="coverage-cycle-start-date"
                name="start_date"
                type="date"
                value={startDate}
                onChange={(event) => handleStartDateChange(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coverage-cycle-end-date">End date</Label>
              <Input
                id="coverage-cycle-end-date"
                name="end_date"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                required
              />
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-[18px] border border-border/80 bg-card px-4 py-3 text-sm text-muted-foreground">
            <input
              type="checkbox"
              name="copy_from_last_cycle"
              className="mt-1 h-4 w-4 rounded border-border"
            />
            <span>
              <span className="flex items-center gap-2 font-medium text-foreground">
                <Copy className="h-3.5 w-3.5 text-primary" />
                Copy staffing from the last published cycle
              </span>
              <span className="mt-1 block text-xs">
                Imported cycles stay in draft and skip inactive or FMLA staff automatically.
              </span>
            </span>
          </label>

          <DialogFooter className="border-t border-border/70 pt-4">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <FormSubmitButton size="sm" pendingText="Creating..." className="gap-1.5">
              <CalendarPlus className="h-3.5 w-3.5" />
              Create draft block
            </FormSubmitButton>
          </DialogFooter>
        </form>

        {cycles.length > 0 && (
          <div className="border-t border-border/70 pt-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Existing cycles
            </p>
            <ul className="space-y-1.5">
              {[...cycles].sort((a, b) => b.start_date.localeCompare(a.start_date)).map((cycle) => (
                <li key={cycle.id} className="flex items-center gap-2">
                  <span className="flex-1 truncate text-sm text-foreground">{cycle.label}</span>
                  {cycle.published ? (
                    <span className="shrink-0 rounded-full border border-[var(--success-border)] bg-[var(--success-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--success-text)]">
                      Live
                    </span>
                  ) : confirmDeleteId === cycle.id ? (
                    <form action={deleteCycleAction} className="flex items-center gap-1.5">
                      <input type="hidden" name="cycle_id" value={cycle.id} />
                      <span className="text-xs text-muted-foreground">Delete?</span>
                      <FormSubmitButton
                        size="sm"
                        variant="destructive"
                        pendingText="Deleting..."
                        className="h-6 px-2 text-[10px]"
                      >
                        Confirm
                      </FormSubmitButton>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Cancel
                      </Button>
                    </form>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setConfirmDeleteId(cycle.id)}
                      aria-label={`Delete ${cycle.label}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
