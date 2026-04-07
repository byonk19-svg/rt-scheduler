import { describe, expect, it } from 'vitest'

import { resolveCoverageCycle } from '@/lib/coverage/active-cycle'

const cycles = [
  {
    id: 'past-cycle',
    label: 'Past cycle',
    start_date: '2026-01-01',
    end_date: '2026-02-11',
    published: true,
  },
  {
    id: 'current-cycle',
    label: 'Current cycle',
    start_date: '2026-04-01',
    end_date: '2026-05-12',
    published: false,
  },
  {
    id: 'future-cycle',
    label: 'Future cycle',
    start_date: '2026-06-01',
    end_date: '2026-07-12',
    published: true,
  },
]

describe('resolveCoverageCycle', () => {
  it('keeps an explicitly requested cycle when it is visible to the actor', () => {
    expect(
      resolveCoverageCycle({
        cycles,
        cycleIdFromUrl: 'past-cycle',
        role: 'manager',
        todayKey: '2026-04-06',
      })
    ).toMatchObject({ id: 'past-cycle' })
  })

  it('selects the active cycle when no explicit cycle is provided', () => {
    expect(
      resolveCoverageCycle({
        cycles,
        cycleIdFromUrl: null,
        role: 'manager',
        todayKey: '2026-04-06',
      })
    ).toMatchObject({ id: 'current-cycle' })
  })

  it('prefers the earliest active cycle when windows overlap', () => {
    expect(
      resolveCoverageCycle({
        cycles: [
          {
            id: 'later-active',
            label: 'Later active',
            start_date: '2026-03-30',
            end_date: '2026-05-10',
            published: true,
          },
          {
            id: 'earlier-active',
            label: 'Earlier active',
            start_date: '2026-03-23',
            end_date: '2026-05-03',
            published: true,
          },
        ],
        cycleIdFromUrl: null,
        role: 'manager',
        todayKey: '2026-04-07',
      })
    ).toMatchObject({ id: 'earlier-active' })
  })

  it('selects the next upcoming cycle when nothing is active yet', () => {
    expect(
      resolveCoverageCycle({
        cycles,
        cycleIdFromUrl: null,
        role: 'manager',
        todayKey: '2026-05-20',
      })
    ).toMatchObject({ id: 'future-cycle' })
  })

  it('returns null when there is no active or upcoming cycle', () => {
    expect(
      resolveCoverageCycle({
        cycles: cycles.filter((cycle) => cycle.id === 'past-cycle'),
        cycleIdFromUrl: null,
        role: 'manager',
        todayKey: '2026-04-06',
      })
    ).toBeNull()
  })

  it('hides draft cycles from therapists when no published cycle is available', () => {
    expect(
      resolveCoverageCycle({
        cycles: cycles.filter((cycle) => cycle.id === 'current-cycle'),
        cycleIdFromUrl: null,
        role: 'therapist',
        todayKey: '2026-04-06',
      })
    ).toBeNull()
  })
})
