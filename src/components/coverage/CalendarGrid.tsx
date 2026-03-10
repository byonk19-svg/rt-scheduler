'use client'

import { AlertTriangle } from 'lucide-react'

import { cn } from '@/lib/utils'
import { countActive, flatten, shouldShowMonthTag, type DayItem, type ShiftTab } from '@/lib/coverage/selectors'

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

type CalendarGridProps = {
  days: DayItem[]
  loading: boolean
  selectedId: string | null
  shiftTab: ShiftTab
  onTabSwitch: (tab: ShiftTab) => void
  onSelect: (id: string) => void
}

function formatMonthShort(value: string): string {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-US', { month: 'short' })
}

function firstName(name: string): string {
  return name.split(/\s+/).filter(Boolean)[0] ?? name
}

function chunkWeeks(days: DayItem[]): DayItem[][] {
  const weeks: DayItem[][] = []
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7))
  }
  return weeks
}

export function CalendarGrid({
  days,
  loading,
  selectedId,
  shiftTab,
  onTabSwitch,
  onSelect,
}: CalendarGridProps) {
  const weeks = chunkWeeks(days)

  return (
    <>
      <div className="mb-5">
        <div className="inline-flex overflow-hidden rounded-xl border border-border bg-card">
          {(['Day', 'Night'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onTabSwitch(tab)}
              data-testid={`coverage-shift-tab-${tab.toLowerCase()}`}
              className={cn(
                'cursor-pointer px-6 py-2.5 text-base font-semibold transition-colors',
                shiftTab === tab ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/50'
              )}
            >
              {tab} Shift
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="min-w-[980px]">
          <div className="mb-2 grid grid-cols-7 gap-3 border-y border-border/80 py-4">
            {DOW.map((day) => (
              <div key={day} className="text-center text-sm font-semibold tracking-[0.06em] text-muted-foreground">
                {day}
              </div>
            ))}
          </div>

          {loading ? (
            <div className="rounded-lg border border-border bg-card px-3 py-8 text-center text-sm text-muted-foreground">
              Loading schedule...
            </div>
          ) : (
            <div className="space-y-6">
              {weeks.map((week, weekIndex) => (
                <section key={`week-${weekIndex}`} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      WEEK {weekIndex + 1}
                    </p>
                    <div className="h-px flex-1 bg-border/90" />
                  </div>

                  <div className="grid grid-cols-7 gap-3">
                    {week.map((day, dayOffset) => {
                      const absoluteIndex = weekIndex * 7 + dayOffset
                      const activeCount = countActive(day)
                      const totalCount = flatten(day).length
                      const missingLead = !day.leadShift
                      const showMonthTag = shouldShowMonthTag(absoluteIndex, day.isoDate)

                      return (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => onSelect(day.id)}
                          data-testid={`coverage-day-cell-${day.id}`}
                          className={cn(
                            'min-h-[255px] rounded-2xl border border-border/90 bg-card p-3.5 text-left transition-colors hover:border-primary/50',
                            selectedId === day.id && 'border-primary ring-1 ring-primary/45'
                          )}
                        >
                          <div className="flex items-start justify-between">
                            <div className="inline-flex items-center gap-1.5">
                              <span className="text-[2rem] font-bold leading-none text-foreground">{day.date}</span>
                              {showMonthTag && (
                                <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                                  {formatMonthShort(day.isoDate)}
                                </span>
                              )}
                            </div>
                            <span
                              className={cn(
                                'rounded-full px-2.5 py-0.5 text-[1.35rem] font-bold',
                                missingLead
                                  ? 'bg-[var(--error-subtle)] text-[var(--error-text)]'
                                  : 'bg-[var(--success-subtle)] text-[var(--success-text)]'
                              )}
                            >
                              {activeCount}/{totalCount}
                            </span>
                          </div>

                          <div
                            className={cn(
                              'mt-2 rounded-xl border px-3 py-2',
                              day.leadShift
                                ? 'border-[#d7e1e3] bg-[#f4f8f8] text-[#246b74]'
                                : 'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
                            )}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7297a0]">
                              LEAD
                            </p>
                            <p className="mt-0.5 flex items-center gap-1.5 text-[1.55rem] font-semibold leading-tight">
                              {day.leadShift ? firstName(day.leadShift.name) : 'No lead'}
                              {day.leadShift && day.leadShift.status !== 'active' && (
                                <AlertTriangle className="h-3.5 w-3.5 text-[var(--warning-text)]" />
                              )}
                            </p>
                          </div>

                          {day.constraintBlocked && (
                            <div className="mt-2 rounded-xl border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-sm leading-tight text-[var(--error-text)]">
                              No eligible therapists (constraints)
                            </div>
                          )}

                          <div className="mt-3 space-y-2">
                            {day.staffShifts.map((shift) => (
                              <div key={shift.id} className="flex items-center gap-1.5 text-base text-muted-foreground">
                                <span className={cn(shift.status === 'cancelled' && 'line-through')}>
                                  {firstName(shift.name)}
                                </span>
                                {shift.status !== 'active' && (
                                  <AlertTriangle className="h-3.5 w-3.5 text-[var(--warning-text)]" />
                                )}
                              </div>
                            ))}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
