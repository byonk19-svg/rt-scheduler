import { beforeEach, describe, expect, it, vi } from 'vitest'

const { notifyPublishedShiftStatusChangedMock, updateAssignmentStatusWithLotteryMock } = vi.hoisted(
  () => ({
    notifyPublishedShiftStatusChangedMock: vi.fn(async () => undefined),
    updateAssignmentStatusWithLotteryMock: vi.fn(
      async ({
        authClient,
        shiftId,
        nextStatus,
        note,
      }: {
        authClient: {
          rpc: (
            fn: string,
            args: {
              p_assignment_id: string
              p_status: string
              p_note: string | null
              p_left_early_time: string | null
            }
          ) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>
        }
        shiftId: string
        nextStatus: string
        note?: string | null
      }) => {
        const rpcResult = await authClient.rpc('update_assignment_status', {
          p_assignment_id: shiftId,
          p_status: nextStatus,
          p_note: note ?? null,
          p_left_early_time: null,
        })

        if (rpcResult.error) {
          return {
            ok: false as const,
            error: rpcResult.error.message ?? 'RPC failed',
            code: rpcResult.error.code,
          }
        }

        return { ok: true as const, previousStatus: 'scheduled' as const }
      }
    ),
  })
)

import { POST } from '@/app/api/schedule/assignment-status/route'
import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({})),
}))

vi.mock('@/lib/published-schedule-notifications', () => ({
  notifyPublishedShiftStatusChanged: notifyPublishedShiftStatusChangedMock,
}))

vi.mock('@/lib/lottery/service', () => ({
  updateAssignmentStatusWithLottery: updateAssignmentStatusWithLotteryMock,
}))

type Scenario = {
  userId?: string | null
  role?: string
  isActive?: boolean | null
  archivedAt?: string | null
  shiftLookup?: {
    date: string
    shift_type: 'day' | 'night'
    user_id: string | null
    published: boolean
  } | null
  rpcError?: { code?: string; message: string } | null
  rpcData?: Array<Record<string, unknown>>
}

function makeSupabaseMock(scenario: Scenario) {
  const rpc = vi.fn().mockResolvedValue({
    data: scenario.rpcData ?? [
      {
        id: 'shift-1',
        assignment_status: 'call_in',
        status_note: 'Traffic',
        left_early_time: null,
        status_updated_at: '2026-02-23T18:00:00.000Z',
        status_updated_by: scenario.userId ?? 'lead-1',
        status_updated_by_name: 'Lead User',
      },
    ],
    error: scenario.rpcError ?? null,
  })

  const auth = {
    getUser: async () => ({
      data: {
        user: scenario.userId === null ? null : { id: scenario.userId ?? 'lead-1' },
      },
    }),
  }

  const from = (table: string) => {
    const state: { id?: string } = {}

    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        if (column === 'id' && typeof value === 'string') {
          state.id = value
        }
        return builder
      },
      maybeSingle: async () => {
        if (table === 'profiles') {
          if (!state.id || scenario.userId === null) {
            return { data: null, error: null }
          }

          return {
            data: {
              role: scenario.role ?? 'therapist',
              is_active: scenario.isActive ?? true,
              archived_at: scenario.archivedAt ?? null,
              full_name: 'Actor User',
              site_id: 'site-1',
              shift_type: 'day',
            },
            error: null,
          }
        }

        if (table === 'shifts') {
          if (!scenario.shiftLookup) {
            return { data: null, error: null }
          }

          return {
            data: {
              id: state.id ?? 'shift-1',
              date: scenario.shiftLookup.date,
              shift_type: scenario.shiftLookup.shift_type,
              user_id: scenario.shiftLookup.user_id,
              schedule_cycles: { published: scenario.shiftLookup.published },
            },
            error: null,
          }
        }

        return { data: null, error: null }
      },
    }

    return builder
  }

  return {
    auth,
    from,
    rpc,
  }
}

describe('assignment status API', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('rejects cross-origin mutation requests', async () => {
    const response = await POST(
      new Request('http://localhost/api/schedule/assignment-status', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
        body: JSON.stringify({
          assignmentId: 'shift-1',
          status: 'call_in',
        }),
      })
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Invalid request origin.',
    })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('allows a lead to update status', async () => {
    const supabase = makeSupabaseMock({ role: 'lead', userId: 'lead-1' })
    vi.mocked(createClient).mockResolvedValue(
      supabase as unknown as Awaited<ReturnType<typeof createClient>>
    )

    const response = await POST(
      new Request('http://localhost/api/schedule/assignment-status', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost' },
        body: JSON.stringify({
          assignmentId: 'shift-1',
          status: 'call_in',
          note: 'Traffic delay',
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(supabase.rpc).toHaveBeenCalledWith('update_assignment_status', {
      p_assignment_id: 'shift-1',
      p_status: 'call_in',
      p_note: 'Traffic delay',
      p_left_early_time: null,
    })
    expect(updateAssignmentStatusWithLotteryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        shiftId: 'shift-1',
        nextStatus: 'call_in',
        note: 'Traffic delay',
        actor: expect.objectContaining({
          userId: 'lead-1',
          role: 'lead',
          siteId: 'site-1',
        }),
      })
    )
    expect(notifyPublishedShiftStatusChangedMock).not.toHaveBeenCalled()
  })

  it('denies staff from updating status', async () => {
    const supabase = makeSupabaseMock({
      role: 'therapist',
      userId: 'staff-1',
    })
    vi.mocked(createClient).mockResolvedValue(
      supabase as unknown as Awaited<ReturnType<typeof createClient>>
    )

    const response = await POST(
      new Request('http://localhost/api/schedule/assignment-status', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost' },
        body: JSON.stringify({
          assignmentId: 'shift-1',
          status: 'call_in',
        }),
      })
    )

    expect(response.status).toBe(403)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('denies inactive leads from updating status', async () => {
    const supabase = makeSupabaseMock({
      role: 'lead',
      userId: 'lead-1',
      isActive: false,
    })
    vi.mocked(createClient).mockResolvedValue(
      supabase as unknown as Awaited<ReturnType<typeof createClient>>
    )

    const response = await POST(
      new Request('http://localhost/api/schedule/assignment-status', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost' },
        body: JSON.stringify({
          assignmentId: 'shift-1',
          status: 'call_in',
        }),
      })
    )

    expect(response.status).toBe(403)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('allows manager to update status', async () => {
    const supabase = makeSupabaseMock({
      role: 'manager',
      userId: 'manager-1',
      shiftLookup: {
        date: '2026-02-23',
        shift_type: 'day',
        user_id: 'therapist-1',
        published: true,
      },
      rpcData: [
        {
          id: 'shift-1',
          assignment_status: 'cancelled',
          status_note: null,
          left_early_time: null,
          status_updated_at: '2026-02-23T18:00:00.000Z',
          status_updated_by: 'manager-1',
          status_updated_by_name: 'Manager User',
        },
      ],
    })
    vi.mocked(createClient).mockResolvedValue(
      supabase as unknown as Awaited<ReturnType<typeof createClient>>
    )

    const response = await POST(
      new Request('http://localhost/api/schedule/assignment-status', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost' },
        body: JSON.stringify({
          assignmentId: 'shift-1',
          status: 'cancelled',
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(supabase.rpc).toHaveBeenCalledOnce()
    expect(notifyPublishedShiftStatusChangedMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        cyclePublished: true,
        userId: 'therapist-1',
        date: '2026-02-23',
        shiftType: 'day',
        nextStatus: 'cancelled',
        targetId: 'shift-1',
      })
    )
  })

  it('enforces site scope via RPC errors', async () => {
    const supabase = makeSupabaseMock({
      role: 'manager',
      userId: 'manager-1',
      rpcError: { code: '42501', message: 'Assignment is outside your site scope.' },
    })
    vi.mocked(createClient).mockResolvedValue(
      supabase as unknown as Awaited<ReturnType<typeof createClient>>
    )

    const response = await POST(
      new Request('http://localhost/api/schedule/assignment-status', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost' },
        body: JSON.stringify({
          assignmentId: 'shift-1',
          status: 'on_call',
        }),
      })
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Not authorized to update this assignment status.',
    })
  })
})
