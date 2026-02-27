import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from '@/app/api/schedule/drag-drop/route'
import { createClient } from '@/lib/supabase/server'
import { setDesignatedLeadMutation } from '@/lib/set-designated-lead'
import { notifyUsers } from '@/lib/notifications'
import { writeAuditLog } from '@/lib/audit-log'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/set-designated-lead', () => ({
  setDesignatedLeadMutation: vi.fn(),
}))

vi.mock('@/lib/notifications', () => ({
  notifyUsers: vi.fn(async () => undefined),
}))

vi.mock('@/lib/audit-log', () => ({
  writeAuditLog: vi.fn(async () => undefined),
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
  availabilityRows?: Array<{
    therapist_id: string
    cycle_id: string
    date: string
    override_type: 'force_off' | 'force_on'
    shift_type: 'day' | 'night' | 'both'
    note: string | null
  }>
  therapistProfiles?: Record<
    string,
    {
      role?: string
      is_lead_eligible?: boolean
      full_name?: string
      employment_type?: 'full_time' | 'part_time' | 'prn'
      max_work_days_per_week?: number
    }
  >
  insertError?: { code?: string; message?: string } | null
}

function makeSupabaseMock(scenario: Scenario) {
  const cycle = {
    id: 'cycle-1',
    start_date: '2026-03-01',
    end_date: '2026-03-31',
  }

  const insertedShiftPayloads: Array<Record<string, unknown>> = []

  const auth = {
    getUser: async () => ({ data: { user: { id: 'manager-1' } } }),
  }

  const profileById = (id: string) => {
    if (id === 'manager-1') {
      return {
        role: 'manager',
        is_lead_eligible: false,
        full_name: 'Manager',
        employment_type: 'full_time',
        max_work_days_per_week: 3,
      }
    }
    if (id === 'therapist-lead') {
      return {
        role: scenario.leadTherapistRole ?? 'therapist',
        is_lead_eligible: scenario.leadTherapistEligible ?? true,
        full_name: 'Lead Therapist',
        employment_type: 'full_time',
        max_work_days_per_week: 3,
      }
    }
    const custom = scenario.therapistProfiles?.[id]
    if (custom) {
      return {
        role: custom.role ?? 'therapist',
        is_lead_eligible: custom.is_lead_eligible ?? false,
        full_name: custom.full_name ?? id,
        employment_type: custom.employment_type ?? 'full_time',
        max_work_days_per_week: custom.max_work_days_per_week ?? 3,
      }
    }
    return {
      role: 'therapist',
      is_lead_eligible: false,
      full_name: id,
      employment_type: 'full_time',
      max_work_days_per_week: 3,
    }
  }

  const from = (table: string) => {
    const state: {
      table: string
      op: 'select' | 'insert' | 'update' | 'delete'
      filters: Record<string, unknown>
      insertPayload?: Record<string, unknown>
    } = { table, op: 'select', filters: {} }

    const resolveSelect = (single: boolean) => {
      if (table === 'profiles') {
        if (typeof state.filters.id === 'string') {
          return { data: profileById(state.filters.id), error: null }
        }
        return { data: single ? null : [], error: null }
      }

      if (table === 'schedule_cycles') {
        return { data: cycle, error: null }
      }

      if (table === 'availability_overrides') {
        const rows = (scenario.availabilityRows ?? []).filter((row) => {
          if (state.filters.therapist_id && row.therapist_id !== state.filters.therapist_id) return false
          if (state.filters.cycle_id && row.cycle_id !== state.filters.cycle_id) return false
          if (state.filters.date && row.date !== state.filters.date) return false
          return true
        })
        return { data: rows, error: null }
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

        if (state.op === 'insert' && single) {
          if (scenario.insertError) {
            return { data: null, error: scenario.insertError }
          }
          return { data: { id: 'shift-new-1' }, error: null }
        }

        return { data: single ? null : [], error: null }
      }

      return { data: single ? null : [], error: null }
    }

    const resolveMutation = () => ({ data: null, error: null })

    const builder: {
      select: (columns?: string) => typeof builder
      eq: (column: string, value: unknown) => typeof builder
      neq: (column: string, value: unknown) => typeof builder
      gte: (column: string, value: unknown) => typeof builder
      lte: (column: string, value: unknown) => typeof builder
      maybeSingle: () => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>
      single: () => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>
      insert: (payload: Record<string, unknown>) => typeof builder
      update: (payload: unknown) => typeof builder
      delete: () => typeof builder
      then: <TResult1 = { data: unknown; error: { code?: string; message?: string } | null }, TResult2 = never>(
        onfulfilled?:
          | ((value: { data: unknown; error: { code?: string; message?: string } | null }) => TResult1 | PromiseLike<TResult1>)
          | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
      ) => Promise<TResult1 | TResult2>
    } = {
      select: () => {
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
      single: async () => resolveSelect(true),
      insert: (payload) => {
        state.op = 'insert'
        state.insertPayload = payload
        insertedShiftPayloads.push(payload)
        return builder
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
        const result = state.op === 'select' ? Promise.resolve(resolveSelect(false)) : Promise.resolve(resolveMutation())
        return result.then(onfulfilled, onrejected)
      },
    }

    return builder
  }

  return { auth, from, insertedShiftPayloads }
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
      }) as unknown as Awaited<ReturnType<typeof createClient>>
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
      }) as unknown as Awaited<ReturnType<typeof createClient>>
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

  it('returns 409 availability conflict when therapist marked unavailable and no override provided', async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseMock({
        coverageStatuses: ['scheduled', 'scheduled'],
        weeklyShifts: [],
        therapistProfiles: {
          'therapist-1': {
            full_name: 'Alex Jones',
            employment_type: 'full_time',
          },
        },
        availabilityRows: [
          {
            therapist_id: 'therapist-1',
            cycle_id: 'cycle-1',
            date: '2026-03-10',
            override_type: 'force_off',
            shift_type: 'both',
            note: 'Vacation',
          },
        ],
      }) as unknown as Awaited<ReturnType<typeof createClient>>
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
      code: 'availability_conflict',
      availability: {
        therapistName: 'Alex Jones',
        reason: 'Force off override',
      },
    })
  })

  it('assigns unavailable therapist when override confirmed and records override metadata', async () => {
    const supabase = makeSupabaseMock({
      coverageStatuses: ['scheduled', 'scheduled'],
      weeklyShifts: [],
      therapistProfiles: {
        'therapist-1': {
          full_name: 'Alex Jones',
          employment_type: 'full_time',
        },
      },
      availabilityRows: [
        {
          therapist_id: 'therapist-1',
          cycle_id: 'cycle-1',
          date: '2026-03-10',
          override_type: 'force_off',
          shift_type: 'both',
          note: 'Doctor appointment',
        },
      ],
    })
    vi.mocked(createClient).mockResolvedValue(supabase as unknown as Awaited<ReturnType<typeof createClient>>)

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
          availabilityOverride: true,
          availabilityOverrideReason: 'Coverage emergency',
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(supabase.insertedShiftPayloads[0]).toMatchObject({
      availability_override: true,
      availability_override_reason: 'Coverage emergency',
      availability_override_by: 'manager-1',
    })
    expect(writeAuditLog).toHaveBeenCalled()
    expect(notifyUsers).toHaveBeenCalled()
  })

  it('does not block PRN assignment when no AVAILABLE entry exists (soft warning path)', async () => {
    const supabase = makeSupabaseMock({
      coverageStatuses: ['scheduled'],
      weeklyShifts: [],
      therapistProfiles: {
        'therapist-1': {
          full_name: 'PRN Alex',
          employment_type: 'prn',
        },
      },
      availabilityRows: [],
    })
    vi.mocked(createClient).mockResolvedValue(supabase as unknown as Awaited<ReturnType<typeof createClient>>)

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

    expect(response.status).toBe(200)
    expect(supabase.insertedShiftPayloads[0]).toMatchObject({
      availability_override: false,
      availability_override_reason: null,
    })
  })

  it('sets designated lead when therapist is eligible', async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseMock({
        coverageStatuses: ['scheduled', 'scheduled'],
        weeklyShifts: [],
        leadTherapistEligible: true,
        existingShiftForLead: { id: 'shift-existing', status: 'scheduled' },
      }) as unknown as Awaited<ReturnType<typeof createClient>>
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
      }) as unknown as Awaited<ReturnType<typeof createClient>>
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
      }) as unknown as Awaited<ReturnType<typeof createClient>>
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
      }) as unknown as Awaited<ReturnType<typeof createClient>>
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
