import { describe, expect, it } from 'vitest'

import {
  buildPlannerDefaultRowsForCycle,
  buildPlannerSavePayload,
  getPlannerDateValidationError,
  mergePlannerRowsWithDefaults,
  splitPlannerDatesByMode,
  toOverrideType,
  toPlannerMode,
  type PlannerOverrideRow,
} from '@/lib/availability-planner'
import { normalizeWorkPattern } from '@/lib/coverage/work-patterns'

function buildOverride(overrides?: Partial<PlannerOverrideRow>): PlannerOverrideRow {
  return {
    id: 'override-1',
    date: '2026-03-28',
    shift_type: 'day',
    override_type: 'force_on',
    note: null,
    source: 'manager',
    ...overrides,
  }
}

describe('availability planner helpers', () => {
  it('maps override types to manager-facing planner modes', () => {
    expect(toPlannerMode('force_on')).toBe('will_work')
    expect(toPlannerMode('force_off')).toBe('cannot_work')
    expect(toOverrideType('will_work')).toBe('force_on')
    expect(toOverrideType('cannot_work')).toBe('force_off')
  })

  it('groups overrides into will-work and cannot-work date buckets', () => {
    const grouped = splitPlannerDatesByMode([
      buildOverride({
        id: 'override-1',
        date: '2026-03-28',
        override_type: 'force_on',
      }),
      buildOverride({
        id: 'override-2',
        date: '2026-03-30',
        override_type: 'force_off',
      }),
    ])

    expect(grouped.willWork).toEqual(['2026-03-28'])
    expect(grouped.cannotWork).toEqual(['2026-03-30'])
    expect(grouped.byDate.get('2026-03-28')).toEqual([
      {
        id: 'override-1',
        mode: 'will_work',
        shiftType: 'day',
        note: null,
        source: 'manager',
      },
    ])
  })

  it('can limit grouped planner dates to manager-entered rows only', () => {
    const grouped = splitPlannerDatesByMode(
      [
        buildOverride({
          id: 'override-1',
          date: '2026-03-28',
          override_type: 'force_on',
          source: 'manager',
        }),
        buildOverride({
          id: 'override-2',
          date: '2026-03-29',
          override_type: 'force_on',
          source: 'therapist',
        }),
      ],
      { source: 'manager' }
    )

    expect(grouped.willWork).toEqual(['2026-03-28'])
    expect(grouped.byDate.has('2026-03-29')).toBe(false)
  })

  it('builds unique manager save payload rows with source=manager', () => {
    expect(
      buildPlannerSavePayload({
        cycleId: 'cycle-1',
        therapistId: 'therapist-1',
        shiftType: 'night',
        mode: 'cannot_work',
        dates: ['2026-03-29', '2026-03-29', '2026-03-31'],
        note: ' hard block ',
        managerId: 'manager-1',
      })
    ).toEqual([
      {
        cycle_id: 'cycle-1',
        therapist_id: 'therapist-1',
        date: '2026-03-29',
        shift_type: 'night',
        override_type: 'force_off',
        note: 'hard block',
        created_by: 'manager-1',
        source: 'manager',
      },
      {
        cycle_id: 'cycle-1',
        therapist_id: 'therapist-1',
        date: '2026-03-31',
        shift_type: 'night',
        override_type: 'force_off',
        note: 'hard block',
        created_by: 'manager-1',
        source: 'manager',
      },
    ])
  })

  it('builds planner default rows from weekly work patterns', () => {
    const defaults = buildPlannerDefaultRowsForCycle({
      therapistId: 'therapist-1',
      cycle: { start_date: '2026-03-01', end_date: '2026-03-07' },
      pattern: normalizeWorkPattern({
        therapist_id: 'therapist-1',
        works_dow: [1, 3],
        offs_dow: [4],
        weekend_rotation: 'none',
        weekend_anchor_date: null,
        works_dow_mode: 'hard',
      }),
    })

    expect(defaults).toEqual([
      expect.objectContaining({
        id: 'pattern-on:therapist-1:2026-03-02',
        date: '2026-03-02',
        override_type: 'force_on',
        removable: false,
        derivedFromPattern: true,
      }),
      expect.objectContaining({
        id: 'pattern-on:therapist-1:2026-03-04',
        date: '2026-03-04',
        override_type: 'force_on',
        removable: false,
        derivedFromPattern: true,
      }),
      expect.objectContaining({
        id: 'pattern-off:therapist-1:2026-03-05',
        date: '2026-03-05',
        override_type: 'force_off',
        removable: false,
        derivedFromPattern: true,
      }),
    ])
  })

  it('marks alternating on-weekends as will-work defaults instead of blocking off-weekends', () => {
    const defaults = buildPlannerDefaultRowsForCycle({
      therapistId: 'therapist-1',
      cycle: { start_date: '2026-03-07', end_date: '2026-03-15' },
      pattern: normalizeWorkPattern({
        therapist_id: 'therapist-1',
        works_dow: [],
        offs_dow: [],
        weekend_rotation: 'every_other',
        weekend_anchor_date: '2026-03-07',
        works_dow_mode: 'hard',
      }),
    })

    expect(defaults).toEqual([
      expect.objectContaining({
        id: 'pattern-on:therapist-1:2026-03-07',
        date: '2026-03-07',
        override_type: 'force_on',
        note: 'Weekly pattern default: alternating weekend on',
        removable: false,
        derivedFromPattern: true,
      }),
      expect.objectContaining({
        id: 'pattern-on:therapist-1:2026-03-08',
        date: '2026-03-08',
        override_type: 'force_on',
        note: 'Weekly pattern default: alternating weekend on',
        removable: false,
        derivedFromPattern: true,
      }),
    ])
  })

  it('lets explicit planner overrides replace same-date weekly defaults', () => {
    const explicit = [
      buildOverride({
        id: 'override-1',
        date: '2026-03-05',
        override_type: 'force_on',
      }),
    ]
    const defaults = [
      {
        id: 'pattern-off:therapist-1:2026-03-05',
        date: '2026-03-05',
        shift_type: 'both' as const,
        override_type: 'force_off' as const,
        note: 'Weekly pattern default: never works this weekday',
        source: 'manager' as const,
        removable: false,
        derivedFromPattern: true,
      },
      {
        id: 'pattern-on:therapist-1:2026-03-06',
        date: '2026-03-06',
        shift_type: 'both' as const,
        override_type: 'force_on' as const,
        note: 'Weekly pattern default: usually works this weekday',
        source: 'manager' as const,
        removable: false,
        derivedFromPattern: true,
      },
    ]

    expect(mergePlannerRowsWithDefaults(explicit, defaults)).toEqual([
      expect.objectContaining({
        id: 'override-1',
        date: '2026-03-05',
        override_type: 'force_on',
      }),
      expect.objectContaining({
        id: 'pattern-on:therapist-1:2026-03-06',
        date: '2026-03-06',
        override_type: 'force_on',
      }),
    ])
  })

  it('validates planner state before save', () => {
    expect(
      getPlannerDateValidationError({
        cycle: null,
        therapistId: 'therapist-1',
        dates: ['2026-03-28'],
      })
    ).toBe('Select a schedule cycle first.')

    expect(
      getPlannerDateValidationError({
        cycle: { start_date: '2026-03-22', end_date: '2026-05-02' },
        therapistId: '',
        dates: ['2026-03-28'],
      })
    ).toBe('Select a therapist first.')

    expect(
      getPlannerDateValidationError({
        cycle: { start_date: '2026-03-22', end_date: '2026-05-02' },
        therapistId: 'therapist-1',
        dates: [],
      })
    ).toBe('Select at least one date.')

    expect(
      getPlannerDateValidationError({
        cycle: { start_date: '2026-03-22', end_date: '2026-05-02' },
        therapistId: 'therapist-1',
        dates: ['2026-03-28', '2026-03-28'],
      })
    ).toBe('Date selections must be unique before saving.')

    expect(
      getPlannerDateValidationError({
        cycle: { start_date: '2026-03-22', end_date: '2026-05-02' },
        therapistId: 'therapist-1',
        dates: ['2026-05-05'],
      })
    ).toBe('All selected dates must fall within the chosen cycle.')
  })
})
