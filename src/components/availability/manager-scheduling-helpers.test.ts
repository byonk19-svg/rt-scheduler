import { describe, expect, it } from 'vitest'

import {
  buildDayStates,
  getCycleLabel,
  getSavedBucketsForSelection,
  type ManagerAvailabilityEntryRow,
  type ManagerPlannerOverrideRecord,
} from '@/components/availability/manager-scheduling-helpers'

describe('manager scheduling helpers', () => {
  it('filters saved overrides to the selected therapist and cycle using only manager-authored rows', () => {
    const overrides: ManagerPlannerOverrideRecord[] = [
      {
        id: 'override-1',
        cycle_id: 'cycle-a',
        therapist_id: 'therapist-a',
        date: '2026-04-20',
        shift_type: 'day',
        override_type: 'force_on',
        note: null,
        source: 'manager',
      },
      {
        id: 'override-2',
        cycle_id: 'cycle-a',
        therapist_id: 'therapist-a',
        date: '2026-04-21',
        shift_type: 'day',
        override_type: 'force_off',
        note: null,
        source: 'therapist',
      },
      {
        id: 'override-3',
        cycle_id: 'cycle-b',
        therapist_id: 'therapist-a',
        date: '2026-04-22',
        shift_type: 'day',
        override_type: 'force_off',
        note: null,
        source: 'manager',
      },
      {
        id: 'override-4',
        cycle_id: 'cycle-a',
        therapist_id: 'therapist-b',
        date: '2026-04-23',
        shift_type: 'day',
        override_type: 'force_off',
        note: null,
        source: 'manager',
      },
    ]

    expect(getSavedBucketsForSelection(overrides, 'cycle-a', 'therapist-a')).toMatchObject({
      willWork: ['2026-04-20'],
      cannotWork: [],
    })
  })

  it('builds day states from saved planner data, current draft selections, and inbox requests', () => {
    const therapistRequestRows: ManagerAvailabilityEntryRow[] = [
      {
        id: 'request-1',
        therapistId: 'therapist-a',
        cycleId: 'cycle-a',
        date: '2026-04-20',
        reason: null,
        createdAt: '2026-04-18T08:00:00Z',
        requestedBy: 'therapist-a',
        entryType: 'force_off',
      },
      {
        id: 'request-2',
        therapistId: 'therapist-a',
        cycleId: 'cycle-a',
        date: '2026-04-20',
        reason: null,
        createdAt: '2026-04-18T08:10:00Z',
        requestedBy: 'therapist-a',
        entryType: 'force_on',
      },
    ]

    expect(
      buildDayStates({
        savedBuckets: {
          willWork: ['2026-04-20'],
          cannotWork: ['2026-04-22'],
        },
        selectedDates: ['2026-04-20', '2026-04-21'],
        mode: 'cannot_work',
        therapistRequestRows,
      })
    ).toEqual({
      '2026-04-20': {
        savedPlanner: 'will_work',
        draftSelection: 'cannot_work',
        requestTypes: ['need_off', 'request_to_work'],
      },
      '2026-04-21': {
        draftSelection: 'cannot_work',
      },
      '2026-04-22': {
        savedPlanner: 'cannot_work',
      },
    })
  })

  it('formats the cycle label and falls back cleanly when no cycle is selected', () => {
    expect(
      getCycleLabel({
        start_date: '2026-04-20',
        end_date: '2026-05-31',
      })
    ).toBe('Apr 20 – May 31, 2026')
    expect(getCycleLabel(null, 'No cycle selected')).toBe('No cycle selected')
  })
})
