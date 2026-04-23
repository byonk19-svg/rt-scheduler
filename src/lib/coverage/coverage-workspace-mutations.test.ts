import { describe, expect, it } from 'vitest'

import {
  applyCoverageAssignedShift,
  getCoverageAssignErrorMessage,
  removeCoverageShiftFromDays,
  toCoverageShiftItem,
  updateCoverageShiftStatusInDays,
} from '@/lib/coverage/coverage-workspace-mutations'
import type { DayItem } from '@/lib/coverage/selectors'

const baseDay: DayItem = {
  id: '2026-04-20',
  isoDate: '2026-04-20',
  date: 20,
  label: 'Mon, Apr 20',
  dayStatus: 'missing_lead',
  constraintBlocked: false,
  leadShift: null,
  staffShifts: [
    {
      id: 'staff-b',
      userId: 'user-b',
      name: 'Blair',
      status: 'active',
      log: [],
    },
  ],
}

describe('coverage workspace mutation helpers', () => {
  it('builds duplicate-assignment error copy', () => {
    expect(getCoverageAssignErrorMessage({ code: '23505' }, 'Casey')).toBe(
      'Casey is already assigned on this day.'
    )
  })

  it('maps an inserted shift row into a UI shift item', () => {
    expect(
      toCoverageShiftItem(
        {
          id: 'shift-1',
          user_id: 'user-1',
          status: 'scheduled',
          assignment_status: 'scheduled',
        },
        'Avery'
      )
    ).toEqual({
      id: 'shift-1',
      userId: 'user-1',
      name: 'Avery',
      status: 'active',
      log: [],
    })
  })

  it('applies assigned staff shifts in name order and promotes lead assignments', () => {
    const nextStaffShift = {
      id: 'staff-a',
      userId: 'user-a',
      name: 'Alex',
      status: 'active' as const,
      log: [],
    }
    const nextLeadShift = {
      id: 'lead-a',
      userId: 'lead-a',
      name: 'Jordan',
      status: 'active' as const,
      log: [],
    }

    const withStaff = applyCoverageAssignedShift([baseDay], baseDay.id, nextStaffShift, 'staff')
    expect(withStaff[0]?.staffShifts.map((shift) => shift.name)).toEqual(['Alex', 'Blair'])

    const withLead = applyCoverageAssignedShift([baseDay], baseDay.id, nextLeadShift, 'lead')
    expect(withLead[0]?.leadShift?.name).toBe('Jordan')
    expect(withLead[0]?.dayStatus).toBe('published')
  })

  it('rolls forward and back optimistic status changes', () => {
    const days: DayItem[] = [
      {
        ...baseDay,
        leadShift: {
          id: 'lead-1',
          userId: 'lead-user',
          name: 'Morgan',
          status: 'active',
          log: [],
        },
      },
    ]

    const optimistic = updateCoverageShiftStatusInDays({
      days,
      dayId: baseDay.id,
      shiftId: 'lead-1',
      isLead: true,
      nextStatus: 'cancelled',
      previousStatus: 'active',
      changeTime: '09:15',
      mode: 'optimistic',
    })

    expect(optimistic[0]?.leadShift?.status).toBe('cancelled')
    expect(optimistic[0]?.leadShift?.log).toHaveLength(1)

    const rolledBack = updateCoverageShiftStatusInDays({
      days: optimistic,
      dayId: baseDay.id,
      shiftId: 'lead-1',
      isLead: true,
      nextStatus: 'cancelled',
      previousStatus: 'active',
      changeTime: '09:15',
      mode: 'rollback',
    })

    expect(rolledBack[0]?.leadShift?.status).toBe('active')
    expect(rolledBack[0]?.leadShift?.log).toHaveLength(0)
  })

  it('removes assigned shifts from the correct day slot', () => {
    const removed = removeCoverageShiftFromDays([baseDay], baseDay.id, 'staff-b', false)
    expect(removed[0]?.staffShifts).toEqual([])
  })
})
