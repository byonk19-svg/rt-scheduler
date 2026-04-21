'use client'

import { buildCalendarWeeks, formatDateLabel, toIsoDate, toMonthEndKey } from '@/lib/calendar-utils'
import { cn } from '@/lib/utils'

export type CalendarDayState = {
  draftSelection?: 'will_work' | 'cannot_work'
  savedPlanner?: 'will_work' | 'cannot_work'
  savedPlannerKind?: 'explicit' | 'weekly_default'
  savedPlannerBadge?: 'Work' | 'Never'
  requestTypes?: Array<'need_off' | 'request_to_work'>
}

type AvailabilityCalendarGridProps = {
  monthStart: string
  cycleStart: string
  cycleEnd: string
  dayStates?: Record<string, CalendarDayState>
  onToggleDate: (date: string) => void
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

function requestDotClass(type: 'need_off' | 'request_to_work') {
  return type === 'need_off' ? 'bg-[var(--warning-text)]' : 'bg-[var(--info-text)]'
}

export function AvailabilityCalendarGrid({
  monthStart,
  cycleStart,
  cycleEnd,
  dayStates = {},
  onToggleDate,
}: AvailabilityCalendarGridProps) {
  const calendarWeeks = buildCalendarWeeks(monthStart, toMonthEndKey(monthStart))
  const monthKey = monthStart.slice(0, 7)

  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <div className="min-w-[21rem] space-y-1">
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
                const isWeeklyDefault = state.savedPlannerKind === 'weekly_default'

                return (
                  <button
                    key={dayKey}
                    type="button"
                    aria-label={formatDateLabel(dayKey)}
                    data-in-cycle={isInCycle}
                    data-saved-kind={state.savedPlannerKind ?? 'none'}
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
                        (isWeeklyDefault
                          ? 'border-[var(--success-border)] bg-[var(--success-subtle)] text-[var(--success-text)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--success-text)_20%,transparent)]'
                          : 'border-[var(--success-border)]/80 bg-[var(--success-subtle)]/45 text-[var(--success-text)]'),
                      state.savedPlanner === 'cannot_work' &&
                        (isWeeklyDefault
                          ? 'border-[var(--error-border)] bg-[var(--error-subtle)] text-[var(--error-text)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--error-text)_18%,transparent)]'
                          : 'border-[var(--error-border)]/80 bg-[var(--error-subtle)]/45 text-[var(--error-text)]'),
                      state.draftSelection === 'will_work' &&
                        'border-primary bg-primary text-primary-foreground shadow-tw-inset-highlight-soft',
                      state.draftSelection === 'cannot_work' &&
                        'border-[var(--error-text)] bg-[var(--error-text)] text-primary-foreground shadow-tw-inset-highlight-soft',
                      hasSavedPlanner && !state.draftSelection && 'ring-1 ring-primary/8'
                    )}
                  >
                    {isWeeklyDefault && state.savedPlannerBadge ? (
                      <span
                        className={cn(
                          'absolute left-1 top-1 rounded-full px-1.5 py-[1px] text-[8px] font-bold leading-none',
                          state.savedPlanner === 'cannot_work'
                            ? 'bg-[var(--error-text)] text-white'
                            : 'bg-[var(--success-text)] text-white'
                        )}
                      >
                        {state.savedPlannerBadge}
                      </span>
                    ) : null}
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
      </div>
    </div>
  )
}
