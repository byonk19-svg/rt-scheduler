import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClientMock, notifyUsersMock, redirectMock, revalidatePathMock, writeAuditLogMock } =
  vi.hoisted(() => ({
    createClientMock: vi.fn(),
    notifyUsersMock: vi.fn(),
    redirectMock: vi.fn((url: string) => {
      throw new Error(`REDIRECT:${url}`)
    }),
    revalidatePathMock: vi.fn(),
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

vi.mock('@/lib/notifications', () => ({
  notifyUsers: notifyUsersMock,
}))

vi.mock('@/lib/audit-log', () => ({
  writeAuditLog: writeAuditLogMock,
}))

import {
  createScheduleBlockPlanningAction,
  updateScheduleBlockPlanningAction,
} from '@/app/schedule/actions'
import { availabilityDueDateKey } from '@/lib/schedule-block-planning'

type PlanningCycle = {
  id: string
  label: string
  start_date: string
  end_date: string
  published: boolean
  status: 'draft' | 'preliminary' | 'final' | 'offline' | 'archived'
  archived_at: string | null
  availability_due_at: string | null
  preliminary_target_date: string | null
  final_publish_target_date: string | null
  site_id: string | null
}

type TestContext = {
  userId?: string | null
  role?: string | null
  siteId?: string | null
  cycles?: PlanningCycle[]
  recipients?: Array<{ id: string }>
  counts?: Partial<Record<string, number>>
  inserted?: Record<string, unknown> | null
  updated?: Record<string, unknown> | null
}

function makeCreateForm() {
  const formData = new FormData()
  formData.set('start_date', '2026-06-21')
  formData.set('end_date', '2026-08-01')
  formData.set('availability_due_date', '2026-05-31')
  formData.set('preliminary_target_date', '2026-06-07')
  formData.set('final_publish_target_date', '2026-06-14')
  return formData
}

function makeUpdateForm(overrides: Record<string, string | null> = {}) {
  const formData = new FormData()
  formData.set('cycle_id', overrides.cycle_id ?? 'cycle-1')
  formData.set('start_date', overrides.start_date ?? '2026-06-21')
  formData.set('end_date', overrides.end_date ?? '2026-08-01')
  for (const key of [
    'availability_due_date',
    'preliminary_target_date',
    'final_publish_target_date',
  ] as const) {
    const value = overrides[key]
    if (value !== null) {
      formData.set(key, value ?? defaultPlanningValues[key])
    }
  }
  if (overrides.confirm_earlier_due_date) {
    formData.set('confirm_earlier_due_date', overrides.confirm_earlier_due_date)
  }
  return formData
}

const defaultPlanningValues = {
  availability_due_date: '2026-05-31',
  preliminary_target_date: '2026-06-07',
  final_publish_target_date: '2026-06-14',
}

function baseCycle(overrides: Partial<PlanningCycle> = {}): PlanningCycle {
  return {
    id: 'cycle-1',
    label: 'Jun 21 - Aug 1',
    start_date: '2026-06-21',
    end_date: '2026-08-01',
    published: false,
    status: 'draft',
    archived_at: null,
    availability_due_at: null,
    preliminary_target_date: '2026-06-07',
    final_publish_target_date: '2026-06-14',
    site_id: 'site-1',
    ...overrides,
  }
}

function createSupabaseMock(context: TestContext) {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: context.userId === null ? null : { id: context.userId ?? 'manager-1' },
        },
      })),
    },
    from(table: string) {
      const filters = new Map<string, unknown>()
      let selected = '*'
      let operation: 'insert' | 'update' | null = null
      let payload: Record<string, unknown> | null = null

      const execute = () => {
        if (table === 'schedule_cycles' && operation === 'update') {
          context.updated = payload
          return { data: null, error: null }
        }

        if (table === 'schedule_cycles') {
          return { data: context.cycles ?? [], error: null }
        }

        if (table === 'profiles' && Array.isArray(filters.get('role'))) {
          return {
            data: context.recipients ?? [{ id: 'therapist-1' }, { id: 'lead-1' }],
            error: null,
          }
        }

        if (
          table === 'therapist_availability_submissions' ||
          table === 'shifts' ||
          table === 'preliminary_snapshots' ||
          table === 'publish_events'
        ) {
          return { data: [], count: context.counts?.[table] ?? 0, error: null }
        }

        return { data: [], error: null }
      }

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
        is(column: string, value: unknown) {
          filters.set(column, value)
          return builder
        },
        order() {
          return builder
        },
        insert(value: Record<string, unknown>) {
          operation = 'insert'
          payload = value
          context.inserted = value
          return builder
        },
        update(value: Record<string, unknown>) {
          operation = 'update'
          payload = value
          return builder
        },
        async maybeSingle() {
          if (table === 'profiles' && selected.includes('site_id')) {
            return { data: { site_id: context.siteId ?? 'site-1' }, error: null }
          }
          if (table === 'profiles' && selected.includes('role')) {
            return {
              data: {
                role: context.role ?? 'manager',
                is_active: true,
                archived_at: null,
              },
              error: null,
            }
          }
          if (table === 'schedule_cycles' && operation === 'insert') {
            return { data: { id: 'cycle-created' }, error: null }
          }
          return { data: null, error: null }
        },
        then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve(execute()).then(resolve, reject)
        },
      }

      return builder
    },
  }
}

describe('Schedule Block Planning actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a visible Schedule Block with date-only planning targets and notifies therapists', async () => {
    const context: TestContext = { cycles: [] }
    createClientMock.mockResolvedValue(createSupabaseMock(context))

    await expect(createScheduleBlockPlanningAction(makeCreateForm())).rejects.toThrow(
      'REDIRECT:/schedule/planning?cycle=cycle-created&success=planning_created'
    )

    expect(context.inserted).toMatchObject({
      start_date: '2026-06-21',
      end_date: '2026-08-01',
      status: 'draft',
      site_id: 'site-1',
      preliminary_target_date: '2026-06-07',
      final_publish_target_date: '2026-06-14',
    })
    expect(availabilityDueDateKey(String(context.inserted?.availability_due_at))).toBe('2026-05-31')
    expect(notifyUsersMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'availability_ready',
        targetId: 'cycle-created',
      })
    )
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'schedule_block_planning_created_visible' })
    )
    expect(revalidatePathMock).toHaveBeenCalledWith('/therapist/availability')
  })

  it('rejects an overlapping Schedule Block before inserting', async () => {
    const context: TestContext = { cycles: [baseCycle()] }
    createClientMock.mockResolvedValue(createSupabaseMock(context))

    await expect(createScheduleBlockPlanningAction(makeCreateForm())).rejects.toThrow(
      'REDIRECT:/schedule/planning?error=schedule_block_overlap'
    )

    expect(context.inserted).toBeUndefined()
    expect(notifyUsersMock).not.toHaveBeenCalled()
  })

  it('notifies therapists when a hidden Schedule Block becomes visible', async () => {
    const context: TestContext = { cycles: [baseCycle()] }
    createClientMock.mockResolvedValue(createSupabaseMock(context))

    await expect(updateScheduleBlockPlanningAction(makeUpdateForm())).rejects.toThrow(
      'REDIRECT:/schedule/planning?cycle=cycle-1&success=planning_saved'
    )

    expect(context.updated).toMatchObject({
      preliminary_target_date: '2026-06-07',
      final_publish_target_date: '2026-06-14',
    })
    expect(availabilityDueDateKey(String(context.updated?.availability_due_at))).toBe('2026-05-31')
    expect(notifyUsersMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'availability_ready',
        targetId: 'cycle-1',
      })
    )
  })

  it('does not allow clearing the due date after a Schedule Block is therapist-visible', async () => {
    const context: TestContext = {
      cycles: [baseCycle({ availability_due_at: '2026-05-31T23:59:59.999Z' })],
    }
    createClientMock.mockResolvedValue(createSupabaseMock(context))

    await expect(
      updateScheduleBlockPlanningAction(makeUpdateForm({ availability_due_date: null }))
    ).rejects.toThrow('REDIRECT:/schedule/planning?cycle=cycle-1&error=visible_due_date_required')

    expect(context.updated).toBeUndefined()
    expect(notifyUsersMock).not.toHaveBeenCalled()
  })

  it('requires explicit confirmation before moving a visible due date earlier', async () => {
    const context: TestContext = {
      cycles: [baseCycle({ availability_due_at: '2026-05-31T23:59:59.999Z' })],
    }
    createClientMock.mockResolvedValue(createSupabaseMock(context))

    await expect(
      updateScheduleBlockPlanningAction(makeUpdateForm({ availability_due_date: '2026-05-24' }))
    ).rejects.toThrow(
      'REDIRECT:/schedule/planning?cycle=cycle-1&error=planning_due_earlier_requires_confirm'
    )

    expect(context.updated).toBeUndefined()
  })
})
