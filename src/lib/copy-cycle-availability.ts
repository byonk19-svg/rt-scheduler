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

export function shiftOverridesToCycle(params: {
  sourceOverrides: SourceOverride[]
  sourceCycleStart: string
  targetCycleStart: string
  targetCycleEnd: string
  existingTargetDates: Set<string>
}): ShiftedOverride[] {
  const {
    sourceOverrides,
    sourceCycleStart,
    targetCycleStart,
    targetCycleEnd,
    existingTargetDates,
  } = params
  const gap = daysBetween(sourceCycleStart, targetCycleStart)

  return sourceOverrides.reduce<ShiftedOverride[]>((acc, row) => {
    const shiftedDate = addDays(row.date, gap)
    if (shiftedDate < targetCycleStart || shiftedDate > targetCycleEnd) return acc
    if (existingTargetDates.has(shiftedDate)) return acc

    acc.push({ ...row, date: shiftedDate })
    return acc
  }, [])
}
