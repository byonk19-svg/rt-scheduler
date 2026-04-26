export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function dateFromKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function startOfWeek(value: Date): Date {
  const next = new Date(value)
  next.setDate(next.getDate() - next.getDay())
  return next
}

export function endOfWeek(value: Date): Date {
  const next = new Date(value)
  next.setDate(next.getDate() + (6 - next.getDay()))
  return next
}

export function buildCalendarWeeks(startDate: string, endDate: string): Date[][] {
  const start = dateFromKey(startDate)
  const end = dateFromKey(endDate)
  const weeks: Date[][] = []
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return weeks
  const gridStart = startOfWeek(start)
  const gridEnd = endOfWeek(end)
  const cursor = new Date(gridStart)
  while (cursor <= gridEnd) {
    const week: Date[] = []
    for (let i = 0; i < 7; i += 1) week.push(addDays(cursor, i))
    weeks.push(week)
    cursor.setDate(cursor.getDate() + 7)
  }
  return weeks
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function dateRange(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return []
  const out: string[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    out.push(toIsoDate(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

export function formatDateLabel(value: string): string {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatMonthLabel(value: string): string {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

/**
 * Human-readable cycle window, e.g. "Mar 23 – May 3, 2026".
 * Shared by therapist dashboard and availability surfaces—keep wording aligned.
 */
export function formatHumanCycleRange(startDate: string, endDate: string): string {
  const s = dateFromKey(startDate)
  const e = dateFromKey(endDate)
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
    return `${startDate} – ${endDate}`
  }
  if (s.getFullYear() === e.getFullYear()) {
    const left = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const right = e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    return `${left} – ${right}`
  }
  return `${formatDateLabel(startDate)} – ${formatDateLabel(endDate)}`
}

/** Timestamp for "Submitted …" lines on therapist-facing surfaces. */
export function formatSubmittedDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Returns the ISO date of the first day of the month containing `dateValue`. */
export function toMonthStartKey(dateValue: string): string {
  const parsed = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    const fallback = new Date()
    fallback.setDate(1)
    return toIsoDate(fallback)
  }
  parsed.setDate(1)
  return toIsoDate(parsed)
}

/** Returns the ISO date of the last day of the month whose first day is `monthStartKey`. */
export function toMonthEndKey(monthStartKey: string): string {
  const parsed = new Date(`${monthStartKey}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return monthStartKey
  const monthEnd = new Date(parsed.getFullYear(), parsed.getMonth() + 1, 0)
  return toIsoDate(monthEnd)
}

/** Shifts `monthStartKey` by `monthDelta` months and returns the resulting first-of-month ISO date. */
export function shiftMonthKey(monthStartKey: string, monthDelta: number): string {
  const parsed = new Date(`${monthStartKey}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return monthStartKey
  const shifted = new Date(parsed.getFullYear(), parsed.getMonth() + monthDelta, 1)
  return toIsoDate(shifted)
}

/** Parse an ISO date string to a local Date object without shifting the calendar day. */
export function parseLocalDate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00`)
}

/** Format an ISO date string for user-facing display with a consistent locale. */
export function formatDisplayDate(
  isoDate: string,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
): string {
  const parsed = parseLocalDate(isoDate)
  if (Number.isNaN(parsed.getTime())) return isoDate
  return parsed.toLocaleDateString('en-US', options)
}
