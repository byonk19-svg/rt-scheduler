import { describe, expect, it, vi } from 'vitest'

import {
  archiveScheduleBlockLifecycle,
  publishScheduleBlockLifecycle,
  takeScheduleBlockOfflineLifecycle,
  type ArchiveScheduleBlockLifecycleResult,
  type PublishScheduleBlockLifecycleResult,
  type TakeScheduleBlockOfflineLifecycleResult,
} from '@/lib/schedule-block-lifecycle'

function createSupabaseMock(options?: {
  cycle?: {
    id: string
    published: boolean
    status: string
    archived_at?: string | null
    site_id?: string | null
  } | null
  cycleError?: { message: string } | null
  cycleUpdateError?: { message: string } | null
}) {
  const state = {
    inserts: [] as Array<{ table: string; payload: Record<string, unknown> }>,
    scheduleCycleUpdates: [] as Array<{ payload: Record<string, unknown>; id: string }>,
    shiftPostUpdates: [] as Array<{ payload: Record<string, unknown>; ids: string[] }>,
    shiftPostInterestUpdates: [] as Array<{
      payload: Record<string, unknown>
      ids: string[]
      statuses: string[]
    }>,
  }

  const supabase = {
    state,
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
        maybeSingle: async () => {
          if (table === 'schedule_cycles') {
            return {
              data:
                options?.cycle === undefined
                  ? {
                      id: 'cycle-1',
                      published: true,
                      status: 'final',
                      archived_at: null,
                      site_id: 'site-a',
                    }
                  : options.cycle,
              error: options?.cycleError ?? null,
            }
          }

          return { data: null, error: null }
        },
        update(payload: Record<string, unknown>) {
          return {
            eq(column: string, value: string) {
              if (table === 'schedule_cycles' && column === 'id') {
                state.scheduleCycleUpdates.push({ payload, id: value })
                return Promise.resolve({ error: options?.cycleUpdateError ?? null })
              }

              return Promise.resolve({ error: null })
            },
            in(column: string, value: string[]) {
              if (table === 'shift_posts' && column === 'id') {
                state.shiftPostUpdates.push({ payload, ids: value })
                return Promise.resolve({ error: null })
              }

              if (table === 'shift_post_interests' && column === 'shift_post_id') {
                return {
                  in(_statusColumn: string, statuses: string[]) {
                    state.shiftPostInterestUpdates.push({ payload, ids: value, statuses })
                    return Promise.resolve({ error: null })
                  },
                }
              }

              return Promise.resolve({ error: null })
            },
          }
        },
        insert(payload: Record<string, unknown>) {
          state.inserts.push({ table, payload })
          return Promise.resolve({ error: null })
        },
        then<TResult1 = unknown, TResult2 = never>(
          onfulfilled?:
            | ((value: { data: unknown; error: { message: string } | null }) => TResult1)
            | null,
          onrejected?: ((reason: unknown) => TResult2) | null
        ) {
          let result: { data: unknown; error: { message: string } | null } = {
            data: null,
            error: null,
          }

          if (table === 'shifts' && filters.get('cycle_id') === 'cycle-1') {
            result = {
              data: [{ id: 'shift-1' }, { id: 'shift-2' }],
              error: null,
            }
          }

          if (table === 'shift_posts' && Array.isArray(filters.get('shift_id'))) {
            result = {
              data: String(selected).includes('status')
                ? [{ id: 'post-1', status: 'pending' }]
                : [{ id: 'post-1' }],
              error: null,
            }
          }

          return Promise.resolve(result).then(onfulfilled, onrejected)
        },
      }

      return builder
    },
  }

  return supabase
}

function createMutationClient(result?: {
  data: Array<{ id: string }> | { id: string } | null
  error: { message?: string } | null
}) {
  return {
    rpc: vi.fn(async () => result ?? { data: [{ id: 'cycle-1' }], error: null }),
  }
}

function createPublishMutationClient(result?: {
  data: Array<{ id: string }> | { id: string } | null
  error: { message?: string } | null
}) {
  return {
    rpc: vi.fn(async () => result ?? { data: [{ id: 'cycle-1' }], error: null }),
  }
}

describe('publishScheduleBlockLifecycle', () => {
  it('publishes a Schedule Block through the publish RPC', async () => {
    const mutationClient = createPublishMutationClient()

    await expect(
      publishScheduleBlockLifecycle({
        mutationClient,
        actorId: 'manager-1',
        cycleId: 'cycle-1',
      })
    ).resolves.toEqual({ ok: true })

    expect(mutationClient.rpc).toHaveBeenCalledWith('app_publish_schedule_cycle', {
      p_actor_id: 'manager-1',
      p_cycle_id: 'cycle-1',
    })
  })

  it('returns a preliminary marks failure when the publish RPC rejects unresolved marks', async () => {
    const mutationClient = createPublishMutationClient({
      data: null,
      error: { message: 'Resolve preliminary marks before publishing.' },
    })

    await expect(
      publishScheduleBlockLifecycle({
        mutationClient,
        actorId: 'manager-1',
        cycleId: 'cycle-1',
      })
    ).resolves.toEqual({
      ok: false,
      reason: 'unresolved_preliminary_marks',
      error: { message: 'Resolve preliminary marks before publishing.' },
    } satisfies PublishScheduleBlockLifecycleResult)
  })

  it.each([
    ['Resolve preliminary requests before publishing.', 'unresolved_preliminary_requests'],
    ['Another live block already covers the same date range.', 'republish_conflict'],
    ['Need to Work conflicts with Need Off availability.', 'availability_rule_violation'],
    ['A designated lead is required for this shift.', 'shift_rule_violation'],
    ['Only draft or preliminary Schedule Blocks can be published.', 'invalid_state'],
  ] as const)('classifies publish RPC failure: %s', async (message, reason) => {
    const mutationClient = createPublishMutationClient({
      data: null,
      error: { message },
    })

    await expect(
      publishScheduleBlockLifecycle({
        mutationClient,
        actorId: 'manager-1',
        cycleId: 'cycle-1',
      })
    ).resolves.toEqual({
      ok: false,
      reason,
      error: { message },
    } satisfies PublishScheduleBlockLifecycleResult)
  })

  it('returns stale state when the publish RPC updates no rows', async () => {
    const mutationClient = createPublishMutationClient({
      data: [],
      error: null,
    })

    await expect(
      publishScheduleBlockLifecycle({
        mutationClient,
        actorId: 'manager-1',
        cycleId: 'cycle-1',
      })
    ).resolves.toEqual({
      ok: false,
      reason: 'state_changed',
    } satisfies PublishScheduleBlockLifecycleResult)
  })
})

describe('takeScheduleBlockOfflineLifecycle', () => {
  it('takes a live final Schedule Block offline through the atomic RPC and writes audit', async () => {
    const supabase = createSupabaseMock()
    const mutationClient = createMutationClient()

    await expect(
      takeScheduleBlockOfflineLifecycle({
        supabase: supabase as never,
        mutationClient,
        actorId: 'manager-1',
        cycleId: 'cycle-1',
      })
    ).resolves.toEqual({ ok: true })

    expect(mutationClient.rpc).toHaveBeenCalledWith('app_take_schedule_cycle_offline', {
      p_actor_id: 'manager-1',
      p_cycle_id: 'cycle-1',
    })
    expect(supabase.state.shiftPostUpdates).toEqual([])
    expect(supabase.state.shiftPostInterestUpdates).toEqual([])
    expect(supabase.state.inserts).toContainEqual({
      table: 'audit_log',
      payload: {
        user_id: 'manager-1',
        action: 'schedule_block_taken_offline',
        target_type: 'schedule_cycle',
        target_id: 'cycle-1',
      },
    })
  })

  it('stops before the RPC when the Schedule Block is not live final', async () => {
    const supabase = createSupabaseMock({
      cycle: { id: 'cycle-1', published: true, status: 'offline' },
    })
    const mutationClient = createMutationClient()

    await expect(
      takeScheduleBlockOfflineLifecycle({
        supabase: supabase as never,
        mutationClient,
        actorId: 'manager-1',
        cycleId: 'cycle-1',
      })
    ).resolves.toEqual({
      ok: false,
      reason: 'not_live',
    } satisfies TakeScheduleBlockOfflineLifecycleResult)

    expect(mutationClient.rpc).not.toHaveBeenCalled()
    expect(supabase.state.shiftPostUpdates).toEqual([])
  })

  it('returns state_changed when the atomic offline RPC observes a stale live-state race', async () => {
    const supabase = createSupabaseMock()
    const mutationClient = createMutationClient({
      data: null,
      error: { message: 'Only live Final Schedule Blocks can be taken offline.' },
    })

    await expect(
      takeScheduleBlockOfflineLifecycle({
        supabase: supabase as never,
        mutationClient,
        actorId: 'manager-1',
        cycleId: 'cycle-1',
      })
    ).resolves.toEqual({
      ok: false,
      reason: 'state_changed',
      error: { message: 'Only live Final Schedule Blocks can be taken offline.' },
    } satisfies TakeScheduleBlockOfflineLifecycleResult)

    expect(supabase.state.shiftPostUpdates).toEqual([])
    expect(supabase.state.inserts).toEqual([])
  })
})

describe('archiveScheduleBlockLifecycle', () => {
  it('archives a non-live Schedule Block in the manager site and writes audit', async () => {
    const supabase = createSupabaseMock({
      cycle: {
        id: 'cycle-1',
        published: false,
        status: 'offline',
        archived_at: null,
        site_id: 'site-a',
      },
    })

    await expect(
      archiveScheduleBlockLifecycle({
        supabase: supabase as never,
        actorId: 'manager-1',
        managerSiteId: 'site-a',
        cycleId: 'cycle-1',
        now: () => '2026-06-17T00:00:00.000Z',
      })
    ).resolves.toEqual({ ok: true })

    expect(supabase.state.scheduleCycleUpdates).toEqual([
      {
        id: 'cycle-1',
        payload: {
          archived_at: '2026-06-17T00:00:00.000Z',
          status: 'archived',
        },
      },
    ])
    expect(supabase.state.inserts).toContainEqual({
      table: 'audit_log',
      payload: {
        user_id: 'manager-1',
        action: 'schedule_block_archived',
        target_type: 'schedule_cycle',
        target_id: 'cycle-1',
      },
    })
  })

  it('treats an already archived Schedule Block as a no-op success', async () => {
    const supabase = createSupabaseMock({
      cycle: {
        id: 'cycle-1',
        published: false,
        status: 'archived',
        archived_at: '2026-06-16T00:00:00.000Z',
        site_id: 'site-a',
      },
    })

    await expect(
      archiveScheduleBlockLifecycle({
        supabase: supabase as never,
        actorId: 'manager-1',
        managerSiteId: 'site-a',
        cycleId: 'cycle-1',
      })
    ).resolves.toEqual({ ok: true })

    expect(supabase.state.scheduleCycleUpdates).toEqual([])
    expect(supabase.state.inserts).toEqual([])
  })

  it('stops before updating when the Schedule Block is live', async () => {
    const supabase = createSupabaseMock({
      cycle: {
        id: 'cycle-1',
        published: true,
        status: 'final',
        archived_at: null,
        site_id: 'site-a',
      },
    })

    await expect(
      archiveScheduleBlockLifecycle({
        supabase: supabase as never,
        actorId: 'manager-1',
        managerSiteId: 'site-a',
        cycleId: 'cycle-1',
      })
    ).resolves.toEqual({
      ok: false,
      reason: 'live',
    } satisfies ArchiveScheduleBlockLifecycleResult)

    expect(supabase.state.scheduleCycleUpdates).toEqual([])
  })

  it('stops before updating when the Schedule Block is outside the manager site', async () => {
    const supabase = createSupabaseMock({
      cycle: {
        id: 'cycle-1',
        published: false,
        status: 'offline',
        archived_at: null,
        site_id: 'site-b',
      },
    })

    await expect(
      archiveScheduleBlockLifecycle({
        supabase: supabase as never,
        actorId: 'manager-1',
        managerSiteId: 'site-a',
        cycleId: 'cycle-1',
      })
    ).resolves.toEqual({
      ok: false,
      reason: 'outside_site',
    } satisfies ArchiveScheduleBlockLifecycleResult)

    expect(supabase.state.scheduleCycleUpdates).toEqual([])
  })
})
