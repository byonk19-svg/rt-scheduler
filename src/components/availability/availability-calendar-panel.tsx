'use client'

import {
  buildCalendarWeeks,
  formatDateLabel,
  formatHumanCycleRange,
  toIsoDate,
} from '@/lib/calendar-utils'
import { cn } from '@/lib/utils'

type CalendarDayState = {
  draftSelection?: 'will_work' | 'cannot_work' | 'need_off' | 'request_to_work'
  savedPlanner?: 'will_work' | 'cannot_work'
  requestTypes?: Array<'need_off' | 'request_to_work'>
}

type AvailabilityCalendarPanelProps = {
  cycleStart: string
  cycleEnd: string
  dayStates?: Record<string, CalendarDayState>
  onToggleDate: (date: string) => void
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

const CHIP_STYLES = {
  saved: 'border-border/70 bg-background/90 text-foreground',
  will_work:
    'border-[var(--success-border)]/80 bg-[var(--success-subtle)]/65 text-[var(--success-text)]',
  cannot_work:
    'border-[var(--error-border)]/80 bg-[var(--error-subtle)]/65 text-[var(--error-text)]',
  need_off:
    'border-[var(--warning-border)]/80 bg-[var(--warning-subtle)]/65 text-[var(--warning-text)]',
  request_to_work:
    'border-[var(--info-border)]/80 bg-[var(--info-subtle)]/65 text-[var(--info-text)]',
} as const

function renderStateChip(type: keyof typeof CHIP_STYLES, label: string, title?: string) {
  return (
    <span
      key={`${type}-${label}`}
      title={title ?? label}
      className={cn(
        'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none',
        CHIP_STYLES[type]
      )}
    >
      {label}
    </span>
  )
}

export function AvailabilityCalendarPanel({
  cycleStart,
  cycleEnd,
  dayStates = {},
  onToggleDate,
}: AvailabilityCalendarPanelProps) {
  const calendarWeeks = buildCalendarWeeks(cycleStart, cycleEnd)

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {formatHumanCycleRange(cycleStart, cycleEnd)}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Unmarked days are baseline. Colored markers show therapist requests, manager plan dates,
            and unsaved draft changes.
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-1 text-xs text-muted-foreground">
          {renderStateChip('saved', 'Planning assumption')}
          {renderStateChip('will_work', 'Need to work')}
          {renderStateChip('need_off', 'Need off')}
          {renderStateChip('cannot_work', 'Blocked')}
          {renderStateChip('request_to_work', 'Therapist request')}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {WEEKDAYS.map((day) => (
            <p
              key={day}
              className="px-1 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:text-[11px]"
            >
              <span className="sm:hidden">{day.slice(0, 2)}</span>
              <span className="hidden sm:inline">{day}</span>
            </p>
          ))}
        </div>

        <div className="space-y-1.5">
          {calendarWeeks.map((week, weekIndex) => (
            <div key={`availability-week-${weekIndex}`} className="grid grid-cols-7 gap-1 sm:gap-2">
              {week.map((day) => {
                const dayKey = toIsoDate(day)
                const isInCycle = dayKey >= cycleStart && dayKey <= cycleEnd
                const state = dayStates[dayKey] ?? {}
                const chips = []

                if (state.savedPlanner)
                  chips.push(renderStateChip('saved', 'Plan', 'Planning assumption'))
                if (state.requestTypes?.includes('need_off'))
                  chips.push(renderStateChip('need_off', 'Off', 'Therapist Need Off request'))
                if (state.requestTypes?.includes('request_to_work')) {
                  chips.push(
                    renderStateChip('request_to_work', 'Req', 'Therapist Need to Work request')
                  )
                }
                if (state.draftSelection === 'will_work')
                  chips.push(renderStateChip('will_work', 'Work', 'Draft Need to Work'))
                if (state.draftSelection === 'cannot_work') {
                  chips.push(
                    renderStateChip('cannot_work', 'Block', 'Draft blocked or unavailable')
                  )
                }
                if (state.draftSelection === 'need_off')
                  chips.push(renderStateChip('need_off', 'Off', 'Draft Need Off'))
                if (state.draftSelection === 'request_to_work') {
                  chips.push(
                    renderStateChip('request_to_work', 'Req', 'Draft Need to Work request')
                  )
                }

                return (
                  <button
                    key={dayKey}
                    type="button"
                    aria-label={formatDateLabel(dayKey)}
                    data-in-cycle={isInCycle}
                    data-status={
                      state.draftSelection ??
                      state.savedPlanner ??
                      state.requestTypes?.join('-') ??
                      'idle'
                    }
                    disabled={!isInCycle}
                    onClick={() => onToggleDate(dayKey)}
                    className={cn(
                      'flex min-h-[4.5rem] flex-col rounded-[0.95rem] border p-1.5 text-left transition sm:min-h-[5.15rem] sm:p-2',
                      !isInCycle &&
                        'cursor-not-allowed border-border/30 bg-muted/10 text-muted-foreground/45',
                      isInCycle &&
                        !state.draftSelection &&
                        'border-border/60 bg-background/85 hover:border-border hover:bg-muted/20',
                      state.draftSelection === 'will_work' &&
                        'border-primary bg-primary/[0.08] ring-1 ring-primary/15',
                      state.draftSelection === 'cannot_work' &&
                        'border-[var(--error-border)] bg-[var(--error-subtle)]/35',
                      state.draftSelection === 'need_off' &&
                        'border-[var(--warning-border)] bg-[var(--warning-subtle)]/35',
                      state.draftSelection === 'request_to_work' &&
                        'border-[var(--info-border)] bg-[var(--info-subtle)]/35'
                    )}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-xs font-semibold text-foreground sm:text-sm">
                        {day.getDate()}
                      </span>
                      {state.savedPlanner ? (
                        <span
                          className={cn(
                            'mt-0.5 h-2 w-2 rounded-full',
                            state.savedPlanner === 'will_work'
                              ? 'bg-[var(--success-text)]'
                              : 'bg-[var(--error-text)]'
                          )}
                        />
                      ) : null}
                    </div>

                    <div className="mt-1.5 flex flex-wrap gap-1">{chips.slice(0, 2)}</div>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
