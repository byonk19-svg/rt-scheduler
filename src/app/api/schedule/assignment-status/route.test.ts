import { beforeEach, describe, expect, it, vi } from 'vitest'

const { notifyPublishedShiftStatusChangedMock, notifyUsersMock, createAdminClientMock } =
  vi.hoisted(() => ({
    notifyPublishedShiftStatusChangedMock: vi.fn(async () => undefined),
    notifyUsersMock: vi.fn(async () => undefined),
    createAdminClientMock: vi.fn(),
  }))

import { POST } from '@/app/api/schedule/assignment-status/route'
import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}))

vi.mock('@/lib/published-schedule-notifications', () => ({
  notifyPublishedShiftStatusChanged: notifyPublishedShiftStatusChangedMock,
}))

vi.mock('@/lib/notifications', () => ({
  notifyUsers: notifyUsersMock,
}))

type Scenario = {
  userId?: string | null
  role?: string
  isActive?: boolean | null
  archivedAt?: string | null
  profilesData?: Array<{ id: string; shift_type: 'day' | 'night' | null }>
  scheduledRows?: Array<{ user_id: string | null }>
  existingCallInPostId?: string | null
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
    const state: {
      id?: string
      filters: Record<string, unknown>
      inFilters: Record<string, unknown[]>
    } = { filters: {}, inFilters: {} }

    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        state.filters[column] = value
        if (column === 'id' && typeof value === 'string') {
          state.id = value
        }
        return builder
      },
      in: (column: string, value: unknown[]) => {
        state.inFilters[column] = value
        return builder
      },
      maybeSingle: async () => {
        if (table === 'profiles') {
          if (state.id && scenario.userId !== null) {
            return {
              data: {
                role: scenario.role ?? 'therapist',
                is_active: scenario.isActive ?? true,
                archived_at: scenario.archivedAt ?? null,
              },
              error: null,
            }
          }

          if (scenario.userId === null) {
            return { data: null, error: null }
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
      then: (resolve: (value: unknown) => unknown) => {
        if (table === 'profiles') {
          return Promise.resolve(
            resolve({
              data: scenario.profilesData ?? [],
              error: null,
            })
          )
        }

        if (table === 'shifts') {
          if ('date' in state.filters && 'shift_type' in state.filters && !state.id) {
            return Promise.resolve(
              resolve({
                data: scenario.scheduledRows ?? [],
                error: null,
              })
            )
          }
        }

        return Promise.resolve(resolve({ data: [], error: null }))
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

function makeAdminClientMock(scenario: Scenario) {
  const updateCalls: Array<{ payload: Record<string, unknown>; id: string | null }> = []
  const insertCalls: Array<Record<string, unknown>> = []

  const from = (table: string) => {
    if (table !== 'shift_posts') {
      throw new Error(`Unexpected admin table ${table}`)
    }

    const state: { id: string | null } = { id: null }
    let pendingPayload: Record<string, unknown> | null = null

    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        if (column === 'id' && typeof value === 'string') {
          state.id = value
        }
        return builder
      },
      maybeSingle: async () => ({
        data: scenario.existingCallInPostId ? { id: scenario.existingCallInPostId } : null,
        error: null,
      }),
      update: (payload: Record<string, unknown>) => {
        pendingPayload = payload
        return builder
      },
      insert: (payload: Record<string, unknown>) => {
        insertCalls.push(payload)
        return {
          select: () => ({
            single: async () => ({
              data: { id: 'call-in-post-1' },
              error: null,
            }),
          }),
        }
      },
      then: (resolve: (value: unknown) => unknown) => {
        if (pendingPayload) {
          updateCalls.push({ payload: pendingPayload, id: state.id })
        }
        return Promise.resolve(resolve({ data: null, error: null }))
      },
    }

    return builder
  }

  return {
    client: { from },
    updateCalls,
    insertCalls,
  }
}

describe('assignment status API', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    createAdminClientMock.mockReturnValue(makeAdminClientMock({}).client)
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

  it('creates a call-in help alert and notifies eligible therapists with a shift-post target', async () => {
    const supabase = makeSupabaseMock({
      role: 'lead',
      userId: 'lead-1',
      shiftLookup: {
        date: '2026-02-23',
        shift_type: 'night',
        user_id: 'therapist-1',
        published: true,
      },
      profilesData: [
        { id: 'therapist-1', shift_type: 'night' },
        { id: 'therapist-2', shift_type: 'night' },
        { id: 'lead-2', shift_type: 'night' },
      ],
      scheduledRows: [{ user_id: 'lead-2' }],
    })
    const admin = makeAdminClientMock({})
    createAdminClientMock.mockReturnValue(admin.client)
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

    expect(response.status).toBe(200)
    expect(admin.insertCalls).toHaveLength(1)
    expect(admin.insertCalls[0]).toMatchObject({
      shift_id: 'shift-1',
      request_kind: 'call_in',
      type: 'pickup',
      visibility: 'team',
      status: 'pending',
    })
    expect(notifyUsersMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userIds: ['therapist-2'],
        eventType: 'call_in_help_available',
        targetType: 'shift_post',
        targetId: 'call-in-post-1',
      })
    )
  })

  it('expires an open call-in alert when the published assignment status changes away from call_in', async () => {
    const supabase = makeSupabaseMock({
      role: 'manager',
      userId: 'manager-1',
      shiftLookup: {
        date: '2026-02-23',
        shift_type: 'day',
        user_id: 'therapist-1',
        published: true,
      },
      existingCallInPostId: 'call-in-post-9',
      rpcData: [
        {
          id: 'shift-1',
          assignment_status: 'scheduled',
          status_note: null,
          left_early_time: null,
          status_updated_at: '2026-02-23T18:00:00.000Z',
          status_updated_by: 'manager-1',
          status_updated_by_name: 'Manager User',
        },
      ],
    })
    const admin = makeAdminClientMock({ existingCallInPostId: 'call-in-post-9' })
    createAdminClientMock.mockReturnValue(admin.client)
    vi.mocked(createClient).mockResolvedValue(
      supabase as unknown as Awaited<ReturnType<typeof createClient>>
    )

    const response = await POST(
      new Request('http://localhost/api/schedule/assignment-status', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost' },
        body: JSON.stringify({
          assignmentId: 'shift-1',
          status: 'scheduled',
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(admin.updateCalls).toContainEqual({
      id: 'call-in-post-9',
      payload: expect.objectContaining({
        status: 'expired',
      }),
    })
    expect(notifyUsersMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'call_in_help_available',
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
