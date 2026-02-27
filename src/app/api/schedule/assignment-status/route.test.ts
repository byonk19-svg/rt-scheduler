import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from '@/app/api/schedule/assignment-status/route'
import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

type Scenario = {
  userId?: string | null
  role?: string
  isLeadEligible?: boolean
  rpcError?: { code?: string; message: string } | null
  rpcData?: Array<Record<string, unknown>>
}

function makeSupabaseMock(scenario: Scenario) {
  const rpc = vi.fn().mockResolvedValue({
    data:
      scenario.rpcData ?? [
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
        if (table !== 'profiles') {
          return { data: null, error: null }
        }

        if (!state.id || scenario.userId === null) {
          return { data: null, error: null }
        }

        return {
          data: {
            role: scenario.role ?? 'therapist',
            is_lead_eligible: scenario.isLeadEligible ?? false,
          },
          error: null,
        }
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

  it('allows a lead-equivalent therapist to update status', async () => {
    const supabase = makeSupabaseMock({ role: 'therapist', isLeadEligible: true, userId: 'lead-1' })
    vi.mocked(createClient).mockResolvedValue(supabase as unknown as Awaited<ReturnType<typeof createClient>>)

    const response = await POST(
      new Request('http://localhost/api/schedule/assignment-status', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
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
  })

  it('denies staff from updating status', async () => {
    const supabase = makeSupabaseMock({ role: 'therapist', isLeadEligible: false, userId: 'staff-1' })
    vi.mocked(createClient).mockResolvedValue(supabase as unknown as Awaited<ReturnType<typeof createClient>>)

    const response = await POST(
      new Request('http://localhost/api/schedule/assignment-status', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
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
    const supabase = makeSupabaseMock({ role: 'manager', isLeadEligible: false, userId: 'manager-1' })
    vi.mocked(createClient).mockResolvedValue(supabase as unknown as Awaited<ReturnType<typeof createClient>>)

    const response = await POST(
      new Request('http://localhost/api/schedule/assignment-status', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          assignmentId: 'shift-1',
          status: 'cancelled',
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(supabase.rpc).toHaveBeenCalledOnce()
  })

  it('enforces site scope via RPC errors', async () => {
    const supabase = makeSupabaseMock({
      role: 'manager',
      userId: 'manager-1',
      rpcError: { code: '42501', message: 'Assignment is outside your site scope.' },
    })
    vi.mocked(createClient).mockResolvedValue(supabase as unknown as Awaited<ReturnType<typeof createClient>>)

    const response = await POST(
      new Request('http://localhost/api/schedule/assignment-status', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          assignmentId: 'shift-1',
          status: 'on_call',
        }),
      })
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Assignment is outside your site scope.',
    })
  })
})
