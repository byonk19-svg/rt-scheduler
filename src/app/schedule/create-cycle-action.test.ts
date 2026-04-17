import { beforeEach, describe, expect, it, vi } from 'vitest'

const { redirectMock, createClientMock, getRoleForUserMock, getPanelParamMock } = vi.hoisted(
  () => ({
    redirectMock: vi.fn((url: string) => {
      throw new Error(`REDIRECT:${url}`)
    }),
    createClientMock: vi.fn(),
    getRoleForUserMock: vi.fn(async () => 'manager'),
    getPanelParamMock: vi.fn(() => undefined),
  })
)

vi.mock('next/navigation', () => ({ redirect: redirectMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }))
vi.mock('@/app/(app)/schedule/actions/helpers', () => ({
  getRoleForUser: getRoleForUserMock,
  getPanelParam: getPanelParamMock,
}))

import { createCycleAction } from '@/app/(app)/schedule/actions/cycle-actions'

type TestContext = {
  userId?: string | null
  overlappingCycles?: Array<Record<string, unknown>>
}

function makeFormData(startDate: string, endDate: string) {
  const fd = new FormData()
  fd.set('label', 'Block 7')
  fd.set('start_date', startDate)
  fd.set('end_date', endDate)
  fd.set('view', 'week')
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
                single: async () => ({ data: { id: 'cycle-new' }, error: null }),
              }
            },
          }
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
      'REDIRECT:/schedule?view=week&error=create_cycle_invalid_range'
    )

    expect(supabase.state.insertedCycles).toHaveLength(0)
  })

  it('rejects a cycle that overlaps an existing active cycle', async () => {
    const supabase = createSupabaseMock({
      userId: 'manager-1',
      overlappingCycles: [{ id: 'cycle-existing' }],
    })
    createClientMock.mockResolvedValue(supabase)

    await expect(createCycleAction(makeFormData('2026-03-20', '2026-05-05'))).rejects.toThrow(
      'REDIRECT:/schedule?view=week&error=create_cycle_overlap'
    )

    expect(supabase.state.insertedCycles).toHaveLength(0)
  })
})
