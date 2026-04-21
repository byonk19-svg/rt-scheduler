'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { CalendarGridDesktopView } from '@/components/coverage/CalendarGridDesktopView'
import { CalendarGridDayCard } from '@/components/coverage/CalendarGridDayCard'
import { CalendarGridMobileView } from '@/components/coverage/CalendarGridMobileView'
import type { DayItem, UiStatus } from '@/lib/coverage/selectors'

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
    return (
      <CalendarGridDayCard
        absoluteIndex={absoluteIndex}
        allowAssignmentStatusEdits={allowAssignmentStatusEdits}
        day={day}
        flatDayIds={flatDayIds}
        focusCell={focusCell}
        onChangeStatus={onChangeStatus}
        onSelect={onSelect}
        schedulingViewOnly={schedulingViewOnly}
        selectedId={selectedId}
      />
    )
  }

  return (
    <>
      <CalendarGridMobileView
        loading={loading}
        onTouchEnd={handleTouchEnd}
        onTouchStart={setTouchStart}
        onSwipeLeft={onSwipeLeft}
        onSwipeRight={onSwipeRight}
        renderDayCard={(day, absoluteIndex) =>
          renderDayCard(day, flatDayIds.indexOf(day.id) === -1 ? absoluteIndex : flatDayIds.indexOf(day.id))
        }
        totalWeeks={totalWeeks}
        visibleWeek={visibleWeek}
        weekOffset={weekOffset}
      />

      <CalendarGridDesktopView
        loading={loading}
        renderDayCard={renderDayCard}
        weeks={weeks}
      />
    </>
  )
}
