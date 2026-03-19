import { beforeEach, describe, expect, it, vi } from 'vitest'

const { redirectMock, revalidatePathMock, createClientMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
  revalidatePathMock: vi.fn(),
  createClientMock: vi.fn(),
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

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => {
    throw new Error('not used in restart test')
  }),
}))

vi.mock('@/lib/publish-events', () => ({
  refreshPublishEventCounts: vi.fn(),
}))

import { restartPublishedCycleAction } from '@/app/publish/actions'

type TestContext = {
  userId?: string | null
  role?: string | null
}

function createSupabaseMock(context: TestContext) {
  const state = {
    cyclePublished: true,
    deletedShiftIds: [] as string[],
    closedSnapshots: [] as string[],
  }

  return {
    state,
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
        maybeSingle: async () => {
          if (table === 'profiles' && selected === 'role') {
            return { data: { role: context.role }, error: null }
          }

          if (table === 'schedule_cycles') {
            return {
              data: {
                id: 'cycle-1',
                label: 'April schedule',
                published: state.cyclePublished,
              },
              error: null,
            }
          }

          return { data: null, error: null }
        },
        update(payload: Record<string, unknown>) {
          const updateFilters = new Map<string, unknown>()
          const updateBuilder = {
            eq(column: string, value: unknown) {
              updateFilters.set(column, value)

              if (table === 'schedule_cycles' && updateFilters.get('id') === 'cycle-1') {
                state.cyclePublished = Boolean(payload.published)
              }

              if (
                table === 'preliminary_snapshots' &&
                updateFilters.get('cycle_id') === 'cycle-1' &&
                updateFilters.get('status') === 'active' &&
                payload.status === 'closed'
              ) {
                state.closedSnapshots.push('cycle-1')
                return Promise.resolve({ data: null, error: null })
              }

              if (table === 'schedule_cycles') {
                return Promise.resolve({ data: null, error: null })
              }

              return updateBuilder
            },
          }

          return updateBuilder
        },
        delete() {
          return {
            eq(column: string, value: unknown) {
              if (table === 'shifts' && column === 'cycle_id' && value === 'cycle-1') {
                state.deletedShiftIds = ['shift-1', 'shift-2']
              }
              return {
                select() {
                  return Promise.resolve({
                    data: [{ id: 'shift-1' }, { id: 'shift-2' }],
                    error: null,
                  })
                },
              }
            },
          }
        },
      }

      return builder
    },
  }
}

function makeFormData() {
  const formData = new FormData()
  formData.set('cycle_id', 'cycle-1')
  return formData
}

describe('restartPublishedCycleAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('unpublishes the cycle, clears shifts, and closes active preliminary state', async () => {
    const supabase = createSupabaseMock({
      userId: 'manager-1',
      role: 'manager',
    })
    createClientMock.mockResolvedValue(supabase)

    await expect(restartPublishedCycleAction(makeFormData())).rejects.toThrow(
      'REDIRECT:/publish?success=cycle_restarted'
    )

    expect(supabase.state.cyclePublished).toBe(false)
    expect(supabase.state.deletedShiftIds).toEqual(['shift-1', 'shift-2'])
    expect(supabase.state.closedSnapshots).toEqual(['cycle-1'])
    expect(revalidatePathMock).toHaveBeenCalledWith('/coverage')
  })

  it('denies non-managers', async () => {
    createClientMock.mockResolvedValue(
      createSupabaseMock({
        userId: 'therapist-1',
        role: 'therapist',
      })
    )

    await expect(restartPublishedCycleAction(makeFormData())).rejects.toThrow('REDIRECT:/dashboard')
  })
})
