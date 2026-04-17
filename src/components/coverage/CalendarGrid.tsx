'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowUpRight } from 'lucide-react'

import {
  AssignmentStatusPopover,
  StatusPill,
} from '@/components/coverage/AssignmentStatusPopover'
import type { DayItem, ShiftItem, UiStatus } from '@/lib/coverage/selectors'
import {
  countActive,
  headcountThreshold,
  shouldShowMonthTag,
} from '@/lib/coverage/selectors'
import { useMediaQuery } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const TARGET_HEADCOUNT = 4

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
  allowAssignmentStatusEdits?: boolean
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSelect: (id: string) => void
  onChangeStatus: (dayId: string, shiftId: string, isLead: boolean, nextStatus: UiStatus) => void
}

type CellTone = 'critical' | 'warning' | 'healthy' | 'empty'

function formatMonthShort(value: string): string {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-US', { month: 'short' })
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

function isUnavailableStatus(status: UiStatus): boolean {
  return status === 'cancelled' || status === 'call_in'
}

function resolveCellTone(day: DayItem, activeCount: number): CellTone {
  if (day.constraintBlocked) return 'critical'
  if (!day.leadShift) return activeCount > 0 ? 'warning' : 'critical'
  const threshold = headcountThreshold(activeCount)
  if (threshold === 'green') return 'healthy'
  if (threshold === 'yellow') return 'warning'
  return activeCount === 0 ? 'empty' : 'critical'
}

function buildCoverageLabel(day: DayItem, activeCount: number): string {
  if (day.constraintBlocked) return 'No eligible therapists'
  if (!day.leadShift) return 'No lead'
  if (activeCount === 0) return 'Untouched'

  const openSlots = Math.max(TARGET_HEADCOUNT - activeCount, 0)
  if (openSlots > 0) {
    return `${openSlots} ${openSlots === 1 ? 'gap' : 'gaps'}`
  }

  return 'Set'
}

function cellToneClassName(tone: CellTone): string {
  switch (tone) {
    case 'critical':
      return 'border-[var(--error-border)]/75 bg-[var(--error-subtle)]/40'
    case 'warning':
      return 'border-[var(--warning-border)]/70 bg-[var(--warning-subtle)]/28'
    case 'healthy':
      return 'border-[var(--success-border)]/50 bg-[var(--success-subtle)]/30'
    case 'empty':
    default:
      return 'border-border/70 bg-card'
  }
}

function badgeToneClassName(tone: CellTone): string {
  switch (tone) {
    case 'critical':
      return 'bg-[var(--error-subtle)] text-[var(--error-text)]'
    case 'warning':
      return 'bg-[var(--warning-subtle)] text-[var(--warning-text)]'
    case 'healthy':
      return 'bg-[var(--success-subtle)] text-[var(--success-text)]'
    case 'empty':
    default:
      return 'bg-muted/60 text-foreground/75'
  }
}

function renderShiftPill(
  dayId: string,
  shift: ShiftItem,
  isLead: boolean,
  allowAssignmentStatusEdits: boolean,
  onChangeStatus: (dayId: string, shiftId: string, isLead: boolean, nextStatus: UiStatus) => void
) {
  const content = (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/95 px-2 py-1 text-[10px] font-medium text-foreground/85',
        isUnavailableStatus(shift.status) &&
          'border-[var(--error-border)]/55 text-[var(--error-text)] line-through decoration-[var(--error-text)]/50'
      )}
    >
      <span>{compactName(shift.name)}</span>
      <StatusPill status={shift.status} />
    </span>
  )

  if (!allowAssignmentStatusEdits) {
    return <span className="pointer-events-auto">{content}</span>
  }

  return (
    <AssignmentStatusPopover
      therapistName={shift.name}
      currentStatus={shift.status}
      isLead={isLead}
      triggerTestId={`coverage-assignment-trigger-${dayId}-${shift.userId}`}
      onChangeStatus={(nextStatus) => onChangeStatus(dayId, shift.id, isLead, nextStatus)}
    >
      {content}
    </AssignmentStatusPopover>
  )
}

export function CalendarGrid({
  days,
  loading,
  selectedId,
  weekOffset = 0,
  schedulingViewOnly = false,
  allowAssignmentStatusEdits = true,
  onSwipeLeft,
  onSwipeRight,
  onSelect,
  onChangeStatus,
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
    const activeCount = countActive(day)
    const tone = resolveCellTone(day, activeCount)
    const showMonthTag = shouldShowMonthTag(absoluteIndex, day.isoDate)
    const visibleStaff = day.staffShifts.slice(0, 2)
    const extraStaffCount = Math.max(day.staffShifts.length - visibleStaff.length, 0)

    return (
      <article
        key={day.id}
        role="gridcell"
        data-testid={`coverage-day-panel-${day.id}`}
        className={cn(
          'relative min-h-[108px] rounded-xl border px-2.5 py-2.5 shadow-sm transition-[border-color,box-shadow,transform] duration-150',
          'hover:-translate-y-px hover:shadow-md',
          cellToneClassName(tone),
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
          aria-label={`${schedulingViewOnly ? 'View' : 'Edit'} ${day.label}`}
          className="absolute inset-0 z-0 rounded-xl"
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

        <div className="pointer-events-none relative z-10 flex h-full flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[1.15rem] font-semibold leading-none tracking-[-0.04em] text-foreground">
                {day.date}
              </span>
              {showMonthTag ? (
                <span className="rounded-full border border-border/70 bg-background/90 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {formatMonthShort(day.isoDate)}
                </span>
              ) : null}
            </div>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                badgeToneClassName(tone)
              )}
            >
              {activeCount}/{TARGET_HEADCOUNT} staffed
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <div className="pointer-events-auto">
              {day.leadShift
                ? renderShiftPill(
                    day.id,
                    day.leadShift,
                    true,
                    allowAssignmentStatusEdits,
                    onChangeStatus
                  )
                : (
                  <span className="rounded-full border border-dashed border-[var(--warning-border)]/70 px-2 py-0.5 text-[10px] font-medium text-[var(--warning-text)]">
                    No lead
                  </span>
                )}
            </div>
            <span className="inline-flex items-center gap-1">
              {day.constraintBlocked ? (
                <AlertTriangle className="h-3.5 w-3.5 text-[var(--error-text)]" aria-hidden />
              ) : null}
              {buildCoverageLabel(day, activeCount)}
            </span>
          </div>

          <div className="mt-auto space-y-1">
            {visibleStaff.length > 0 ? (
              <div className="pointer-events-auto flex flex-wrap gap-1.5">
                {visibleStaff.map((shift) => (
                  <div key={shift.id}>
                    {renderShiftPill(
                      day.id,
                      shift,
                      false,
                      allowAssignmentStatusEdits,
                      onChangeStatus
                    )}
                  </div>
                ))}
                {extraStaffCount > 0 ? (
                  <span className="inline-flex items-center rounded-full border border-border/70 bg-background/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    +{extraStaffCount} more
                  </span>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
              <span className="font-medium">Open day editor</span>
              <span className="inline-flex items-center gap-1 font-medium text-foreground/70">
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </span>
            </div>
          </div>
        </div>
      </article>
    )
  }

  return (
    <>
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
            onTouchStart={(event) => setTouchStart(event.changedTouches[0]?.clientX ?? null)}
            onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0]?.clientX ?? null)}
          >
            <div className="rounded-xl border border-border/70 bg-muted/18 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Week {totalWeeks === 0 ? 0 : Math.min(weekOffset + 1, totalWeeks)}
              </p>
              <p className="mt-1 text-xs font-medium text-foreground">
                {formatWeekLabel(visibleWeek)}
              </p>
            </div>

            {visibleWeek.map((day) => renderDayCard(day, flatDayIds.indexOf(day.id)))}
          </div>
        )}
      </div>

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

                  {week.map((day, dayOffset) =>
                    renderDayCard(day, weekIndex * 7 + dayOffset)
                  )}
                </section>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  )
}
