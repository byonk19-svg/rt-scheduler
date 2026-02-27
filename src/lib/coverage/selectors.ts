import type { CoverageUiStatus } from '@/lib/coverage/updateAssignmentStatus'

export type UiStatus = CoverageUiStatus
export type DayStatus = 'published' | 'draft' | 'override' | 'missing_lead'
export type ShiftTab = 'Day' | 'Night'

export type ShiftLog = { from: string; to: UiStatus; toLabel: string; time: string }
export type ShiftItem = { id: string; userId: string; name: string; status: UiStatus; log: ShiftLog[] }
export type DayItem = {
  id: string
  isoDate: string
  date: number
  label: string
  dayStatus: DayStatus
  constraintBlocked: boolean
  leadShift: ShiftItem | null
  staffShifts: ShiftItem[]
}

export function flatten(day: DayItem): Array<ShiftItem & { isLead: boolean }> {
  const lead = day.leadShift ? [{ ...day.leadShift, isLead: true }] : []
  return [...lead, ...day.staffShifts.map((row) => ({ ...row, isLead: false }))]
}

export function countBy(day: DayItem, status: UiStatus): number {
  return flatten(day).filter((row) => row.status === status).length
}

export function countActive(day: DayItem): number {
  return flatten(day).filter((row) => row.status !== 'cancelled').length
}

export function shouldShowMonthTag(index: number, isoDate: string): boolean {
  const parsed = new Date(`${isoDate}T00:00:00`)
  return index === 0 || (!Number.isNaN(parsed.getTime()) && parsed.getDate() === 1)
}
