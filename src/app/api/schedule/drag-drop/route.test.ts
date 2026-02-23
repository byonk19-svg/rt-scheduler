import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from '@/app/api/schedule/drag-drop/route'
import { createClient } from '@/lib/supabase/server'
import { setDesignatedLeadMutation } from '@/lib/set-designated-lead'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/set-designated-lead', () => ({
  setDesignatedLeadMutation: vi.fn(),
}))

type Scenario = {
  coverageStatuses: Array<'scheduled' | 'on_call' | 'sick' | 'called_off'>
  weeklyShifts: Array<{ date: string; status: 'scheduled' | 'on_call' | 'sick' | 'called_off' }>
  leadTherapistEligible?: boolean
  leadTherapistRole?: 'therapist' | 'manager'
  existingShiftForLead?: { id: string; status: 'scheduled' | 'on_call' | 'sick' | 'called_off' } | null
  removableShift?: {
    id: string
    cycle_id: string
    user_id: string
    date: string
    shift_type: 'day' | 'night'
    role: 'lead' | 'staff'
  } | null
}

function makeSupabaseMock(scenario: Scenario) {
  const cycle = {
    id: 'cycle-1',
    start_date: '2026-03-01',
    end_date: '2026-03-31',
  }

  const auth = {
    getUser: async () => ({ data: { user: { id: 'manager-1' } } }),
  }

  const from = (table: string) => {
    const state: {
      table: string
      op: 'select' | 'insert' | 'update' | 'delete'
      filters: Record<string, unknown>
    } = { table, op: 'select', filters: {} }

    const resolveSelect = (single: boolean) => {
      if (table === 'profiles') {
        if (state.filters.id === 'manager-1') {
          return { data: { role: 'manager' }, error: null }
        }
        if (state.filters.id === 'therapist-lead') {
          return {
            data: {
              id: 'therapist-lead',
              role: scenario.leadTherapistRole ?? 'therapist',
              is_lead_eligible: scenario.leadTherapistEligible ?? true,
              max_work_days_per_week: 3,
              employment_type: 'full_time',
            },
            error: null,
          }
        }
        return { data: { max_work_days_per_week: 3, employment_type: 'full_time' }, error: null }
      }

      if (table === 'schedule_cycles') {
        return { data: cycle, error: null }
      }

      if (table === 'shifts') {
        const hasCoverageFilters =
          typeof state.filters.cycle_id === 'string' &&
          typeof state.filters.date === 'string' &&
          typeof state.filters.shift_type === 'string'
        const hasUserIdFilter = typeof state.filters.user_id === 'string'
        const hasWeeklyFilters =
          hasUserIdFilter &&
          typeof state.filters['gte:date'] === 'string' &&
          typeof state.filters['lte:date'] === 'string'

        if (single && state.filters.id === 'shift-1') {
          return {
            data:
              scenario.removableShift ?? {
                id: 'shift-1',
                cycle_id: 'cycle-1',
                user_id: 'therapist-1',
                date: '2026-03-10',
                shift_type: 'day',
                role: 'staff',
              },
            error: null,
          }
        }

        if (single && hasCoverageFilters && hasUserIdFilter) {
          return { data: scenario.existingShiftForLead ?? null, error: null }
        }

        if (hasCoverageFilters && !hasUserIdFilter) {
          return {
            data: scenario.coverageStatuses.map((status, idx) => ({ id: `coverage-${idx}`, status })),
            error: null,
          }
        }

        if (hasWeeklyFilters) {
          return { data: scenario.weeklyShifts, error: null }
        }

        return { data: single ? null : [], error: null }
      }

      return { data: single ? null : [], error: null }
    }

    const resolveMutation = () => ({ error: null })

    const builder: {
      select: (columns: string) => typeof builder
      eq: (column: string, value: unknown) => typeof builder
      neq: (column: string, value: unknown) => typeof builder
      gte: (column: string, value: unknown) => typeof builder
      lte: (column: string, value: unknown) => typeof builder
      maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>
      insert: (payload: unknown) => Promise<{ error: { code?: string; message?: string } | null }>
      update: (payload: unknown) => typeof builder
      delete: () => typeof builder
      then: <TResult1 = { data: unknown; error: { message: string } | null }, TResult2 = never>(
        onfulfilled?:
          | ((value: { data: unknown; error: { message: string } | null }) => TResult1 | PromiseLike<TResult1>)
          | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
      ) => Promise<TResult1 | TResult2>
    } = {
      select: () => {
        state.op = 'select'
        return builder
      },
      eq: (column, value) => {
        state.filters[column] = value
        return builder
      },
      neq: (column, value) => {
        state.filters[`neq:${column}`] = value
        return builder
      },
      gte: (column, value) => {
        state.filters[`gte:${column}`] = value
        return builder
      },
      lte: (column, value) => {
        state.filters[`lte:${column}`] = value
        return builder
      },
      maybeSingle: async () => resolveSelect(true),
      insert: async () => {
        state.op = 'insert'
        return resolveMutation()
      },
      update: () => {
        state.op = 'update'
        return builder
      },
      delete: () => {
        state.op = 'delete'
        return builder
      },
      then: (onfulfilled, onrejected) => {
        const result =
          state.op === 'select'
            ? Promise.resolve(resolveSelect(false))
            : Promise.resolve(resolveMutation())
        return result.then(onfulfilled, onrejected)
      },
    }

    return builder
  }

  return { auth, from }
}

describe('drag-drop API behavior', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(setDesignatedLeadMutation).mockResolvedValue({ ok: true })
  })

  it('returns 409 when assign would exceed daily coverage', async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseMock({
        coverageStatuses: ['scheduled', 'scheduled', 'scheduled', 'scheduled', 'scheduled'],
        weeklyShifts: [],
      }) as Awaited<ReturnType<typeof createClient>>
    )

    const response = await POST(
      new Request('http://localhost/api/schedule/drag-drop', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'assign',
          cycleId: 'cycle-1',
          userId: 'therapist-1',
          shiftType: 'day',
          date: '2026-03-10',
          overrideWeeklyRules: false,
        }),
      })
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Each shift can have at most 5 scheduled team members.',
    })
  })

  it('returns 409 when assign would exceed weekly therapist limit', async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseMock({
        coverageStatuses: ['scheduled', 'scheduled'],
        weeklyShifts: [
          { date: '2026-03-08', status: 'scheduled' },
          { date: '2026-03-09', status: 'scheduled' },
          { date: '2026-03-11', status: 'on_call' },
        ],
      }) as Awaited<ReturnType<typeof createClient>>
    )

    const response = await POST(
      new Request('http://localhost/api/schedule/drag-drop', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'assign',
          cycleId: 'cycle-1',
          userId: 'therapist-1',
          shiftType: 'day',
          date: '2026-03-10',
          overrideWeeklyRules: false,
        }),
      })
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Therapists are limited to 3 day(s) per week unless override is enabled.',
    })
  })

  it('sets designated lead when therapist is eligible', async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseMock({
        coverageStatuses: ['scheduled', 'scheduled'],
        weeklyShifts: [],
        leadTherapistEligible: true,
        existingShiftForLead: { id: 'shift-existing', status: 'scheduled' },
      }) as Awaited<ReturnType<typeof createClient>>
    )

    const response = await POST(
      new Request('http://localhost/api/schedule/drag-drop', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'set_lead',
          cycleId: 'cycle-1',
          therapistId: 'therapist-lead',
          shiftType: 'day',
          date: '2026-03-10',
          overrideWeeklyRules: false,
        }),
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      message: 'Designated lead updated.',
    })
    expect(setDesignatedLeadMutation).toHaveBeenCalledWith(expect.anything(), {
      cycleId: 'cycle-1',
      therapistId: 'therapist-lead',
      date: '2026-03-10',
      shiftType: 'day',
    })
  })

  it('blocks designated lead when therapist is not eligible', async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseMock({
        coverageStatuses: ['scheduled'],
        weeklyShifts: [],
        leadTherapistEligible: false,
      }) as Awaited<ReturnType<typeof createClient>>
    )

    const response = await POST(
      new Request('http://localhost/api/schedule/drag-drop', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'set_lead',
          cycleId: 'cycle-1',
          therapistId: 'therapist-lead',
          shiftType: 'day',
          date: '2026-03-10',
          overrideWeeklyRules: false,
        }),
      })
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Only lead-eligible therapists can be designated as lead.',
    })
    expect(setDesignatedLeadMutation).not.toHaveBeenCalled()
  })

  it('surfaces designated lead conflict from mutation', async () => {
    vi.mocked(setDesignatedLeadMutation).mockResolvedValue({
      ok: false,
      reason: 'multiple_leads_prevented',
    })
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseMock({
        coverageStatuses: ['scheduled'],
        weeklyShifts: [],
        leadTherapistEligible: true,
        existingShiftForLead: { id: 'shift-existing', status: 'scheduled' },
      }) as Awaited<ReturnType<typeof createClient>>
    )

    const response = await POST(
      new Request('http://localhost/api/schedule/drag-drop', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'set_lead',
          cycleId: 'cycle-1',
          therapistId: 'therapist-lead',
          shiftType: 'day',
          date: '2026-03-10',
          overrideWeeklyRules: false,
        }),
      })
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      error: 'A designated lead already exists for that shift.',
    })
  })

  it('removes a shift by shiftId and returns undo payload', async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseMock({
        coverageStatuses: [],
        weeklyShifts: [],
        removableShift: {
          id: 'shift-1',
          cycle_id: 'cycle-1',
          user_id: 'therapist-2',
          date: '2026-03-12',
          shift_type: 'night',
          role: 'staff',
        },
      }) as Awaited<ReturnType<typeof createClient>>
    )

    const response = await POST(
      new Request('http://localhost/api/schedule/drag-drop', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'remove',
          cycleId: 'cycle-1',
          shiftId: 'shift-1',
        }),
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      message: 'Shift removed from schedule.',
      undoAction: {
        action: 'assign',
        cycleId: 'cycle-1',
        userId: 'therapist-2',
        shiftType: 'night',
        date: '2026-03-12',
        overrideWeeklyRules: true,
      },
    })
  })
})

