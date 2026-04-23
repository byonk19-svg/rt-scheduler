'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

import {
  AvailabilityCalendarGrid,
  type CalendarDayState,
} from '@/components/availability/AvailabilityCalendarGrid'
import { Button } from '@/components/ui/button'
import { formatHumanCycleRange, formatMonthLabel } from '@/lib/calendar-utils'

type AvailabilityCalendarPanelProps = {
  monthStart: string
  cycleStart: string
  cycleEnd: string
  selectedTherapistName: string
  cycleLabel: string
  dayStates?: Record<string, CalendarDayState>
  onPreviousMonth: () => void
  onNextMonth: () => void
  onToggleDate: (date: string) => void
}

export function AvailabilityCalendarPanel({
  monthStart,
  cycleStart,
  cycleEnd,
  selectedTherapistName,
  cycleLabel,
  dayStates = {},
  onPreviousMonth,
  onNextMonth,
  onToggleDate,
}: AvailabilityCalendarPanelProps) {
  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Selected therapist
          </p>
          <p className="text-sm font-semibold text-foreground">{selectedTherapistName}</p>
          <p className="text-sm text-muted-foreground">
            Current cycle: {cycleLabel || formatHumanCycleRange(cycleStart, cycleEnd)}
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3 rounded-full border border-border/70 bg-muted/15 px-2 py-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onPreviousMonth}
              aria-label="Previous month"
              className="h-11 w-11 rounded-full p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="min-w-[10rem] text-center text-[15px] font-semibold tracking-[-0.01em] text-foreground">
              {formatMonthLabel(monthStart)}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onNextMonth}
              aria-label="Next month"
              className="h-11 w-11 rounded-full p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap justify-end gap-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--success-border)]/60 bg-[var(--success-subtle)]/55 px-2 py-0.5 text-[11px] text-[var(--success-text)]">
              <span className="h-2 w-2 rounded-full bg-[var(--success-text)]" />
              Will work
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--error-border)]/60 bg-[var(--error-subtle)]/55 px-2 py-0.5 text-[11px] text-[var(--error-text)]">
              <span className="h-2 w-2 rounded-full bg-[var(--error-text)]" />
              Cannot work
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--warning-border)]/60 bg-[var(--warning-subtle)]/55 px-2 py-0.5 text-[11px] text-[var(--warning-text)]">
              <span className="h-2 w-2 rounded-full bg-[var(--warning-text)]" />
              Need off request
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--info-border)]/60 bg-[var(--info-subtle)]/55 px-2 py-0.5 text-[11px] text-[var(--info-text)]">
              <span className="h-2 w-2 rounded-full bg-[var(--info-text)]" />
              Request to work
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/90 px-2 py-0.5 text-[11px]">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Saved plan
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--warning-text)]">
              <span className="rounded-full bg-[var(--warning-text)] px-1 py-[1px] text-[9px] leading-none text-white">
                X
              </span>
              Weekly default
            </span>
          </div>
        </div>
      </div>

      <AvailabilityCalendarGrid
        monthStart={monthStart}
        cycleStart={cycleStart}
        cycleEnd={cycleEnd}
        dayStates={dayStates}
        onToggleDate={onToggleDate}
      />
    </section>
  )
}
