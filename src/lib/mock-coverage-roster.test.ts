import { describe, expect, it } from 'vitest'

import {
  DEMO_CYCLE,
  DEMO_STAFF,
  assignShift,
  buildRosterWeeks,
  createEmptyAssignments,
  getAssignmentsForShift,
  splitStaffByRoster,
  unassignShift,
} from '@/lib/mock-coverage-roster'

describe('buildRosterWeeks', () => {
  it('builds the full inclusive six-week cycle without shifting the first or last day', () => {
    const weeks = buildRosterWeeks(DEMO_CYCLE.startDate, DEMO_CYCLE.endDate)

    expect(weeks).toHaveLength(6)
    expect(weeks[0]?.label).toBe('WEEK 1 • MAY 3')
    expect(weeks[0]?.days[0]?.isoDate).toBe('2026-05-03')
    expect(weeks[5]?.days[6]?.isoDate).toBe('2026-06-13')
  })
})

describe('splitStaffByRoster', () => {
  it('keeps the exact core and PRN roster names in separate sections', () => {
    const sections = splitStaffByRoster(DEMO_STAFF)

    expect(sections.core.map((staff) => staff.name)).toEqual([
      'Adrienne Solt',
      'Barbara Cummings',
      'Brianna Yonkin',
      'Kim Suarez',
      'Aleyce Lariviere',
      'Layne Wilson',
      'Lynn Snow',
      'Tannie Brooks',
    ])

    expect(sections.prn.map((staff) => staff.name)).toEqual(['Irene Yanez', 'Lisa Miller'])
  })
})

describe('assignment state', () => {
  it('assigns and unassigns a roster cell deterministically by staff, date, and shift', () => {
    const emptyAssignments = createEmptyAssignments()
    const withAssignment = assignShift(emptyAssignments, {
      staffId: 'adrienne-solt',
      shiftType: 'day',
      isoDate: '2026-05-03',
    })

    expect(getAssignmentsForShift(withAssignment, 'day')).toHaveLength(1)
    expect(getAssignmentsForShift(withAssignment, 'day')[0]).toMatchObject({
      staffId: 'adrienne-solt',
      isoDate: '2026-05-03',
      shiftType: 'day',
      status: 'assigned',
    })

    const cleared = unassignShift(withAssignment, {
      staffId: 'adrienne-solt',
      shiftType: 'day',
      isoDate: '2026-05-03',
    })

    expect(getAssignmentsForShift(cleared, 'day')).toHaveLength(0)
  })
})
