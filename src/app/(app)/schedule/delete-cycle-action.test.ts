import { beforeEach, describe, expect, it, vi } from 'vitest'

const { redirectMock, revalidatePathMock, createClientMock, createAdminClientMock } = vi.hoisted(
  () => ({
    redirectMock: vi.fn((url: string) => {
      throw new Error(`REDIRECT:${url}`)
    }),
    revalidatePathMock: vi.fn(),
    createClientMock: vi.fn(),
    createAdminClientMock: vi.fn(),
  })
)

vi.mock('next/navigation', () => ({ redirect: redirectMock }))
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))
vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: createAdminClientMock }))

import { deleteCycleAction } from '@/app/schedule/actions'

type TestContext = {
  userId?: string | null
  role?: string | null
  cyclePublished?: boolean
  cycleStatus?: 'draft' | 'preliminary' | 'final' | 'offline' | 'archived' | null
  cycleArchivedAt?: string | null
  cycleExists?: boolean
  deleteError?: boolean
  rpcError?: { code?: string; message?: string }
}

function makeFormData(cycleId = 'cycle-1', returnTo?: 'publish') {
  const fd = new FormData()
  fd.set('cycle_id', cycleId)
  if (returnTo) fd.set('return_to', returnTo)
  return fd
}

function createSupabaseMock(context: TestContext) {
  let deletedCycleId: string | null = null

  const mock = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: context.userId ? { id: context.userId } : null },
      })),
    },
    rpc: vi.fn(async (fn: string) => {
      if (fn !== 'app_delete_empty_draft_schedule_cycle') {
        return { data: null, error: { message: 'unknown rpc' } }
      }
      if (context.rpcError) {
        return { data: null, error: context.rpcError }
      }
      if (context.deleteError) {
        return { data: null, error: { message: 'delete failed' } }
      }
      return { data: [{ id: 'cycle-1' }], error: null }
    }),
    from(table: string) {
      const filters = new Map<string, unknown>()
      let op: 'read' | 'delete' = 'read'

      const builder = {
        select() {
          if (table === 'schedule_cycles' && op === 'delete') {
            deletedCycleId = String(filters.get('id') ?? '')
            if (context.deleteError) {
              return Promise.resolve({ data: null, error: { message: 'delete failed' } })
            }
            return Promise.resolve({ data: [{ id: deletedCycleId }], error: null })
          }
          return builder
        },
        eq(col: string, val: unknown) {
          filters.set(col, val)
          return builder
        },
        delete() {
          op = 'delete'
          return builder
        },
        async maybeSingle() {
          if (table === 'profiles') {
            return { data: { role: context.role ?? null }, error: null }
          }
          if (table === 'schedule_cycles') {
            if (!context.cycleExists && context.cycleExists !== undefined) {
              return { data: null, error: null }
            }
            return {
              data: {
                id: filters.get('id') ?? 'cycle-1',
                label: 'Test Cycle',
                published: Boolean(context.cyclePublished),
                status: context.cycleStatus ?? (context.cyclePublished ? 'final' : 'draft'),
                archived_at: context.cycleArchivedAt ?? null,
              },
              error: null,
            }
          }
          return { data: null, error: null }
        },
        get _deletedCycleId() {
          return deletedCycleId
        },
      }
      return builder
    },
    _getDeletedCycleId() {
      return deletedCycleId
    },
  }
  return mock
}

describe('deleteCycleAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to login when unauthenticated', async () => {
    const mock = createSupabaseMock({ userId: null })
    createClientMock.mockResolvedValue(mock)

    await expect(deleteCycleAction(makeFormData())).rejects.toThrow('REDIRECT:/login')
  })

  it('redirects with error when user is not a manager', async () => {
    const mock = createSupabaseMock({ userId: 'u1', role: 'therapist', cyclePublished: false })
    createClientMock.mockResolvedValue(mock)

    await expect(deleteCycleAction(makeFormData())).rejects.toThrow(
      'REDIRECT:/schedule?error=delete_cycle_unauthorized'
    )
  })

  it('redirects with error when cycle is not found', async () => {
    const mock = createSupabaseMock({ userId: 'u1', role: 'manager', cycleExists: false })
    createClientMock.mockResolvedValue(mock)

    await expect(deleteCycleAction(makeFormData())).rejects.toThrow(
      'REDIRECT:/schedule?error=delete_cycle_not_found'
    )
  })

  it('refuses to delete a published (live) cycle', async () => {
    const mock = createSupabaseMock({
      userId: 'u1',
      role: 'manager',
      cyclePublished: true,
      cycleExists: true,
    })
    createClientMock.mockResolvedValue(mock)

    await expect(deleteCycleAction(makeFormData())).rejects.toThrow(
      'REDIRECT:/schedule?error=delete_cycle_published'
    )
  })

  it('refuses to delete a non-draft unpublished cycle', async () => {
    const mock = createSupabaseMock({
      userId: 'u1',
      role: 'manager',
      cyclePublished: false,
      cycleStatus: 'preliminary',
      cycleExists: true,
    })
    createClientMock.mockResolvedValue(mock)

    await expect(deleteCycleAction(makeFormData())).rejects.toThrow(
      'REDIRECT:/schedule?error=delete_cycle_not_draft'
    )
  })

  it('refuses to delete a draft with dependent data', async () => {
    const mock = createSupabaseMock({
      userId: 'u1',
      role: 'manager',
      cyclePublished: false,
      cycleStatus: 'draft',
      cycleExists: true,
      rpcError: {
        code: '23503',
        message: 'Schedule Block has schedule, availability, preliminary, or publish history.',
      },
    })
    createClientMock.mockResolvedValue(mock)
    createAdminClientMock.mockReturnValue(mock)

    await expect(deleteCycleAction(makeFormData())).rejects.toThrow(
      'REDIRECT:/schedule?error=delete_cycle_not_empty'
    )
  })

  it('deletes an unpublished cycle and redirects with success', async () => {
    const mock = createSupabaseMock({
      userId: 'u1',
      role: 'manager',
      cyclePublished: false,
      cycleExists: true,
    })
    createClientMock.mockResolvedValue(mock)
    createAdminClientMock.mockReturnValue(mock)

    await expect(deleteCycleAction(makeFormData('cycle-1'))).rejects.toThrow(
      'REDIRECT:/schedule?success=cycle_deleted'
    )
    expect(mock.rpc).toHaveBeenCalledWith('app_delete_empty_draft_schedule_cycle', {
      p_actor_id: 'u1',
      p_cycle_id: 'cycle-1',
    })
  })

  it('redirects to publish history when return_to is publish', async () => {
    const mock = createSupabaseMock({
      userId: 'u1',
      role: 'manager',
      cyclePublished: false,
      cycleExists: true,
    })
    createClientMock.mockResolvedValue(mock)
    createAdminClientMock.mockReturnValue(mock)

    await expect(deleteCycleAction(makeFormData('cycle-1', 'publish'))).rejects.toThrow(
      'REDIRECT:/publish?success=cycle_deleted'
    )
  })
})
