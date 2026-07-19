import { describe, expect, it } from 'vitest'

import {
  buildStaffScheduleBlockView,
  type StaffScheduleBlockShiftRow,
} from '@/lib/staff-my-schedule'

const baseCycle = {
  id: 'cycle-1',
  label: 'July Block',
  start_date: '2026-07-19',
  end_date: '2026-08-29',
  published: false,
  status: 'preliminary',
}

function shift(row: Partial<StaffScheduleBlockShiftRow>): StaffScheduleBlockShiftRow {
  return {
    id: row.id ?? 'shift-1',
    cycle_id: row.cycle_id ?? 'cycle-1',
    user_id: row.user_id ?? 'therapist-1',
    date: row.date ?? '2026-07-20',
    shift_type: row.shift_type ?? 'day',
    role: row.role ?? 'staff',
    status: row.status ?? 'scheduled',
    assignment_status: row.assignment_status ?? 'scheduled',
    profiles: row.profiles ?? { full_name: 'Dashboard Therapist' },
  }
}

describe('buildStaffScheduleBlockView', () => {
  it('builds a full six-week staff schedule with lead, coworker, and status context', () => {
    const schedule = buildStaffScheduleBlockView({
      cycle: baseCycle,
      todayKey: '2026-07-20',
      userId: 'therapist-1',
      shifts: [
        shift({ id: 'own-day', user_id: 'therapist-1', assignment_status: 'scheduled' }),
        shift({
          id: 'lead-day',
          user_id: 'lead-1',
          role: 'lead',
          profiles: { full_name: 'Lead Avery' },
        }),
        shift({
          id: 'coworker-day',
          user_id: 'therapist-2',
          profiles: { full_name: 'Jordan Lee' },
        }),
        shift({
          id: 'night-other-shift',
          user_id: 'therapist-3',
          date: '2026-07-20',
          shift_type: 'night',
          profiles: { full_name: 'Night Morgan' },
        }),
        shift({
          id: 'own-cancelled',
          user_id: 'therapist-1',
          date: '2026-07-21',
          assignment_status: 'cancelled',
        }),
      ],
    })

    expect(schedule.lifecycleLabel).toBe('Preliminary - review open')
    expect(schedule.days).toHaveLength(42)
    expect(schedule.assignedCount).toBe(2)
    expect(schedule.nextAssignmentDate).toBe('2026-07-20')

    const firstAssignedDay = schedule.days.find((day) => day.date === '2026-07-20')
    expect(firstAssignedDay?.isToday).toBe(true)
    expect(firstAssignedDay?.assignment).toMatchObject({
      shiftType: 'day',
      role: 'staff',
      assignmentStatus: null,
      canRequestChange: false,
      requestGuidance: 'same_day_contact_manager',
      isLead: false,
      leadName: 'Lead Avery',
      coworkerNames: ['Lead Avery', 'Jordan Lee'],
      coworkerCount: 2,
    })

    const cancelledDay = schedule.days.find((day) => day.date === '2026-07-21')
    expect(cancelledDay?.assignment?.assignmentStatus).toBe('cancelled')
    expect(cancelledDay?.assignment?.canRequestChange).toBe(false)
  })

  it('labels final schedules from the published compatibility flag', () => {
    const schedule = buildStaffScheduleBlockView({
      cycle: { ...baseCycle, published: true, status: 'final' },
      todayKey: '2026-07-20',
      userId: 'therapist-1',
      shifts: [],
    })

    expect(schedule.lifecycleLabel).toBe('Final schedule published')
  })

  it('only allows request starts for future normal scheduled assignments', () => {
    const schedule = buildStaffScheduleBlockView({
      cycle: baseCycle,
      todayKey: '2026-07-20',
      userId: 'therapist-1',
      shifts: [
        shift({
          id: 'past-scheduled',
          date: '2026-07-19',
          assignment_status: 'scheduled',
          status: 'scheduled',
        }),
        shift({
          id: 'today-scheduled',
          date: '2026-07-20',
          assignment_status: 'scheduled',
          status: 'scheduled',
        }),
        shift({
          id: 'future-scheduled',
          date: '2026-07-24',
          assignment_status: 'scheduled',
          status: 'scheduled',
        }),
        shift({
          id: 'on-call',
          date: '2026-07-21',
          assignment_status: 'on_call',
          status: 'on_call',
        }),
        shift({
          id: 'left-early',
          date: '2026-07-22',
          assignment_status: 'left_early',
          status: 'scheduled',
        }),
        shift({
          id: 'call-in',
          date: '2026-07-23',
          assignment_status: 'call_in',
          status: 'called_off',
        }),
      ],
    })

    expect(schedule.days.find((day) => day.date === '2026-07-19')?.assignment).toMatchObject({
      id: 'past-scheduled',
      canRequestChange: false,
      requestGuidance: null,
    })
    expect(schedule.days.find((day) => day.date === '2026-07-20')?.assignment).toMatchObject({
      id: 'today-scheduled',
      canRequestChange: false,
      requestGuidance: 'same_day_contact_manager',
    })
    expect(schedule.days.find((day) => day.date === '2026-07-24')?.assignment).toMatchObject({
      id: 'future-scheduled',
      canRequestChange: true,
      requestGuidance: null,
    })
    expect(schedule.days.find((day) => day.date === '2026-07-21')?.assignment).toMatchObject({
      id: 'on-call',
      canRequestChange: false,
      requestGuidance: null,
    })
    expect(schedule.days.find((day) => day.date === '2026-07-22')?.assignment).toMatchObject({
      id: 'left-early',
      canRequestChange: false,
      requestGuidance: null,
    })
    expect(schedule.days.find((day) => day.date === '2026-07-23')?.assignment).toMatchObject({
      id: 'call-in',
      canRequestChange: false,
      requestGuidance: null,
    })
  })
})
