import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  redirectMock,
  revalidatePathMock,
  createClientMock,
  getRoleForUserMock,
  getPanelParamMock,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
  revalidatePathMock: vi.fn(),
  createClientMock: vi.fn(),
  getRoleForUserMock: vi.fn(async () => 'manager'),
  getPanelParamMock: vi.fn(() => undefined),
}))

vi.mock('next/navigation', () => ({ redirect: redirectMock }))
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))
vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }))
vi.mock('@/app/(app)/schedule/actions/helpers', () => ({
  getRoleForUser: getRoleForUserMock,
  getPanelParam: getPanelParamMock,
  buildScheduleActionUrl: (cycleId?: string, params?: Record<string, string | undefined>) => {
    const search = new URLSearchParams()
    if (cycleId) search.set('cycle', cycleId)
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value) search.set(key, value)
      }
    }
    const query = search.toString()
    return query ? `/schedule?${query}` : '/schedule'
  },
}))

import { createCycleAction } from '@/app/(app)/schedule/actions/cycle-actions'

type TestContext = {
  userId?: string | null
  overlappingCycles?: Array<Record<string, unknown>>
}

function makeFormData(
  startDate: string,
  endDate: string,
  options?: { returnTo?: 'coverage'; currentCycleId?: string; view?: string; shift?: string }
) {
  const fd = new FormData()
  fd.set('label', 'Block 7')
  fd.set('start_date', startDate)
  fd.set('end_date', endDate)
  fd.set('view', options?.view ?? 'week')
  if (options?.returnTo) fd.set('return_to', options.returnTo)
  if (options?.currentCycleId) fd.set('current_cycle_id', options.currentCycleId)
  if (options?.shift) fd.set('shift', options.shift)
  return fd
}

function createSupabaseMock(context: TestContext) {
  const state = {
    insertedCycles: [] as Array<Record<string, unknown>>,
  }

  return {
    state,
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: context.userId === null ? null : { id: context.userId ?? 'manager-1' } },
      })),
    },
    from(table: string) {
      const builder = {
        select() {
          return builder
        },
        eq() {
          return builder
        },
        is() {
          return builder
        },
        lte() {
          return builder
        },
        gte() {
          return builder
        },
        insert(payload: Record<string, unknown>) {
          state.insertedCycles.push(payload)
          return {
            select() {
              return {
                maybeSingle: async () => ({ data: { id: 'cycle-new' }, error: null }),
              }
            },
          }
        },
        maybeSingle: async () => {
          if (table === 'profiles') {
            return { data: { site_id: 'default' }, error: null }
          }
          return { data: null, error: null }
        },
        then(resolve: (value: unknown) => unknown) {
          if (table === 'schedule_cycles') {
            return Promise.resolve(
              resolve({
                data: context.overlappingCycles ?? [],
                error: null,
              })
            )
          }
          return Promise.resolve(resolve({ data: null, error: null }))
        },
      }
      return builder
    },
  }
}

describe('createCycleAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects a cycle whose end date is before the start date', async () => {
    const supabase = createSupabaseMock({ userId: 'manager-1' })
    createClientMock.mockResolvedValue(supabase)

    await expect(createCycleAction(makeFormData('2026-05-02', '2026-03-22'))).rejects.toThrow(
      'REDIRECT:/schedule?error=create_cycle_invalid_range'
    )

    expect(supabase.state.insertedCycles).toHaveLength(0)
  })

  it('rejects a cycle that does not start on Sunday and last exactly six weeks', async () => {
    const supabase = createSupabaseMock({ userId: 'manager-1' })
    createClientMock.mockResolvedValue(supabase)

    await expect(createCycleAction(makeFormData('2026-05-04', '2026-06-14'))).rejects.toThrow(
      'REDIRECT:/schedule?error=create_cycle_invalid_block_shape'
    )

    expect(supabase.state.insertedCycles).toHaveLength(0)
  })

  it('rejects a Sunday-starting cycle that is not exactly 42 days inclusive', async () => {
    const supabase = createSupabaseMock({ userId: 'manager-1' })
    createClientMock.mockResolvedValue(supabase)

    await expect(createCycleAction(makeFormData('2026-05-03', '2026-06-14'))).rejects.toThrow(
      'REDIRECT:/schedule?error=create_cycle_invalid_block_shape'
    )

    expect(supabase.state.insertedCycles).toHaveLength(0)
  })

  it('rejects a cycle that overlaps an existing active cycle', async () => {
    const supabase = createSupabaseMock({
      userId: 'manager-1',
      overlappingCycles: [{ id: 'cycle-existing' }],
    })
    createClientMock.mockResolvedValue(supabase)

    await expect(createCycleAction(makeFormData('2026-05-03', '2026-06-13'))).rejects.toThrow(
      'REDIRECT:/schedule?error=create_cycle_overlap'
    )

    expect(supabase.state.insertedCycles).toHaveLength(0)
  })

  it('keeps schedule-origin overlap errors on the schedule route', async () => {
    const supabase = createSupabaseMock({
      userId: 'manager-1',
      overlappingCycles: [{ id: 'cycle-existing' }],
    })
    createClientMock.mockResolvedValue(supabase)

    await expect(
      createCycleAction(makeFormData('2026-05-03', '2026-06-13', { returnTo: 'coverage' }))
    ).rejects.toThrow('REDIRECT:/schedule?error=create_cycle_overlap')

    expect(supabase.state.insertedCycles).toHaveLength(0)
  })

  it('keeps schedule-origin success redirects on the schedule route', async () => {
    const supabase = createSupabaseMock({ userId: 'manager-1', overlappingCycles: [] })
    createClientMock.mockResolvedValue(supabase)

    await expect(
      createCycleAction(makeFormData('2026-05-03', '2026-06-13', { returnTo: 'coverage' }))
    ).rejects.toThrow('REDIRECT:/schedule?cycle=cycle-new&success=cycle_created')

    expect(revalidatePathMock).toHaveBeenCalledWith('/schedule')
    expect(supabase.state.insertedCycles).toHaveLength(1)
  })

  it('keeps schedule-origin retry and success redirects in the current schedule context', async () => {
    const overlapSupabase = createSupabaseMock({
      userId: 'manager-1',
      overlappingCycles: [{ id: 'cycle-existing' }],
    })
    createClientMock.mockResolvedValue(overlapSupabase)

    const coverageContext = {
      returnTo: 'coverage' as const,
      currentCycleId: 'cycle-current',
      view: 'roster',
      shift: 'night',
    }

    await expect(
      createCycleAction(makeFormData('2026-05-03', '2026-06-13', coverageContext))
    ).rejects.toThrow(
      'REDIRECT:/schedule?cycle=cycle-current&shift=night&error=create_cycle_overlap'
    )

    const successSupabase = createSupabaseMock({ userId: 'manager-1', overlappingCycles: [] })
    createClientMock.mockResolvedValue(successSupabase)

    await expect(
      createCycleAction(makeFormData('2026-05-03', '2026-06-13', coverageContext))
    ).rejects.toThrow('REDIRECT:/schedule?cycle=cycle-new&shift=night&success=cycle_created')
  })
})
