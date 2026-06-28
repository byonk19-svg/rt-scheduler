import { describe, expect, it, vi } from 'vitest'

import { validateScheduleMutationLimits } from './validate-limits'
import type { createClient } from '@/lib/supabase/server'

type ScheduleMutationSupabaseClient = Awaited<ReturnType<typeof createClient>>

type TestShiftStatus = 'scheduled' | 'on_call' | 'sick' | 'called_off'

function makeSupabaseMock(scenario: {
  coverageStatuses: TestShiftStatus[]
  weeklyShifts: Array<{ id?: string; date: string; status: TestShiftStatus }>
  weeklyLimit?: number
}) {
  const makeShiftsQuery = () => {
    const filters: Record<string, unknown> = {}
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((column: string, value: unknown) => {
        filters[column] = value
        return query
      }),
      neq: vi.fn((column: string, value: unknown) => {
        filters[`neq:${column}`] = value
        return query
      }),
      gte: vi.fn((column: string, value: unknown) => {
        filters[`gte:${column}`] = value
        return query
      }),
      lte: vi.fn((column: string, value: unknown) => {
        filters[`lte:${column}`] = value
        return query
      }),
      then: (resolve: (value: unknown) => unknown) => {
        const hasCoverageFilters =
          typeof filters.cycle_id === 'string' &&
          typeof filters.date === 'string' &&
          typeof filters.shift_type === 'string'
        const hasWeeklyFilters =
          typeof filters.user_id === 'string' &&
          typeof filters['gte:date'] === 'string' &&
          typeof filters['lte:date'] === 'string'
        const excludedId = filters['neq:id']

        if (hasCoverageFilters) {
          return Promise.resolve({
            data: scenario.coverageStatuses
              .map((status, idx) => ({ id: `coverage-${idx + 1}`, status }))
              .filter((shift) => shift.id !== excludedId),
            error: null,
          }).then(resolve)
        }

        if (hasWeeklyFilters) {
          return Promise.resolve({
            data: scenario.weeklyShifts
              .map((shift, idx) => ({
                id: shift.id ?? `weekly-${idx + 1}`,
                date: shift.date,
                status: shift.status,
              }))
              .filter((shift) => shift.id !== excludedId),
            error: null,
          }).then(resolve)
        }

        return Promise.resolve({ data: [], error: null }).then(resolve)
      },
    }
    return query
  }

  const shiftsQuery = {
    select: vi.fn(() => makeShiftsQuery()),
  }
  const operationalEntriesQuery = {
    select: vi.fn(() => operationalEntriesQuery),
    eq: vi.fn(() => operationalEntriesQuery),
    in: vi.fn(async () => ({ data: [], error: null })),
  }
  const profilesQuery = {
    select: vi.fn(() => profilesQuery),
    eq: vi.fn(() => profilesQuery),
    maybeSingle: vi.fn(async () => ({
      data: {
        max_work_days_per_week: scenario.weeklyLimit ?? 3,
        employment_type: 'full_time',
      },
      error: null,
    })),
  }

  return {
    from: vi.fn((table: string) => {
      if (table === 'shifts') return shiftsQuery
      if (table === 'shift_operational_entries') return operationalEntriesQuery
      if (table === 'profiles') return profilesQuery
      throw new Error(`Unexpected table ${table}`)
    }),
  } as unknown as ScheduleMutationSupabaseClient
}

describe('validateScheduleMutationLimits', () => {
  it('returns coverage_limit_exceeded when a new assignment would overfill a shift', async () => {
    const result = await validateScheduleMutationLimits(
      makeSupabaseMock({
        coverageStatuses: ['scheduled', 'scheduled', 'scheduled', 'scheduled', 'scheduled'],
        weeklyShifts: [],
      }),
      {
        therapistId: 'therapist-1',
        managerSiteId: 'site-a',
        cycleId: 'cycle-1',
        date: '2026-03-10',
        shiftType: 'day',
        overrideWeeklyRules: false,
      }
    )

    expect(result).toEqual({
      ok: false,
      status: 409,
      error: 'Each shift can have at most 5 scheduled team members.',
      code: 'coverage_limit_exceeded',
    })
  })

  it('returns weekly_limit_exceeded when a new assignment would exceed therapist workdays', async () => {
    const result = await validateScheduleMutationLimits(
      makeSupabaseMock({
        coverageStatuses: ['scheduled', 'scheduled'],
        weeklyShifts: [
          { date: '2026-03-08', status: 'scheduled' },
          { date: '2026-03-09', status: 'scheduled' },
          { date: '2026-03-11', status: 'on_call' },
        ],
      }),
      {
        therapistId: 'therapist-1',
        managerSiteId: 'site-a',
        cycleId: 'cycle-1',
        date: '2026-03-10',
        shiftType: 'day',
        overrideWeeklyRules: false,
      }
    )

    expect(result).toEqual({
      ok: false,
      status: 409,
      error: 'Therapists are limited to 3 day(s) per week unless override is enabled.',
      code: 'weekly_limit_exceeded',
    })
  })

  it('allows over-limit assignments when weekly-rule override is enabled', async () => {
    const result = await validateScheduleMutationLimits(
      makeSupabaseMock({
        coverageStatuses: ['scheduled', 'scheduled', 'scheduled', 'scheduled', 'scheduled'],
        weeklyShifts: [
          { date: '2026-03-08', status: 'scheduled' },
          { date: '2026-03-09', status: 'scheduled' },
          { date: '2026-03-11', status: 'on_call' },
        ],
      }),
      {
        therapistId: 'therapist-1',
        managerSiteId: 'site-a',
        cycleId: 'cycle-1',
        date: '2026-03-10',
        shiftType: 'day',
        overrideWeeklyRules: true,
      }
    )

    expect(result).toEqual({ ok: true })
  })

  it('skips limits when moving a shift status that does not count toward weekly workdays', async () => {
    const result = await validateScheduleMutationLimits(
      makeSupabaseMock({
        coverageStatuses: ['scheduled', 'scheduled', 'scheduled', 'scheduled', 'scheduled'],
        weeklyShifts: [
          { date: '2026-03-08', status: 'scheduled' },
          { date: '2026-03-09', status: 'scheduled' },
          { date: '2026-03-11', status: 'on_call' },
        ],
      }),
      {
        therapistId: 'therapist-1',
        managerSiteId: 'site-a',
        cycleId: 'cycle-1',
        date: '2026-03-10',
        shiftType: 'day',
        overrideWeeklyRules: false,
        excludeShiftId: 'shift-1',
        shiftStatus: 'sick',
      }
    )

    expect(result).toEqual({ ok: true })
  })

  it('excludes the moved shift from coverage and weekly counts before validating limits', async () => {
    const result = await validateScheduleMutationLimits(
      makeSupabaseMock({
        coverageStatuses: ['scheduled', 'scheduled', 'scheduled', 'scheduled', 'scheduled'],
        weeklyShifts: [
          { id: 'coverage-1', date: '2026-03-08', status: 'scheduled' },
          { date: '2026-03-09', status: 'scheduled' },
          { date: '2026-03-11', status: 'on_call' },
        ],
      }),
      {
        therapistId: 'therapist-1',
        managerSiteId: 'site-a',
        cycleId: 'cycle-1',
        date: '2026-03-10',
        shiftType: 'day',
        overrideWeeklyRules: false,
        excludeShiftId: 'coverage-1',
        shiftStatus: 'scheduled',
      }
    )

    expect(result).toEqual({ ok: true })
  })
})
