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
  createAdminClient: createAdminClientMock,
}))

vi.mock('@/lib/publish-events', () => ({
  refreshPublishEventCounts: vi.fn(),
}))

import {
  archiveCycleAction,
  deletePublishEventAction,
  restartPublishedCycleAction,
  unpublishCycleKeepShiftsAction,
} from '@/app/publish/actions'

type TestContext = {
  userId?: string | null
  role?: string | null
}

function createSupabaseMock(context: TestContext) {
  const state = {
    cyclePublished: true,
    deletedShiftIds: [] as string[],
    closedSnapshots: [] as string[],
    publishEventPublished: false,
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

          if (table === 'publish_events') {
            return {
              data: {
                id: 'event-1',
                cycle_id: 'cycle-1',
                schedule_cycles: { published: state.publishEventPublished },
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

function makeDeleteFormData() {
  const formData = new FormData()
  formData.set('publish_event_id', 'event-1')
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

describe('unpublishCycleKeepShiftsAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets published false, keeps shifts, and closes active preliminary', async () => {
    const supabase = createSupabaseMock({
      userId: 'manager-1',
      role: 'manager',
    })
    createClientMock.mockResolvedValue(supabase)

    await expect(unpublishCycleKeepShiftsAction(makeFormData())).rejects.toThrow(
      'REDIRECT:/publish?success=unpublished_keep_shifts'
    )

    expect(supabase.state.cyclePublished).toBe(false)
    expect(supabase.state.deletedShiftIds).toEqual([])
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

    await expect(unpublishCycleKeepShiftsAction(makeFormData())).rejects.toThrow(
      'REDIRECT:/dashboard'
    )
  })
})

describe('deletePublishEventAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes non-live publish history entries through the admin client', async () => {
    const supabase = createSupabaseMock({
      userId: 'manager-1',
      role: 'manager',
    })
    const deleteMock = vi.fn().mockResolvedValue({ error: null })
    createClientMock.mockResolvedValue(supabase)
    createAdminClientMock.mockReturnValue({
      from: vi.fn(() => ({
        delete: vi.fn(() => ({
          eq: deleteMock,
        })),
      })),
    })

    await expect(deletePublishEventAction(makeDeleteFormData())).rejects.toThrow(
      'REDIRECT:/publish?success=publish_event_deleted'
    )

    expect(deleteMock).toHaveBeenCalledWith('id', 'event-1')
    expect(revalidatePathMock).toHaveBeenCalledWith('/publish')
  })

  it('blocks deletion for live publish history entries', async () => {
    const supabase = createSupabaseMock({
      userId: 'manager-1',
      role: 'manager',
    })
    supabase.state.publishEventPublished = true
    createClientMock.mockResolvedValue(supabase)

    await expect(deletePublishEventAction(makeDeleteFormData())).rejects.toThrow(
      'REDIRECT:/publish?error=delete_live_publish_event'
    )
  })
})

describe('archiveCycleAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('archives non-live cycles', async () => {
    const supabase = createSupabaseMock({
      userId: 'manager-1',
      role: 'manager',
    })
    supabase.state.cyclePublished = false
    createClientMock.mockResolvedValue(supabase)

    await expect(archiveCycleAction(makeFormData())).rejects.toThrow(
      'REDIRECT:/publish?success=cycle_archived'
    )

    expect(revalidatePathMock).toHaveBeenCalledWith('/coverage')
  })

  it('blocks archiving live cycles', async () => {
    const supabase = createSupabaseMock({
      userId: 'manager-1',
      role: 'manager',
    })
    supabase.state.cyclePublished = true
    createClientMock.mockResolvedValue(supabase)

    await expect(archiveCycleAction(makeFormData())).rejects.toThrow(
      'REDIRECT:/publish?error=archive_live_cycle'
    )
  })
})
