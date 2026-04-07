import { beforeEach, describe, expect, it, vi } from 'vitest'

const { redirectMock, revalidatePathMock, createClientMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
  revalidatePathMock: vi.fn(),
  createClientMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect: redirectMock }))
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))
vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }))

import { deleteCycleAction } from '@/app/schedule/actions'

type TestContext = {
  userId?: string | null
  role?: string | null
  cyclePublished?: boolean
  cycleExists?: boolean
  deleteError?: boolean
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
    from(table: string) {
      const filters = new Map<string, unknown>()

      const builder = {
        select() {
          return builder
        },
        eq(col: string, val: unknown) {
          filters.set(col, val)
          return builder
        },
        delete() {
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
              },
              error: null,
            }
          }
          return { data: null, error: null }
        },
        async single() {
          if (table === 'schedule_cycles') {
            deletedCycleId = String(filters.get('id') ?? '')
            if (context.deleteError) return { data: null, error: { message: 'delete failed' } }
            return { data: { id: deletedCycleId }, error: null }
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
      'REDIRECT:/coverage?view=week&error=delete_cycle_unauthorized'
    )
  })

  it('redirects with error when cycle is not found', async () => {
    const mock = createSupabaseMock({ userId: 'u1', role: 'manager', cycleExists: false })
    createClientMock.mockResolvedValue(mock)

    await expect(deleteCycleAction(makeFormData())).rejects.toThrow(
      'REDIRECT:/coverage?view=week&error=delete_cycle_not_found'
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
      'REDIRECT:/coverage?view=week&error=delete_cycle_published'
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

    await expect(deleteCycleAction(makeFormData('cycle-1'))).rejects.toThrow(
      'REDIRECT:/coverage?view=week&success=cycle_deleted'
    )
  })

  it('redirects to publish history when return_to is publish', async () => {
    const mock = createSupabaseMock({
      userId: 'u1',
      role: 'manager',
      cyclePublished: false,
      cycleExists: true,
    })
    createClientMock.mockResolvedValue(mock)

    await expect(deleteCycleAction(makeFormData('cycle-1', 'publish'))).rejects.toThrow(
      'REDIRECT:/publish?success=cycle_deleted'
    )
  })
})
