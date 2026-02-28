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
