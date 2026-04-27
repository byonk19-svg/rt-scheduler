import { describe, expect, it } from 'vitest'

import {
  DEMO_CYCLE,
  DEMO_STAFF,
  assignShift,
  buildRosterWeeks,
  createEmptyAssignments,
  createEmptyAvailabilityApprovals,
  getAssignmentsForShift,
  hasAvailabilityApprovalsForShift,
  resolveMockRosterCellDisplay,
  setAvailabilityApproval,
  splitStaffByRoster,
  unassignShift,
} from '@/lib/mock-coverage-roster'

describe('buildRosterWeeks', () => {
  it('builds the full inclusive six-week cycle without shifting the first or last day', () => {
    const weeks = buildRosterWeeks(DEMO_CYCLE.startDate, DEMO_CYCLE.endDate)

    expect(weeks).toHaveLength(6)
    expect(weeks[0]?.label).toBe('May 3 – May 9')
    expect(weeks[0]?.days[0]?.isoDate).toBe('2026-05-03')
    expect(weeks[5]?.days[6]?.isoDate).toBe('2026-06-13')
  })

  it('marks Sunday and Saturday as weekend days', () => {
    const weeks = buildRosterWeeks('2026-05-03', '2026-05-09')
    const days = weeks[0]?.days ?? []
    expect(days[0]?.isWeekend).toBe(true) // Sunday May 3
    expect(days[1]?.isWeekend).toBe(false) // Monday May 4
    expect(days[6]?.isWeekend).toBe(true) // Saturday May 9
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

describe('resolveMockRosterCellDisplay', () => {
  it('shows OFF when approved off even if a mock assignment exists', () => {
    expect(
      resolveMockRosterCellDisplay(
        {
          id: 'x',
          staffId: 'a',
          isoDate: '2026-05-01',
          shiftType: 'day',
          status: 'assigned',
          assignmentStatus: null,
        },
        'approved_off'
      )
    ).toEqual({ value: 'OFF', countsTowardDayTally: false })
  })

  it('shows 1 for approved work without an assignment', () => {
    expect(resolveMockRosterCellDisplay(null, 'approved_work')).toEqual({
      value: '1',
      countsTowardDayTally: true,
    })
  })

  it('shows 1 for a scheduled assignment', () => {
    expect(
      resolveMockRosterCellDisplay(
        {
          id: 'y',
          staffId: 'b',
          isoDate: '2026-05-02',
          shiftType: 'day',
          status: 'assigned',
          assignmentStatus: 'scheduled',
        },
        null
      )
    ).toEqual({ value: '1', countsTowardDayTally: true })
  })

  it('shows OC for on_call assignment', () => {
    expect(
      resolveMockRosterCellDisplay(
        {
          id: 'z',
          staffId: 'c',
          isoDate: '2026-05-03',
          shiftType: 'day',
          status: 'assigned',
          assignmentStatus: 'on_call',
        },
        null
      )
    ).toEqual({ value: 'OC', countsTowardDayTally: true })
  })

  it('shows CX for cancelled assignment and does not count toward tally', () => {
    expect(
      resolveMockRosterCellDisplay(
        {
          id: 'w',
          staffId: 'd',
          isoDate: '2026-05-04',
          shiftType: 'day',
          status: 'assigned',
          assignmentStatus: 'cancelled',
        },
        null
      )
    ).toEqual({ value: 'CX', countsTowardDayTally: false })
  })

  it('shows empty string when no assignment and no approval', () => {
    expect(resolveMockRosterCellDisplay(null, null)).toEqual({
      value: '',
      countsTowardDayTally: false,
    })
  })
})

describe('hasAvailabilityApprovalsForShift', () => {
  it('returns true only when the store contains a key for that shift', () => {
    const empty = createEmptyAvailabilityApprovals()
    expect(hasAvailabilityApprovalsForShift(empty, 'day')).toBe(false)

    const withDay = setAvailabilityApproval(empty, {
      staffId: 's',
      isoDate: '2026-05-03',
      shiftType: 'day',
      kind: 'approved_off',
    })
    expect(hasAvailabilityApprovalsForShift(withDay, 'day')).toBe(true)
    expect(hasAvailabilityApprovalsForShift(withDay, 'night')).toBe(false)
  })
})
