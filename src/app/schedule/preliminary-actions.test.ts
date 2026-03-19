import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  redirectMock,
  revalidatePathMock,
  createClientMock,
  sendPreliminarySnapshotMock,
  notifyUsersMock,
  writeAuditLogMock,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
  revalidatePathMock: vi.fn(),
  createClientMock: vi.fn(),
  sendPreliminarySnapshotMock: vi.fn(),
  notifyUsersMock: vi.fn(),
  writeAuditLogMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}))

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

vi.mock('@/lib/preliminary-schedule/mutations', () => ({
  sendPreliminarySnapshot: sendPreliminarySnapshotMock,
}))

vi.mock('@/lib/notifications', () => ({
  notifyUsers: notifyUsersMock,
}))

vi.mock('@/lib/audit-log', () => ({
  writeAuditLog: writeAuditLogMock,
}))

import { sendPreliminaryScheduleAction } from '@/app/schedule/actions'

type TestContext = {
  userId?: string | null
  role?: string | null
  cyclePublished?: boolean
  activeSnapshotId?: string | null
}

function makeFormData() {
  const formData = new FormData()
  formData.set('cycle_id', 'cycle-1')
  formData.set('view', 'week')
  formData.set('return_to', 'coverage')
  formData.set('show_unavailable', 'false')
  return formData
}

function createSupabaseMock(context: TestContext) {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: context.userId ? { id: context.userId } : null,
        },
      })),
    },
    from(table: string) {
      const filters = new Map<string, unknown>()
      let selected = '*'

      const builder = {
        select(selection?: string) {
          selected = selection ?? '*'
          return builder
        },
        eq(column: string, value: unknown) {
          filters.set(column, value)
          return builder
        },
        in(column: string, value: unknown[]) {
          filters.set(column, value)
          return builder
        },
        order() {
          return builder
        },
        async maybeSingle() {
          if (table === 'profiles' && selected === 'role' && filters.get('id') === context.userId) {
            return { data: { role: context.role }, error: null }
          }

          if (table === 'schedule_cycles') {
            return {
              data: {
                id: 'cycle-1',
                label: 'April schedule',
                start_date: '2026-04-01',
                end_date: '2026-04-30',
                published: Boolean(context.cyclePublished),
              },
              error: null,
            }
          }

          if (table === 'preliminary_snapshots') {
            return {
              data: context.activeSnapshotId
                ? {
                    id: context.activeSnapshotId,
                    cycle_id: 'cycle-1',
                    sent_at: '2026-03-19T10:00:00.000Z',
                    status: 'active',
                  }
                : null,
              error: null,
            }
          }

          return { data: null, error: null }
        },
        then(resolve: (value: { data: unknown; error: null }) => unknown) {
          if (table === 'shifts') {
            return Promise.resolve(
              resolve({
                data: [
                  {
                    id: 'shift-1',
                    cycle_id: 'cycle-1',
                    user_id: 'therapist-1',
                    date: '2026-04-02',
                    shift_type: 'day',
                    status: 'scheduled',
                    role: 'staff',
                    profiles: { full_name: 'Barbara C.' },
                  },
                  {
                    id: 'shift-2',
                    cycle_id: 'cycle-1',
                    user_id: null,
                    date: '2026-04-03',
                    shift_type: 'day',
                    status: 'scheduled',
                    role: 'staff',
                    profiles: null,
                  },
                ],
                error: null,
              })
            )
          }

          if (
            table === 'profiles' &&
            Array.isArray(filters.get('role')) &&
            filters.get('is_active') === true
          ) {
            return Promise.resolve(
              resolve({
                data: [{ id: 'therapist-1' }, { id: 'lead-1' }],
                error: null,
              })
            )
          }

          return Promise.resolve(resolve({ data: [], error: null }))
        },
      }

      return builder
    },
  }
}

describe('sendPreliminaryScheduleAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sendPreliminarySnapshotMock.mockResolvedValue({
      data: {
        id: 'snapshot-1',
        cycle_id: 'cycle-1',
        created_by: 'manager-1',
        sent_at: '2026-03-19T10:30:00.000Z',
        status: 'active',
        created_at: '2026-03-19T10:30:00.000Z',
      },
      error: null,
    })
  })

  it('lets a manager send a preliminary schedule for a draft cycle', async () => {
    createClientMock.mockResolvedValue(
      createSupabaseMock({
        userId: 'manager-1',
        role: 'manager',
        cyclePublished: false,
      })
    )

    await expect(sendPreliminaryScheduleAction(makeFormData())).rejects.toThrow(
      'REDIRECT:/coverage?cycle=cycle-1&success=preliminary_sent'
    )

    expect(sendPreliminarySnapshotMock).toHaveBeenCalledTimes(1)
    expect(notifyUsersMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'preliminary_sent',
      })
    )
    expect(revalidatePathMock).toHaveBeenCalledWith('/preliminary')
  })

  it('denies non-managers', async () => {
    createClientMock.mockResolvedValue(
      createSupabaseMock({
        userId: 'therapist-1',
        role: 'therapist',
      })
    )

    await expect(sendPreliminaryScheduleAction(makeFormData())).rejects.toThrow(
      'REDIRECT:/schedule'
    )

    expect(sendPreliminarySnapshotMock).not.toHaveBeenCalled()
  })

  it('treats a repeat send as a refresh of the active snapshot', async () => {
    createClientMock.mockResolvedValue(
      createSupabaseMock({
        userId: 'manager-1',
        role: 'manager',
        activeSnapshotId: 'snapshot-existing',
      })
    )

    await expect(sendPreliminaryScheduleAction(makeFormData())).rejects.toThrow(
      'REDIRECT:/coverage?cycle=cycle-1&success=preliminary_refreshed'
    )

    expect(sendPreliminarySnapshotMock).toHaveBeenCalledTimes(1)
  })
})
