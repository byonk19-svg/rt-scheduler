'use client'

import type { DayItem } from '@/lib/coverage/selectors'

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

export function CalendarGridMobileView({
  loading,
  onTouchEnd,
  onTouchStart,
  onSwipeLeft,
  onSwipeRight,
  renderDayCard,
  totalWeeks,
  visibleWeek,
  weekOffset,
}: {
  loading: boolean
  onTouchEnd: (clientX: number | null) => void
  onTouchStart: (clientX: number | null) => void
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  renderDayCard: (day: DayItem, absoluteIndex: number) => React.ReactNode
  totalWeeks: number
  visibleWeek: DayItem[]
  weekOffset: number
}) {
  return (
    <div className="coverage-calendar-mobile xl:hidden">
      <div className="coverage-calendar-mobile-header mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={onSwipeRight}
          disabled={weekOffset <= 0}
          className="min-h-11 rounded-md border border-border/70 bg-card px-3 py-1.5 text-sm font-medium text-foreground disabled:opacity-40"
        >
          ← Prev week
        </button>
        <span className="text-sm font-medium text-foreground">
          Week {totalWeeks === 0 ? 0 : Math.min(weekOffset + 1, totalWeeks)} of {totalWeeks}
        </span>
        <button
          type="button"
          onClick={onSwipeLeft}
          disabled={totalWeeks === 0 || weekOffset >= totalWeeks - 1}
          className="min-h-11 rounded-md border border-border/70 bg-card px-3 py-1.5 text-sm font-medium text-foreground disabled:opacity-40"
        >
          Next week →
        </button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card px-3 py-8 text-center text-sm text-muted-foreground">
          Loading schedule...
        </div>
      ) : (
        <div
          className="coverage-calendar-mobile-list space-y-3"
          onTouchStart={(event) => onTouchStart(event.changedTouches[0]?.clientX ?? null)}
          onTouchEnd={(event) => onTouchEnd(event.changedTouches[0]?.clientX ?? null)}
        >
          <div className="rounded-xl border border-border/70 bg-muted/18 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Week {totalWeeks === 0 ? 0 : Math.min(weekOffset + 1, totalWeeks)}
            </p>
            <p className="mt-1 text-xs font-medium text-foreground">{formatWeekLabel(visibleWeek)}</p>
          </div>

          {visibleWeek.map((day, index) => renderDayCard(day, index))}
        </div>
      )}
    </div>
  )
}
