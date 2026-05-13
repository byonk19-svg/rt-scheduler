'use client'

import { useCallback, useMemo, useRef, useState } from 'react'

import type { DayItem } from '@/lib/coverage/selectors'
import { getCoverageHealth } from '@/lib/coverage/selectors'
import {
  MAX_SHIFT_COVERAGE_PER_DAY,
  MIN_SHIFT_COVERAGE_PER_DAY,
} from '@/lib/scheduling-constants'
import { cn } from '@/lib/utils'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const STAFF_NAMES_PER_LINE = 2
const MAX_STAFF_LINES = 1

export function nextIndex(current: number, key: string, total: number): number {
  const cols = 7

  switch (key) {
    case 'ArrowRight':
      return Math.min(current + 1, total - 1)
    case 'ArrowLeft':
      return Math.max(current - 1, 0)
    case 'ArrowDown':
      return Math.min(current + cols, total - 1)
    case 'ArrowUp':
      return Math.max(current - cols, 0)
    default:
      return current
  }
}

type CalendarGridProps = {
  days: DayItem[]
  loading: boolean
  selectedId: string | null
  weekOffset?: number
  schedulingViewOnly?: boolean
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSelect: (id: string) => void
}

type DayBoardTone = 'critical' | 'warning' | 'healthy' | 'empty'

type DayBoardStatus = {
  tone: DayBoardTone
  label: string
}

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

function compactName(value: string): string {
  return value.trim().split(/\s+/)[0] ?? value
}

function formatDateHeader(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return isoDate
  return parsed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function chunkWeeks(days: DayItem[]): DayItem[][] {
  const weeks: DayItem[][] = []
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7))
  }
  return weeks
}

export function getVisibleWeek<T>(weeks: T[][], weekOffset: number): T[] {
  if (weeks.length === 0) return []
  const clampedOffset = Math.max(0, Math.min(weekOffset, weeks.length - 1))
  return weeks[clampedOffset] ?? []
}

export function resolveSwipeDirection(
  touchStart: number | null,
  touchEnd: number | null
): 'left' | 'right' | null {
  if (touchStart === null || touchEnd === null) return null
  const delta = touchStart - touchEnd
  if (delta > 50) return 'left'
  if (delta < -50) return 'right'
  return null
}

export function resolveDayBoardStatus(day: DayItem, health = getCoverageHealth(day)): DayBoardStatus {
  return { tone: health.tone, label: health.statusLabel }
}

export function buildStaffDisplayLines(
  names: string[],
  namesPerLine = STAFF_NAMES_PER_LINE,
  maxLines = MAX_STAFF_LINES
): { lines: string[]; remaining: number } {
  const compactNames = names.map(compactName)
  const visibleNames = compactNames.slice(0, namesPerLine * maxLines)
  const lines: string[] = []

  for (let index = 0; index < visibleNames.length; index += namesPerLine) {
    lines.push(visibleNames.slice(index, index + namesPerLine).join(' · '))
  }

  return {
    lines,
    remaining: Math.max(compactNames.length - visibleNames.length, 0),
  }
}

function toneClasses(tone: DayBoardTone): {
  card: string
  badge: string
  label: string
  dot: string
} {
  switch (tone) {
    case 'critical':
      return {
        card: 'border-border/70 bg-card',
        badge: 'border-[var(--error-border)]/45 text-[var(--error-text)]',
        label: 'text-[var(--error-text)]',
        dot: 'bg-[var(--error-text)]',
      }
    case 'warning':
      return {
        card: 'border-border/70 bg-card',
        badge: 'border-[var(--warning-border)]/45 text-[var(--warning-text)]',
        label: 'text-[var(--error-text)]',
        dot: 'bg-[var(--warning-text)]',
      }
    case 'healthy':
      return {
        card: 'border-border/70 bg-card',
        badge: 'border-[var(--success-border)]/55 text-[var(--success-text)]',
        label: 'text-[var(--success-text)]',
        dot: 'bg-[var(--success-text)]',
      }
    case 'empty':
    default:
      return {
        card: 'border-border/70 bg-card',
        badge: 'border-border/70 text-muted-foreground',
        label: 'text-muted-foreground',
        dot: 'bg-muted-foreground/50',
      }
  }
}

export function CalendarGrid({
  days,
  loading,
  selectedId,
  weekOffset = 0,
  schedulingViewOnly = false,
  onSwipeLeft,
  onSwipeRight,
  onSelect,
}: CalendarGridProps) {
  const weeks = useMemo(() => chunkWeeks(days), [days])
  const visibleWeek = useMemo(() => getVisibleWeek(weeks, weekOffset), [weekOffset, weeks])
  const totalWeeks = weeks.length
  const cellRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const focusCell = useCallback((id: string) => {
    cellRefs.current.get(id)?.focus()
  }, [])
  const flatDayIds = useMemo(() => days.map((day) => day.id), [days])

  const handleTouchEnd = useCallback(
    (clientX: number | null) => {
      const direction = resolveSwipeDirection(touchStart, clientX)
      if (direction === 'left') onSwipeLeft?.()
      if (direction === 'right') onSwipeRight?.()
      setTouchStart(null)
    },
    [onSwipeLeft, onSwipeRight, touchStart]
  )

  function renderDayCard(day: DayItem, absoluteIndex: number) {
    const health = getCoverageHealth(day)
    const activeCount = health.activeCount
    const dayStatus = resolveDayBoardStatus(day, health)
    const staffDisplay = buildStaffDisplayLines(day.staffShifts.map((shift) => shift.name))
    const dayTone = toneClasses(dayStatus.tone)

    return (
      <article
        key={day.id}
        role="gridcell"
        data-testid={`coverage-day-panel-${day.id}`}
        className={cn(
          'relative min-h-[164px] rounded-[16px] border px-3.5 py-3.5 shadow-tw-2xs transition-colors',
          'hover:border-primary/40',
          dayTone.card,
          selectedId === day.id && 'border-primary/65 ring-2 ring-primary/15',
          'coverage-calendar-mobile-day'
        )}
      >
        <button
          type="button"
          ref={(element) => {
            if (element) {
              cellRefs.current.set(day.id, element)
              return
            }
            cellRefs.current.delete(day.id)
          }}
          tabIndex={absoluteIndex === 0 ? 0 : -1}
          data-testid={`coverage-day-cell-button-${day.id}`}
          aria-label={`${schedulingViewOnly ? 'View' : 'Open'} ${day.label}`}
          className="absolute inset-0 z-0 rounded-[16px]"
          onClick={() => onSelect(day.id)}
          onKeyDown={(event) => {
            if (!['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
              return
            }
            event.preventDefault()
            const next = nextIndex(absoluteIndex, event.key, flatDayIds.length)
            focusCell(flatDayIds[next])
          }}
        />

        <div className="pointer-events-none relative z-10 flex h-full flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[13px] font-semibold leading-none text-foreground">
              {formatDateHeader(day.isoDate)}
            </p>
            <span
              data-testid={`coverage-headcount-badge-${day.id}`}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border bg-background/90 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                dayTone.badge
              )}
            >
              {activeCount}/{MIN_SHIFT_COVERAGE_PER_DAY}-{MAX_SHIFT_COVERAGE_PER_DAY}
            </span>
          </div>

          <p className="text-[11px] font-medium leading-4 text-foreground/82">
            Lead:{' '}
            <span className={day.leadShift ? 'text-foreground' : 'text-[var(--warning-text)]'}>
              {day.leadShift ? compactName(day.leadShift.name) : 'Unassigned'}
            </span>
          </p>

          <div className="min-h-[3.8rem] space-y-1.5">
            {staffDisplay.lines.length > 0 ? (
              staffDisplay.lines.map((line) => (
                <p
                  key={`${day.id}-${line}`}
                  className="text-[11px] leading-[1.2rem] text-[var(--success-text)]"
                >
                  {line}
                </p>
              ))
            ) : (
              <p className="text-[11px] leading-[1.2rem] text-[var(--success-text)]">
                No staff assigned
              </p>
            )}
            {staffDisplay.remaining > 0 ? (
              <p className="text-[10px] font-medium text-muted-foreground">
                +{staffDisplay.remaining} more
              </p>
            ) : null}
          </div>

          <div className="mt-auto flex items-center gap-1.5">
            <span className={cn('h-1.5 w-1.5 rounded-full', dayTone.dot)} />
            <span className={cn('text-[10px] font-medium', dayTone.label)}>{dayStatus.label}</span>
          </div>
        </div>
      </article>
    )
  }

  return (
    <>
      <div className="coverage-calendar-mobile lg:hidden">
        <div className="coverage-calendar-mobile-header mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={onSwipeRight}
            disabled={weekOffset <= 0}
            className="min-h-11 rounded-md border border-border/70 bg-card px-3 py-1.5 text-sm font-medium text-foreground disabled:opacity-40"
          >
            Prev week
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
            Next week
          </button>
        </div>

        {loading ? (
          <div className="rounded-xl border border-border bg-card px-3 py-8 text-center text-sm text-muted-foreground">
            Loading schedule...
          </div>
        ) : (
          <div
            className="coverage-calendar-mobile-list space-y-3"
            onTouchStart={(event) => setTouchStart(event.changedTouches[0]?.clientX ?? null)}
            onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0]?.clientX ?? null)}
          >
            <div className="rounded-xl border border-border/70 bg-muted/18 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Week {totalWeeks === 0 ? 0 : Math.min(weekOffset + 1, totalWeeks)}
              </p>
              <p className="mt-1 text-xs font-medium text-foreground">{formatWeekLabel(visibleWeek)}</p>
            </div>

            {visibleWeek.map((day) => renderDayCard(day, flatDayIds.indexOf(day.id)))}
          </div>
        )}
      </div>

      <div className="coverage-calendar-desktop hidden lg:block">
        <div role="grid" aria-label="Coverage calendar" className="overflow-x-auto pb-2">
          <div className="min-w-[980px] space-y-2">
            <div className="sticky top-0 z-10 grid grid-cols-[112px_repeat(7,minmax(0,1fr))] gap-1.5 bg-background/95 pb-1 backdrop-blur">
              <div />
              {DOW.map((day) => (
                <div
                  key={day}
                  className="flex h-8 items-center justify-center rounded-md border border-border/60 bg-muted/28 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
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
                  className="grid grid-cols-[112px_repeat(7,minmax(0,1fr))] gap-1.5"
                >
                  <div className="rounded-[14px] border border-border/70 bg-muted/18 px-2.5 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Week {weekIndex + 1}
                    </p>
                    <p className="mt-1 text-xs font-medium leading-5 text-foreground">
                      {formatWeekLabel(week)}
                    </p>
                  </div>

                  {week.map((day, dayOffset) => renderDayCard(day, weekIndex * 7 + dayOffset))}
                </section>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  )
}
