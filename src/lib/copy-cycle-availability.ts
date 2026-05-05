export type SourceOverride = {
  date: string
  override_type: 'force_on' | 'force_off'
  shift_type: 'day' | 'night' | 'both'
  note: string | null
}

export type ShiftedOverride = SourceOverride

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function daysBetween(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}

function getUtcDayOfWeek(isoDate: string): number | null {
  const date = new Date(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return null
  return date.getUTCDay()
}

function buildDateRangeByDayOfWeek(startDate: string, endDate: string): Map<number, string[]> {
  const byDay = new Map<number, string[]>()
  let current = startDate
  while (current <= endDate) {
    const dayOfWeek = getUtcDayOfWeek(current)
    if (dayOfWeek == null) break
    const dates = byDay.get(dayOfWeek) ?? []
    dates.push(current)
    byDay.set(dayOfWeek, dates)
    current = addDays(current, 1)
  }
  return byDay
}

function getOverrideSignature(row: SourceOverride): string {
  return `${row.override_type}:${row.shift_type}:${row.note ?? ''}`
}

export function shiftOverridesToCycle(params: {
  sourceOverrides: SourceOverride[]
  sourceCycleStart: string
  sourceCycleEnd?: string
  targetCycleStart: string
  targetCycleEnd: string
  existingTargetDates: Set<string>
}): ShiftedOverride[] {
  const {
    sourceOverrides,
    sourceCycleStart,
    sourceCycleEnd,
    targetCycleStart,
    targetCycleEnd,
    existingTargetDates,
  } = params

  if (sourceCycleEnd) {
    const sourceDatesByDay = buildDateRangeByDayOfWeek(sourceCycleStart, sourceCycleEnd)
    const targetDatesByDay = buildDateRangeByDayOfWeek(targetCycleStart, targetCycleEnd)
    const sourceRowsByDay = new Map<number, SourceOverride[]>()
    for (const row of sourceOverrides) {
      const dayOfWeek = getUtcDayOfWeek(row.date)
      if (dayOfWeek == null) continue
      const rows = sourceRowsByDay.get(dayOfWeek) ?? []
      rows.push(row)
      sourceRowsByDay.set(dayOfWeek, rows)
    }

    const shifted: ShiftedOverride[] = []
    const usedTargetDates = new Set(existingTargetDates)

    for (const [dayOfWeek, rows] of sourceRowsByDay.entries()) {
      const sourceDates = sourceDatesByDay.get(dayOfWeek) ?? []
      const targetDates = targetDatesByDay.get(dayOfWeek) ?? []
      if (targetDates.length === 0) continue

      const sourceOverrideDates = new Set(rows.map((row) => row.date))
      const firstSignature = rows[0] ? getOverrideSignature(rows[0]) : null
      const isFullDayPattern =
        sourceDates.length > 0 &&
        rows.length === sourceDates.length &&
        sourceDates.every((date) => sourceOverrideDates.has(date)) &&
        rows.every((row) => getOverrideSignature(row) === firstSignature)

      if (isFullDayPattern && rows[0]) {
        for (const targetDate of targetDates) {
          if (usedTargetDates.has(targetDate)) continue
          shifted.push({ ...rows[0], date: targetDate })
          usedTargetDates.add(targetDate)
        }
        continue
      }

      for (const row of rows) {
        const sourceOrdinal = sourceDates.indexOf(row.date)
        const targetDate = sourceOrdinal >= 0 ? targetDates[sourceOrdinal] : undefined
        if (!targetDate || usedTargetDates.has(targetDate)) continue
        shifted.push({ ...row, date: targetDate })
        usedTargetDates.add(targetDate)
      }
    }

    return shifted.sort((a, b) => a.date.localeCompare(b.date))
  }

  const gap = daysBetween(sourceCycleStart, targetCycleStart)

  return sourceOverrides.reduce<ShiftedOverride[]>((acc, row) => {
    const shiftedDate = addDays(row.date, gap)
    if (shiftedDate < targetCycleStart || shiftedDate > targetCycleEnd) return acc
    if (existingTargetDates.has(shiftedDate)) return acc

    acc.push({ ...row, date: shiftedDate })
    return acc
  }, [])
}
