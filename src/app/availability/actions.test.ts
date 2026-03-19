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

import {
  deleteAvailabilityEntryAction,
  deleteManagerPlannerDateAction,
  saveManagerPlannerDatesAction,
  submitAvailabilityEntryAction,
} from '@/app/availability/actions'

type TestContext = {
  userId?: string | null
  role?: string | null
}

function createSupabaseMock(context: TestContext) {
  const state = {
    upsertPayloads: [] as Array<Record<string, unknown> | Array<Record<string, unknown>>>,
    deletes: [] as Array<{ table: string; filters: Record<string, unknown> }>,
    selectRows: [] as Array<Record<string, unknown>>,
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
        in(column: string, values: unknown[]) {
          filters.set(column, values)
          return builder
        },
        delete() {
          return {
            eq(column: string, value: unknown) {
              filters.set(column, value)
              return this
            },
            in(column: string, values: unknown[]) {
              filters.set(column, values)
              return this
            },
            then(resolve: (value: unknown) => unknown) {
              state.deletes.push({
                table,
                filters: Object.fromEntries(filters.entries()),
              })
              return Promise.resolve(resolve({ error: null }))
            },
          }
        },
        upsert(payload: Record<string, unknown> | Array<Record<string, unknown>>) {
          state.upsertPayloads.push(payload)
          return Promise.resolve({ error: null })
        },
        maybeSingle: async () => {
          if (table === 'profiles' && selected === 'role') {
            return { data: { role: context.role }, error: null }
          }
          if (table === 'schedule_cycles') {
            return {
              data: {
                start_date: '2026-03-22',
                end_date: '2026-05-02',
              },
              error: null,
            }
          }
          return { data: null, error: null }
        },
        then(resolve: (value: unknown) => unknown) {
          if (table === 'availability_overrides' && selected.includes('id, date')) {
            return Promise.resolve(
              resolve({
                data: state.selectRows,
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

function makeTherapistFormData() {
  const formData = new FormData()
  formData.set('date', '2026-03-24')
  formData.set('cycle_id', 'cycle-1')
  formData.set('shift_type', 'both')
  formData.set('override_type', 'force_off')
  formData.set('note', 'doctor visit')
  return formData
}

function makeManagerPlannerFormData() {
  const formData = new FormData()
  formData.set('cycle_id', 'cycle-1')
  formData.set('therapist_id', 'therapist-1')
  formData.set('shift_type', 'day')
  formData.set('mode', 'will_work')
  formData.append('dates', '2026-03-24')
  formData.append('dates', '2026-03-26')
  return formData
}

describe('availability actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lets a therapist save their own availability request', async () => {
    const supabase = createSupabaseMock({ userId: 'therapist-1', role: 'therapist' })
    createClientMock.mockResolvedValue(supabase)

    await expect(submitAvailabilityEntryAction(makeTherapistFormData())).rejects.toThrow(
      'REDIRECT:/availability?success=entry_submitted&cycle=cycle-1'
    )

    expect(supabase.state.upsertPayloads[0]).toEqual({
      therapist_id: 'therapist-1',
      cycle_id: 'cycle-1',
      date: '2026-03-24',
      shift_type: 'both',
      override_type: 'force_off',
      note: 'doctor visit',
      created_by: 'therapist-1',
      source: 'therapist',
    })
    expect(revalidatePathMock).toHaveBeenCalledWith('/availability')
  })

  it('only lets a therapist delete their own availability row', async () => {
    const supabase = createSupabaseMock({ userId: 'therapist-1', role: 'therapist' })
    createClientMock.mockResolvedValue(supabase)
    const formData = new FormData()
    formData.set('entry_id', 'override-1')
    formData.set('cycle_id', 'cycle-1')

    await expect(deleteAvailabilityEntryAction(formData)).rejects.toThrow(
      'REDIRECT:/availability?success=entry_deleted&cycle=cycle-1'
    )

    expect(supabase.state.deletes).toEqual([
      {
        table: 'availability_overrides',
        filters: {
          id: 'override-1',
          therapist_id: 'therapist-1',
        },
      },
    ])
  })

  it('lets a manager replace planner dates for one therapist and mode', async () => {
    const supabase = createSupabaseMock({ userId: 'manager-1', role: 'manager' })
    supabase.state.selectRows = [
      {
        id: 'override-old-1',
        date: '2026-03-22',
      },
      {
        id: 'override-keep-1',
        date: '2026-03-24',
      },
    ]
    createClientMock.mockResolvedValue(supabase)

    await expect(saveManagerPlannerDatesAction(makeManagerPlannerFormData())).rejects.toThrow(
      'REDIRECT:/availability?cycle=cycle-1&therapist=therapist-1&success=planner_saved'
    )

    expect(supabase.state.deletes).toEqual([
      {
        table: 'availability_overrides',
        filters: {
          id: ['override-old-1'],
        },
      },
    ])
    expect(supabase.state.upsertPayloads[0]).toEqual([
      {
        cycle_id: 'cycle-1',
        therapist_id: 'therapist-1',
        date: '2026-03-24',
        shift_type: 'day',
        override_type: 'force_on',
        note: null,
        created_by: 'manager-1',
        source: 'manager',
      },
      {
        cycle_id: 'cycle-1',
        therapist_id: 'therapist-1',
        date: '2026-03-26',
        shift_type: 'day',
        override_type: 'force_on',
        note: null,
        created_by: 'manager-1',
        source: 'manager',
      },
    ])
  })

  it('lets a manager delete a manager-entered planner row', async () => {
    const supabase = createSupabaseMock({ userId: 'manager-1', role: 'manager' })
    createClientMock.mockResolvedValue(supabase)
    const formData = new FormData()
    formData.set('override_id', 'override-1')
    formData.set('cycle_id', 'cycle-1')
    formData.set('therapist_id', 'therapist-1')

    await expect(deleteManagerPlannerDateAction(formData)).rejects.toThrow(
      'REDIRECT:/availability?cycle=cycle-1&therapist=therapist-1&success=planner_deleted'
    )

    expect(supabase.state.deletes).toEqual([
      {
        table: 'availability_overrides',
        filters: {
          id: 'override-1',
          source: 'manager',
        },
      },
    ])
  })
})
