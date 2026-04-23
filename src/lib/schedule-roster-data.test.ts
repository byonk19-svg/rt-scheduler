import { describe, expect, it } from 'vitest'

import {
  buildAssignmentStoreFromShifts,
  buildAvailabilityApprovalStoreFromWorkPatterns,
  buildAvailabilityApprovalStoreFromSubmittedOverrides,
  splitStaffByRosterAndShift,
} from '@/lib/schedule-roster-data'
import { createAssignmentKey } from '@/lib/mock-coverage-roster'

describe('buildAssignmentStoreFromShifts', () => {
  it('keys assignments by therapist, date, and shift type', () => {
    const store = buildAssignmentStoreFromShifts([
      { id: 'shift-1', user_id: 'u1', date: '2026-05-10', shift_type: 'day' },
    ])
    expect(store[createAssignmentKey('u1', '2026-05-10', 'day')]).toMatchObject({
      staffId: 'u1',
      isoDate: '2026-05-10',
      shiftType: 'day',
    })
  })
})

describe('buildAvailabilityApprovalStoreFromSubmittedOverrides', () => {
  it('applies both day and night keys when shift_type is both', () => {
    const submitted = new Set(['t1'])
    const store = buildAvailabilityApprovalStoreFromSubmittedOverrides(
      [
        {
          therapist_id: 't1',
          date: '2026-05-11',
          shift_type: 'both',
          override_type: 'force_off',
        },
      ],
      submitted
    )
    expect(store[createAssignmentKey('t1', '2026-05-11', 'day')]).toBe('approved_off')
    expect(store[createAssignmentKey('t1', '2026-05-11', 'night')]).toBe('approved_off')
  })

  it('ignores therapists who have not officially submitted for the cycle', () => {
    const store = buildAvailabilityApprovalStoreFromSubmittedOverrides(
      [
        {
          therapist_id: 't-draft',
          date: '2026-05-11',
          shift_type: 'day',
          override_type: 'force_on',
        },
      ],
      new Set()
    )
    expect(Object.keys(store)).toHaveLength(0)
  })
})

describe('buildAvailabilityApprovalStoreFromWorkPatterns', () => {
  it('marks never-work weekdays as blocked off in the roster store', () => {
    const store = buildAvailabilityApprovalStoreFromWorkPatterns(
      [
        {
          therapist_id: 't1',
          works_dow: [1, 2, 3],
          offs_dow: [4],
          weekend_rotation: 'none',
          weekend_anchor_date: null,
          works_dow_mode: 'hard',
          shift_preference: 'either',
        },
      ],
      '2026-05-03',
      '2026-05-10'
    )

    expect(store[createAssignmentKey('t1', '2026-05-07', 'day')]).toBe('pattern_blocked_off')
    expect(store[createAssignmentKey('t1', '2026-05-07', 'night')]).toBe('pattern_blocked_off')
    expect(store[createAssignmentKey('t1', '2026-05-08', 'day')]).toBeUndefined()
  })
})

describe('splitStaffByRosterAndShift', () => {
  const staff = [
    {
      id: 'day-core',
      name: 'Day Core',
      roleLabel: 'Therapist' as const,
      rosterKind: 'core' as const,
      shiftType: 'day' as const,
    },
    {
      id: 'night-core',
      name: 'Night Core',
      roleLabel: 'Therapist' as const,
      rosterKind: 'core' as const,
      shiftType: 'night' as const,
    },
    {
      id: 'day-prn',
      name: 'Day PRN',
      roleLabel: 'Therapist' as const,
      rosterKind: 'prn' as const,
      shiftType: 'day' as const,
    },
  ]

  it('returns only staff assigned to the selected day shift', () => {
    const sections = splitStaffByRosterAndShift(staff, 'day')

    expect(sections.core.map((member) => member.id)).toEqual(['day-core'])
    expect(sections.prn.map((member) => member.id)).toEqual(['day-prn'])
  })

  it('returns only staff assigned to the selected night shift', () => {
    const sections = splitStaffByRosterAndShift(staff, 'night')

    expect(sections.core.map((member) => member.id)).toEqual(['night-core'])
    expect(sections.prn).toEqual([])
  })
})
