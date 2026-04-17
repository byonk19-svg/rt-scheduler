import { describe, expect, it } from 'vitest'

import {
  getCycleFillRates,
  getForcedDateMisses,
  getSubmissionCompliance,
} from '@/lib/analytics-queries'

function buildSupabaseMock(handlers: Record<string, () => unknown>) {
  return {
    from(table: string) {
      const handler = handlers[table]
      if (!handler) throw new Error(`No mock for table ${table}`)
      return handler()
    },
  }
}

describe('analytics queries', () => {
  it('computes cycle fill rates from scheduled shifts against ideal coverage', async () => {
    const supabase = buildSupabaseMock({
      schedule_cycles: () => ({
        select: () => ({
          order: () => ({
            limit: async () => ({
              data: [
                {
                  id: 'cycle-1',
                  label: 'Apr 2026',
                  start_date: '2026-04-01',
                  end_date: '2026-04-03',
                  shifts: [
                    { status: 'scheduled', shift_type: 'day' },
                    { status: 'scheduled', shift_type: 'night' },
                    { status: 'cancelled', shift_type: 'day' },
                  ],
                },
              ],
            }),
          }),
        }),
      }),
    })

    await expect(getCycleFillRates(supabase as never)).resolves.toEqual([
      {
        cycleId: 'cycle-1',
        label: 'Apr 2026',
        dateRange: '2026-04-01 to 2026-04-03',
        fillPercent: 8,
        scheduledCount: 2,
        totalSlots: 24,
      },
    ])
  })

  it('groups distinct therapist submissions per cycle against total active staff', async () => {
    const supabase = buildSupabaseMock({
      profiles: () => ({
        select: () => ({
          in: () => ({
            eq: async () => ({
              count: 4,
            }),
          }),
        }),
      }),
      therapist_availability_submissions: () => ({
        select: () => ({
          order: async () => ({
            data: [
              { cycle_id: 'cycle-1', therapist_id: 'a', submitted_at: '2026-04-01T00:00:00Z' },
              { cycle_id: 'cycle-1', therapist_id: 'b', submitted_at: '2026-04-01T00:00:00Z' },
              { cycle_id: 'cycle-1', therapist_id: 'b', submitted_at: '2026-04-02T00:00:00Z' },
            ],
          }),
        }),
      }),
      schedule_cycles: () => ({
        select: () => ({
          in: async () => ({
            data: [{ id: 'cycle-1', label: 'Apr 2026' }],
          }),
        }),
      }),
    })

    await expect(getSubmissionCompliance(supabase as never)).resolves.toEqual([
      {
        cycleId: 'cycle-1',
        label: 'Apr 2026',
        submittedCount: 2,
        totalActive: 4,
        compliancePercent: 50,
      },
    ])
  })

  it('marks force-on overrides as missed when no matching shift exists', async () => {
    const supabase = buildSupabaseMock({
      availability_overrides: () => ({
        select: () => ({
          eq: () => ({
            order: async () => ({
              data: [
                {
                  therapist_id: 'ther-1',
                  date: '2026-04-03',
                  cycle_id: 'cycle-1',
                  profiles: { full_name: 'Barbara C.' },
                  schedule_cycles: { label: 'Apr 2026' },
                },
                {
                  therapist_id: 'ther-2',
                  date: '2026-04-04',
                  cycle_id: 'cycle-1',
                  profiles: { full_name: 'Tannie B.' },
                  schedule_cycles: { label: 'Apr 2026' },
                },
              ],
            }),
          }),
        }),
      }),
      shifts: () => ({
        select: () => ({
          in: () => ({
            in: async () => ({
              data: [{ user_id: 'ther-2', date: '2026-04-04' }],
            }),
          }),
        }),
      }),
    })

    await expect(getForcedDateMisses(supabase as never)).resolves.toEqual([
      {
        therapistName: 'Barbara C.',
        date: '2026-04-03',
        cycleLabel: 'Apr 2026',
        missed: true,
      },
      {
        therapistName: 'Tannie B.',
        date: '2026-04-04',
        cycleLabel: 'Apr 2026',
        missed: false,
      },
    ])
  })
})
