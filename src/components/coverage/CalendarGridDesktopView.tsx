'use client'

import type { DayItem } from '@/lib/coverage/selectors'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatWeekLabel(week: DayItem[]): string {
  const start = week[0]
  const end = week[week.length - 1]
  if (!start || !end) return ''

  const startDate = new Date(`${start.isoDate}T00:00:00`)
  const endDate = new Date(`${end.isoDate}T00:00:00`)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return `${start.isoDate} - ${end.isoDate}`
  }

  const startLabel = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endLabel =
    startDate.getMonth() === endDate.getMonth()
      ? endDate.toLocaleDateString('en-US', { day: 'numeric' })
      : endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return `${startLabel} - ${endLabel}`
}

export function CalendarGridDesktopView({
  loading,
  renderDayCard,
  weeks,
}: {
  loading: boolean
  renderDayCard: (day: DayItem, absoluteIndex: number) => React.ReactNode
  weeks: DayItem[][]
}) {
  return (
    <div className="coverage-calendar-desktop hidden xl:block">
      <div role="grid" aria-label="Coverage calendar" className="pb-2">
        <div className="coverage-calendar-desktop-grid space-y-2.5">
          <div className="grid grid-cols-[80px_repeat(7,minmax(0,1fr))] gap-2">
            <div />
            {DOW.map((day) => (
              <div
                key={day}
                className="flex h-9 items-center justify-center rounded-lg border border-border/60 bg-muted/30 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>

          {loading ? (
            <div className="rounded-xl border border-border bg-card px-3 py-8 text-center text-sm text-muted-foreground">
              Loading schedule...
            </div>
          ) : (
            weeks.map((week, weekIndex) => (
              <section
                key={`week-${weekIndex}`}
                role="row"
                className="grid grid-cols-[80px_repeat(7,minmax(0,1fr))] gap-1.5"
              >
                <div className="rounded-xl border border-border/70 bg-muted/18 px-2.5 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Week {weekIndex + 1}
                  </p>
                  <p className="mt-1 text-xs font-medium text-foreground">{formatWeekLabel(week)}</p>
                </div>

                {week.map((day, dayOffset) => renderDayCard(day, weekIndex * 7 + dayOffset))}
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
