import type { ShiftRole } from '@/app/schedule/types'

export type DragAction =
  | {
      action: 'assign'
      cycleId: string
      userId: string
      shiftType: 'day' | 'night'
      date: string
      role?: ShiftRole
      overrideWeeklyRules: boolean
      availabilityOverride?: boolean
      availabilityOverrideReason?: string
    }
  | {
      action: 'move'
      cycleId: string
      shiftId: string
      targetDate: string
      targetShiftType: 'day' | 'night'
      overrideWeeklyRules: boolean
      availabilityOverride?: boolean
      availabilityOverrideReason?: string
    }
  | {
      action: 'remove'
      cycleId: string
      shiftId: string
    }
  | {
      action: 'remove'
      cycleId: string
      userId: string
      date: string
      shiftType: 'day' | 'night'
    }
  | {
      action: 'set_lead'
      cycleId: string
      therapistId: string
      date: string
      shiftType: 'day' | 'night'
      overrideWeeklyRules: boolean
      availabilityOverride?: boolean
      availabilityOverrideReason?: string
    }

function parseRequiredString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

function parseDateString(value: unknown): string | null {
  const date = parseRequiredString(value)
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null

  const [yearPart, monthPart, dayPart] = date.split('-')
  const year = Number(yearPart)
  const month = Number(monthPart)
  const day = Number(dayPart)
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

  if (month < 1 || month > 12) return null
  if (day < 1 || day > (daysInMonth[month - 1] ?? 0)) return null

  return date
}

function parseAvailabilityOverrideReason(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  return value.trim() || undefined
}

export function parseActionBody(raw: unknown): DragAction | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const cycleId = parseRequiredString(r.cycleId)
  if (!cycleId) return null

  switch (r.action) {
    case 'assign': {
      const userId = parseRequiredString(r.userId)
      const date = parseDateString(r.date)
      if (!userId) return null
      if (r.shiftType !== 'day' && r.shiftType !== 'night') return null
      if (!date) return null
      return {
        action: 'assign',
        cycleId,
        userId,
        shiftType: r.shiftType,
        date,
        role: r.role === 'lead' || r.role === 'staff' ? r.role : undefined,
        overrideWeeklyRules: r.overrideWeeklyRules === true,
        availabilityOverride:
          typeof r.availabilityOverride === 'boolean' ? r.availabilityOverride : undefined,
        availabilityOverrideReason: parseAvailabilityOverrideReason(r.availabilityOverrideReason),
      }
    }
    case 'move': {
      const shiftId = parseRequiredString(r.shiftId)
      const targetDate = parseDateString(r.targetDate)
      if (!shiftId) return null
      if (!targetDate) return null
      if (r.targetShiftType !== 'day' && r.targetShiftType !== 'night') return null
      return {
        action: 'move',
        cycleId,
        shiftId,
        targetDate,
        targetShiftType: r.targetShiftType,
        overrideWeeklyRules: r.overrideWeeklyRules === true,
        availabilityOverride:
          typeof r.availabilityOverride === 'boolean' ? r.availabilityOverride : undefined,
        availabilityOverrideReason: parseAvailabilityOverrideReason(r.availabilityOverrideReason),
      }
    }
    case 'remove': {
      const shiftId = parseRequiredString(r.shiftId)
      if (shiftId) {
        return {
          action: 'remove',
          cycleId,
          shiftId,
        }
      }

      const userId = parseRequiredString(r.userId)
      const date = parseDateString(r.date)
      if (userId && date && (r.shiftType === 'day' || r.shiftType === 'night')) {
        return {
          action: 'remove',
          cycleId,
          userId,
          date,
          shiftType: r.shiftType,
        }
      }
      return null
    }
    case 'set_lead': {
      const therapistId = parseRequiredString(r.therapistId)
      const date = parseDateString(r.date)
      if (!therapistId) return null
      if (!date) return null
      if (r.shiftType !== 'day' && r.shiftType !== 'night') return null
      return {
        action: 'set_lead',
        cycleId,
        therapistId,
        date,
        shiftType: r.shiftType,
        overrideWeeklyRules: r.overrideWeeklyRules === true,
        availabilityOverride:
          typeof r.availabilityOverride === 'boolean' ? r.availabilityOverride : undefined,
        availabilityOverrideReason: parseAvailabilityOverrideReason(r.availabilityOverrideReason),
      }
    }
    default:
      return null
  }
}
