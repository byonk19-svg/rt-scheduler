import { describe, expect, it } from 'vitest'

import {
  buildTherapistWorkloadCounts,
  getWeekBoundsForDate,
  type WorkloadShift,
} from '@/lib/therapist-picker-metrics'

describe('therapist picker workload metrics', () => {
  it('calculates week and cycle counts from one cycle-wide shift list', () => {
    const weekBounds = getWeekBoundsForDate('2026-03-11')
    expect(weekBounds).not.toBeNull()

    const shifts: WorkloadShift[] = [
      { userId: 'a', date: '2026-03-08', status: 'scheduled' },
      { userId: 'a', date: '2026-03-09', status: 'on_call' },
      { userId: 'a', date: '2026-03-09', status: 'scheduled' }, // same day should count once
      { userId: 'a', date: '2026-03-01', status: 'scheduled' },
      { userId: 'a', date: '2026-03-12', status: 'called_off' }, // excluded
      { userId: 'b', date: '2026-03-10', status: 'scheduled' },
      { userId: 'b', date: '2026-03-14', status: 'scheduled' },
      { userId: 'b', date: '2026-03-21', status: 'scheduled' },
      { userId: 'c', date: '2026-03-11', status: 'sick' }, // excluded
    ]

    const counts = buildTherapistWorkloadCounts({
      shifts,
      weekStart: weekBounds?.weekStart ?? '2026-03-08',
      weekEnd: weekBounds?.weekEnd ?? '2026-03-14',
      cycleStart: '2026-03-01',
      cycleEnd: '2026-03-21',
    })

    expect(counts.get('a')).toEqual({ weekShiftCount: 2, cycleShiftCount: 3 })
    expect(counts.get('b')).toEqual({ weekShiftCount: 2, cycleShiftCount: 3 })
    expect(counts.has('c')).toBe(false)
  })
})
