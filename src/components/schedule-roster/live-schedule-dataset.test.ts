import { describe, expect, it } from 'vitest'

import { createAssignmentKey } from '@/lib/mock-coverage-roster'
import { buildLiveScheduleDataset } from '@/components/schedule-roster/live-schedule-dataset'

const live = {
  cycleId: 'cycle-1',
  label: 'Cycle Alpha',
  startDate: '2026-05-03',
  endDate: '2026-05-04',
  shortLabel: 'May 3 - May 4, 2026',
  isPublished: false,
  defaultShiftType: 'day' as const,
  availableCycles: [{ id: 'cycle-1', label: 'Cycle Alpha' }],
  staff: [
    {
      id: 'day-core',
      name: 'Day Core',
      roleLabel: 'Therapist' as const,
      rosterKind: 'core' as const,
      shiftType: 'day' as const,
    },
    {
      id: 'day-prn',
      name: 'Day PRN',
      roleLabel: 'Therapist' as const,
      rosterKind: 'prn' as const,
      shiftType: 'day' as const,
    },
    {
      id: 'night-core',
      name: 'Night Core',
      roleLabel: 'Therapist' as const,
      rosterKind: 'core' as const,
      shiftType: 'night' as const,
    },
  ],
  assignments: {
    [createAssignmentKey('day-core', '2026-05-03', 'day')]: {
      id: 'shift-1',
      staffId: 'day-core',
      isoDate: '2026-05-03',
      shiftType: 'day' as const,
      status: 'assigned' as const,
      assignmentStatus: null,
    },
    [createAssignmentKey('day-prn', '2026-05-04', 'day')]: {
      id: 'shift-2',
      staffId: 'day-prn',
      isoDate: '2026-05-04',
      shiftType: 'day' as const,
      status: 'assigned' as const,
      assignmentStatus: 'on_call' as const,
    },
    [createAssignmentKey('night-core', '2026-05-03', 'night')]: {
      id: 'shift-3',
      staffId: 'night-core',
      isoDate: '2026-05-03',
      shiftType: 'night' as const,
      status: 'assigned' as const,
      assignmentStatus: 'call_in' as const,
    },
  },
  availabilityApprovals: {
    [createAssignmentKey('day-core', '2026-05-04', 'day')]: 'approved_off' as const,
    [createAssignmentKey('day-prn', '2026-05-03', 'day')]: 'approved_work' as const,
    [createAssignmentKey('night-core', '2026-05-04', 'night')]: 'approved_off' as const,
  },
}

describe('buildLiveScheduleDataset', () => {
  it('renders only the selected day-shift staff and maps availability plus assignment codes', () => {
    const dataset = buildLiveScheduleDataset(live, 'day')

    expect(dataset.cycleLabel).toContain('Cycle Alpha')
    expect(dataset.coreRows.map((row) => row.name)).toEqual(['Day Core'])
    expect(dataset.prnRows.map((row) => row.name)).toEqual(['Day PRN'])
    expect(dataset.coreRows[0]?.codes).toEqual(['1', 'OFF'])
    expect(dataset.prnRows[0]?.codes).toEqual(['1', 'OC'])
    expect(dataset.coreCounts).toEqual([1, 0])
    expect(dataset.prnCounts).toEqual([1, 1])
  })

  it('renders only the selected night-shift staff and preserves live status codes', () => {
    const dataset = buildLiveScheduleDataset(live, 'night')

    expect(dataset.coreRows.map((row) => row.name)).toEqual(['Night Core'])
    expect(dataset.prnRows).toEqual([])
    expect(dataset.coreRows[0]?.codes).toEqual(['CI', 'OFF'])
    expect(dataset.coreCounts).toEqual([1, 0])
    expect(dataset.prnCounts).toEqual([0, 0])
  })
})
