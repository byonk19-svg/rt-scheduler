import { addDays, toIsoDate } from '@/lib/calendar-utils'

type DayStatus = 'none' | 'force_on' | 'force_off'

type AvailabilityRowLike = {
  cycleId: string
  date: string
  entryType: 'force_off' | 'force_on'
  reason?: string | null
}

type CycleLike = {
  start_date: string
  end_date: string
}

export function buildInitialStatusByDate(
  cycleRows: AvailabilityRowLike[]
): Record<string, DayStatus> {
  const next: Record<string, DayStatus> = {}
  for (const row of cycleRows) {
    next[row.date] = row.entryType === 'force_off' ? 'force_off' : 'force_on'
  }
  return next
}

export function buildInitialNotesByDate(cycleRows: AvailabilityRowLike[]): Record<string, string> {
  const next: Record<string, string> = {}
  for (const row of cycleRows) {
    if (row.reason?.trim()) next[row.date] = row.reason.trim()
  }
  return next
}

export function buildCycleDays(selectedCycle: CycleLike | null): string[] {
  if (!selectedCycle) return []
  const dayCount =
    Math.floor(
      (new Date(`${selectedCycle.end_date}T00:00:00`).getTime() -
        new Date(`${selectedCycle.start_date}T00:00:00`).getTime()) /
        (24 * 60 * 60 * 1000)
    ) + 1
  return Array.from({ length: Math.max(dayCount, 0) }, (_, index) =>
    toIsoDate(addDays(new Date(`${selectedCycle.start_date}T00:00:00`), index))
  )
}

export function chunkCycleWeeks(cycleDays: string[]): string[][] {
  const result: string[][] = []
  for (let index = 0; index < cycleDays.length; index += 7) {
    result.push(cycleDays.slice(index, index + 7))
  }
  return result
}

export function buildCanWorkDates(draftStatusByDate: Record<string, DayStatus>): string[] {
  return Object.entries(draftStatusByDate)
    .filter(([, status]) => status === 'force_on')
    .map(([date]) => date)
    .sort((a, b) => a.localeCompare(b))
}

export function buildCannotWorkDates(draftStatusByDate: Record<string, DayStatus>): string[] {
  return Object.entries(draftStatusByDate)
    .filter(([, status]) => status === 'force_off')
    .map(([date]) => date)
    .sort((a, b) => a.localeCompare(b))
}

export function buildDaysWithNoteText({
  cycleDays,
  draftNotesByDate,
  draftStatusByDate,
}: {
  cycleDays: string[]
  draftNotesByDate: Record<string, string>
  draftStatusByDate: Record<string, DayStatus>
}): string[] {
  // Persisted notes only exist for Need Off / Request to Work; omit Available-only drafts.
  return cycleDays.filter((date) => {
    const status = draftStatusByDate[date] ?? 'none'
    if (status !== 'force_off' && status !== 'force_on') return false
    return (draftNotesByDate[date] ?? '').trim().length > 0
  })
}

export function buildNotesPayload({
  draftNotesByDate,
  draftStatusByDate,
}: {
  draftNotesByDate: Record<string, string>
  draftStatusByDate: Record<string, DayStatus>
}): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(draftNotesByDate)
        .map(([date, note]) => [date, note.trim()])
        .filter(([date, note]) => {
          if (note.length === 0) return false
          const status = draftStatusByDate[date] ?? 'none'
          return status === 'force_on' || status === 'force_off'
        })
    )
  )
}

export function countAvailableDays({
  cycleDays,
  draftStatusByDate,
  selectedCycle,
}: {
  cycleDays: string[]
  draftStatusByDate: Record<string, DayStatus>
  selectedCycle: CycleLike | null
}): number {
  if (!selectedCycle) return 0
  return cycleDays.filter((date) => (draftStatusByDate[date] ?? 'none') === 'none').length
}

export function hasDraftAvailabilityChanges({
  initialStatusByDate,
  draftStatusByDate,
  initialNotesByDate,
  draftNotesByDate,
}: {
  initialStatusByDate: Record<string, DayStatus>
  draftStatusByDate: Record<string, DayStatus>
  initialNotesByDate: Record<string, string>
  draftNotesByDate: Record<string, string>
}): boolean {
  const allDates = new Set([...Object.keys(initialStatusByDate), ...Object.keys(draftStatusByDate)])
  for (const date of allDates) {
    if ((initialStatusByDate[date] ?? 'none') !== (draftStatusByDate[date] ?? 'none')) {
      return true
    }
  }

  const allNoteDates = new Set([
    ...Object.keys(initialNotesByDate),
    ...Object.keys(draftNotesByDate),
  ])
  for (const date of allNoteDates) {
    if ((initialNotesByDate[date] ?? '').trim() !== (draftNotesByDate[date] ?? '').trim()) {
      return true
    }
  }

  return false
}
