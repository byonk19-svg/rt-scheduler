'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  buildCalendarWeeks,
  formatDateLabel,
  formatHumanCycleRange,
  formatMonthLabel,
  toIsoDate,
  toMonthEndKey,
} from '@/lib/calendar-utils'
import { cn } from '@/lib/utils'

type CalendarDayState = {
  draftSelection?: 'will_work' | 'cannot_work'
  savedPlanner?: 'will_work' | 'cannot_work'
  requestTypes?: Array<'need_off' | 'request_to_work'>
}

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

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

function requestDotClass(type: 'need_off' | 'request_to_work') {
  return type === 'need_off' ? 'bg-[var(--warning-text)]' : 'bg-[var(--info-text)]'
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
  const calendarWeeks = buildCalendarWeeks(monthStart, toMonthEndKey(monthStart))
  const monthKey = monthStart.slice(0, 7)

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
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((day) => (
          <p key={day} className="text-center text-[11px] font-medium text-muted-foreground">
            {day.slice(0, 2)}
          </p>
        ))}
      </div>

      <div className="space-y-1">
        {calendarWeeks.map((week, weekIndex) => (
          <div key={`availability-week-${weekIndex}`} className="grid grid-cols-7 gap-1">
            {week.map((day) => {
              const dayKey = toIsoDate(day)
              const isCurrentMonth = dayKey.slice(0, 7) === monthKey
              const isInCycle = dayKey >= cycleStart && dayKey <= cycleEnd
              const state = dayStates[dayKey] ?? {}
              const requestTypes = state.requestTypes ?? []
              const hasSavedPlanner = Boolean(state.savedPlanner)

              return (
                <button
                  key={dayKey}
                  type="button"
                  aria-label={formatDateLabel(dayKey)}
                  data-in-cycle={isInCycle}
                  data-status={
                    state.draftSelection ??
                    state.savedPlanner ??
                    (requestTypes.length > 0 ? requestTypes.join('-') : 'idle')
                  }
                  disabled={!isInCycle}
                  onClick={() => onToggleDate(dayKey)}
                  className={cn(
                    'relative flex h-12 flex-col items-center justify-center rounded-lg border border-transparent text-sm transition-all',
                    !isCurrentMonth && 'text-muted-foreground/70',
                    !isInCycle &&
                      'cursor-not-allowed border-border/30 text-muted-foreground/40 opacity-45',
                    isInCycle &&
                      !state.draftSelection &&
                      !state.savedPlanner &&
                      'bg-background/75 text-foreground hover:border-border/60 hover:bg-muted/30',
                    state.savedPlanner === 'will_work' &&
                      'border-[var(--success-border)]/80 bg-[var(--success-subtle)]/45 text-[var(--success-text)]',
                    state.savedPlanner === 'cannot_work' &&
                      'border-[var(--error-border)]/80 bg-[var(--error-subtle)]/45 text-[var(--error-text)]',
                    state.draftSelection === 'will_work' &&
                      'border-primary bg-primary text-primary-foreground shadow-tw-inset-highlight-soft',
                    state.draftSelection === 'cannot_work' &&
                      'border-[var(--error-text)] bg-[var(--error-text)] text-primary-foreground shadow-tw-inset-highlight-soft',
                    hasSavedPlanner && !state.draftSelection && 'ring-1 ring-primary/8'
                  )}
                >
                  <span className="font-medium">{day.getDate()}</span>
                  {requestTypes.length > 0 ? (
                    <span className="absolute bottom-1.5 flex items-center gap-1">
                      {requestTypes.slice(0, 2).map((type) => (
                        <span
                          key={`${dayKey}-${type}`}
                          className={cn('h-1.5 w-1.5 rounded-full', requestDotClass(type))}
                        />
                      ))}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </section>
  )
}
