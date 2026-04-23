'use client'

import { useMemo } from 'react'

import type { DayItem, ShiftTab } from '@/lib/coverage/selectors'
import { toIsoDate } from '@/lib/calendar-utils'
import { getWeekBoundsForDate } from '@/lib/schedule-helpers'

export function useCoverageSelectedDayContext({
  activeOpCodes,
  dayDays,
  days,
  nightDays,
  selectedId,
  shiftTab,
}: {
  activeOpCodes: Map<string, string>
  dayDays: DayItem[]
  days: DayItem[]
  nightDays: DayItem[]
  selectedId: string | null
  shiftTab: ShiftTab
}) {
  const selectedDayBase = useMemo(
    () => days.find((row) => row.id === selectedId) ?? null,
    [days, selectedId]
  )
  const selectedDay = useMemo(
    () => (selectedDayBase ? { ...selectedDayBase, shiftType: shiftTab } : null),
    [selectedDayBase, shiftTab]
  )
  const today = toIsoDate(new Date())
  const isPastDate = selectedDay !== null && selectedDay.isoDate < today
  const selectedDayShiftIds = [
    ...(selectedDay?.leadShift ? [selectedDay.leadShift.id] : []),
    ...(selectedDay?.staffShifts.map((shift) => shift.id) ?? []),
  ]
  const hasOperationalEntries = selectedDayShiftIds.some((id) => activeOpCodes.has(id))

  const weeklyTherapistCounts = useMemo((): Map<string, number> => {
    if (!selectedId) return new Map()
    const bounds = getWeekBoundsForDate(selectedId)
    if (!bounds) return new Map()
    const { weekStart, weekEnd } = bounds
    const counts = new Map<string, number>()
    for (const item of [...dayDays, ...nightDays]) {
      if (item.isoDate < weekStart || item.isoDate > weekEnd) continue
      const shifts = [...(item.leadShift ? [item.leadShift] : []), ...item.staffShifts]
      for (const shift of shifts) {
        counts.set(shift.userId, (counts.get(shift.userId) ?? 0) + 1)
      }
    }
    return counts
  }, [selectedId, dayDays, nightDays])

  return {
    hasOperationalEntries,
    isPastDate,
    selectedDay,
    selectedDayBase,
    selectedDayShiftIds,
    weeklyTherapistCounts,
  }
}
