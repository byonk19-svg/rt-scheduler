import { describe, expect, it } from 'vitest'

import {
  buildPlannerSavePayload,
  getPlannerDateValidationError,
  splitPlannerDatesByMode,
  toOverrideType,
  toPlannerMode,
  type PlannerOverrideRow,
} from '@/lib/availability-planner'

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
