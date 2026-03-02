import { dateRange } from '@/lib/calendar-utils'
import type { AssignmentStatus, ShiftRole, ShiftStatus } from '@/lib/shift-types'
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

/**
 * Minimal shape required by buildDayItems. Callers pre-resolve `name` from
 * the raw DB profile join so this module stays free of Supabase types.
 */
export type BuildDayRowInput = {
  id: string
  user_id: string
  date: string
  shift_type: 'day' | 'night'
  role: ShiftRole
  status: ShiftStatus
  assignment_status: AssignmentStatus | null
  name: string
}

/**
 * Maps a flat list of assigned shift rows into an ordered DayItem[] spanning
 * the full cycle date range. Pure function — no React state, fully testable.
 */
export function buildDayItems(
  shiftType: 'day' | 'night',
  rows: BuildDayRowInput[],
  cycleStartDate: string,
  cycleEndDate: string,
  constraintBlockedSlotKeys: Set<string>
): DayItem[] {
  const byDate = new Map<string, BuildDayRowInput[]>()
  for (const row of rows) {
    if (row.shift_type !== shiftType) continue
    const bucket = byDate.get(row.date) ?? []
    bucket.push(row)
    byDate.set(row.date, bucket)
  }

  return dateRange(cycleStartDate, cycleEndDate).map((isoDate) => {
    const slot = (byDate.get(isoDate) ?? []).slice().sort((a, b) => {
      if (a.role !== b.role) return a.role === 'lead' ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    const leadRow = slot.find((row) => row.role === 'lead') ?? null
    const leadShift: ShiftItem | null =
      leadRow === null
        ? null
        : {
            id: leadRow.id,
            userId: leadRow.user_id,
            name: leadRow.name,
            status: toUiStatus(leadRow.assignment_status, leadRow.status),
            log: [],
          }

    const staffShifts: ShiftItem[] = slot
      .filter((row) => row.id !== leadRow?.id)
      .map((row) => ({
        id: row.id,
        userId: row.user_id,
        name: row.name,
        status: toUiStatus(row.assignment_status, row.status),
        log: [],
      }))

    const hasOverride = slot.some((row) => row.status === 'called_off')
    const hasDraft = slot.some((row) => row.status === 'sick')
    const dayStatus: DayStatus = !leadShift
      ? 'missing_lead'
      : hasOverride
        ? 'override'
        : hasDraft
          ? 'draft'
          : 'published'

    const date = new Date(`${isoDate}T00:00:00`)
    return {
      id: isoDate,
      isoDate,
      date: date.getDate(),
      label: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      dayStatus,
      constraintBlocked: constraintBlockedSlotKeys.has(`${isoDate}:${shiftType}`),
      leadShift,
      staffShifts,
    } satisfies DayItem
  })
}

/**
 * Converts raw DB status fields to the single UiStatus used by the coverage UI.
 * Exported so callers can re-use the same mapping (e.g. optimistic updates).
 */
export function toUiStatus(assignment: AssignmentStatus | null, status: ShiftStatus): UiStatus {
  if (assignment === 'on_call') return 'oncall'
  if (assignment === 'left_early') return 'leave_early'
  if (assignment === 'call_in' || assignment === 'cancelled') return 'cancelled'
  if (assignment === 'scheduled') return 'active'
  if (status === 'on_call') return 'oncall'
  if (status === 'sick' || status === 'called_off') return 'cancelled'
  return 'active'
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
