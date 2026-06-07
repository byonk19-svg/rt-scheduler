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

export function parseActionBody(raw: unknown): DragAction | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (typeof r.cycleId !== 'string') return null

  switch (r.action) {
    case 'assign':
      if (typeof r.userId !== 'string') return null
      if (r.shiftType !== 'day' && r.shiftType !== 'night') return null
      if (typeof r.date !== 'string') return null
      return {
        action: 'assign',
        cycleId: r.cycleId,
        userId: r.userId,
        shiftType: r.shiftType,
        date: r.date,
        role: r.role === 'lead' || r.role === 'staff' ? r.role : undefined,
        overrideWeeklyRules: r.overrideWeeklyRules === true,
        availabilityOverride:
          typeof r.availabilityOverride === 'boolean' ? r.availabilityOverride : undefined,
        availabilityOverrideReason:
          typeof r.availabilityOverrideReason === 'string'
            ? r.availabilityOverrideReason
            : undefined,
      }
    case 'move':
      if (typeof r.shiftId !== 'string') return null
      if (typeof r.targetDate !== 'string') return null
      if (r.targetShiftType !== 'day' && r.targetShiftType !== 'night') return null
      return {
        action: 'move',
        cycleId: r.cycleId,
        shiftId: r.shiftId,
        targetDate: r.targetDate,
        targetShiftType: r.targetShiftType,
        overrideWeeklyRules: r.overrideWeeklyRules === true,
        availabilityOverride:
          typeof r.availabilityOverride === 'boolean' ? r.availabilityOverride : undefined,
        availabilityOverrideReason:
          typeof r.availabilityOverrideReason === 'string'
            ? r.availabilityOverrideReason
            : undefined,
      }
    case 'remove':
      if (typeof r.shiftId === 'string') {
        return {
          action: 'remove',
          cycleId: r.cycleId,
          shiftId: r.shiftId,
        }
      }
      if (
        typeof r.userId === 'string' &&
        typeof r.date === 'string' &&
        (r.shiftType === 'day' || r.shiftType === 'night')
      ) {
        return {
          action: 'remove',
          cycleId: r.cycleId,
          userId: r.userId,
          date: r.date,
          shiftType: r.shiftType,
        }
      }
      return null
    case 'set_lead':
      if (typeof r.therapistId !== 'string') return null
      if (typeof r.date !== 'string') return null
      if (r.shiftType !== 'day' && r.shiftType !== 'night') return null
      return {
        action: 'set_lead',
        cycleId: r.cycleId,
        therapistId: r.therapistId,
        date: r.date,
        shiftType: r.shiftType,
        overrideWeeklyRules: r.overrideWeeklyRules === true,
        availabilityOverride:
          typeof r.availabilityOverride === 'boolean' ? r.availabilityOverride : undefined,
        availabilityOverrideReason:
          typeof r.availabilityOverrideReason === 'string'
            ? r.availabilityOverrideReason
            : undefined,
      }
    default:
      return null
  }
}
