export const SCHEDULE_BLOCK_DAYS = 42
export const SCHEDULE_BLOCK_WEEKS = 6

export function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function fromIsoDate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00`)
}

export function addDays(isoDate: string, days: number): string {
  const date = fromIsoDate(isoDate)
  date.setDate(date.getDate() + days)
  return toIsoDate(date)
}

export function startOfSundayWeekIso(date: Date): string {
  const local = new Date(date)
  local.setHours(12, 0, 0, 0)
  local.setDate(local.getDate() - local.getDay())
  return toIsoDate(local)
}

export function parseScheduleBlockStart(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return startOfSundayWeekIso(fromIsoDate(raw))
  }
  return startOfSundayWeekIso(new Date())
}

export function formatShortDate(isoDate: string): string {
  const parsed = fromIsoDate(isoDate)
  if (Number.isNaN(parsed.getTime())) return isoDate
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatScheduleBlockRange(startIso: string, endIso: string): string {
  const start = fromIsoDate(startIso)
  const end = fromIsoDate(endIso)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startIso} - ${endIso}`
  }
  const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endLabel = end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  return `${startLabel} - ${endLabel}`
}
