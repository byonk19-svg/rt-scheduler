import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  redirectMock,
  revalidatePathMock,
  createClientMock,
  createAdminClientMock,
  notifyUsersMock,
  writeAuditLogMock,
  loadDraftInputsForCycleMock,
  toDraftInputSupabaseClientMock,
  generateDraftForCycleMock,
  buildReadinessIssuesMock,
  getBlockingReadinessIssuesMock,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
  revalidatePathMock: vi.fn(),
  createClientMock: vi.fn(),
  createAdminClientMock: vi.fn(),
  notifyUsersMock: vi.fn(),
  writeAuditLogMock: vi.fn(),
  loadDraftInputsForCycleMock: vi.fn(),
  toDraftInputSupabaseClientMock: vi.fn(),
  generateDraftForCycleMock: vi.fn(),
  buildReadinessIssuesMock: vi.fn(),
  getBlockingReadinessIssuesMock: vi.fn(),
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
  createAdminClient: createAdminClientMock,
}))

vi.mock('@/lib/notifications', () => ({
  notifyUsers: notifyUsersMock,
}))

vi.mock('@/lib/audit-log', () => ({
  writeAuditLog: writeAuditLogMock,
}))

vi.mock('@/lib/coverage/draft-inputs', () => ({
  loadDraftInputsForCycle: loadDraftInputsForCycleMock,
  toDraftInputSupabaseClient: toDraftInputSupabaseClientMock,
}))

vi.mock('@/lib/coverage/generate-draft', () => ({
  generateDraftForCycle: generateDraftForCycleMock,
}))

vi.mock('@/lib/coverage/readiness-issues', () => ({
  buildReadinessIssues: buildReadinessIssuesMock,
  getBlockingReadinessIssues: getBlockingReadinessIssuesMock,
}))

import { sendPreliminaryScheduleAction } from '@/app/schedule/actions'

type TestContext = {
  userId?: string | null
  role?: string | null
  cyclePublished?: boolean
  cycleStatus?: 'draft' | 'preliminary' | 'final' | 'archived'
  activeSnapshotId?: string | null
  rpcError?: { message?: string } | null
  rpcWasRefresh?: boolean
  cycleStartDate?: string
  cycleEndDate?: string
  cycleSiteId?: string
  profileFilterSnapshots?: Array<Map<string, unknown>>
  assignmentProfiles?: Array<{
    id: string
    full_name: string | null
    is_active: boolean | null
    on_fmla: boolean | null
    archived_at: string | null
  }>
  shifts?: Array<{
    id: string
    cycle_id: string
    user_id: string | null
    date: string
    shift_type: 'day' | 'night'
    status: 'scheduled' | 'on_call' | 'sick' | 'called_off'
    role: 'lead' | 'staff'
    profiles: { full_name: string } | null
  }>
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
        is(column: string, value: unknown) {
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
          if (
            table === 'profiles' &&
            selected.includes('role') &&
            filters.get('id') === context.userId
          ) {
            return { data: { role: context.role, is_active: true, archived_at: null }, error: null }
          }

          if (table === 'schedule_cycles') {
            return {
              data: {
                id: 'cycle-1',
                label: 'April schedule',
                start_date: context.cycleStartDate ?? '2026-04-01',
                end_date: context.cycleEndDate ?? '2026-04-30',
                published: Boolean(context.cyclePublished),
                status: context.cycleStatus ?? (context.cyclePublished ? 'final' : 'draft'),
                site_id: context.cycleSiteId ?? 'site-1',
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
                data: context.shifts ?? [
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

          if (table === 'profiles' && Array.isArray(filters.get('id'))) {
            const ids = filters.get('id') as string[]
            const rows =
              context.assignmentProfiles ??
              ids.map((id) => ({
                id,
                full_name: 'Active Therapist',
                is_active: true,
                on_fmla: false,
                archived_at: null,
              }))
            return Promise.resolve(
              resolve({
                data: rows.filter((row) => ids.includes(row.id)),
                error: null,
              })
            )
          }

          if (
            table === 'profiles' &&
            Array.isArray(filters.get('role')) &&
            filters.get('is_active') === true
          ) {
            context.profileFilterSnapshots?.push(new Map(filters))
            return Promise.resolve(
              resolve({
                data: [{ id: 'therapist-1' }, { id: 'lead-1' }],
                error: null,
              })
            )
          }

          return Promise.resolve(resolve({ data: [], error: null }))
        },
        insert() {
          throw new Error(`Unexpected direct insert into ${table}`)
        },
        update() {
          throw new Error(`Unexpected direct update on ${table}`)
        },
      }

      return builder
    },
  }
}

function createAdminMock(context: TestContext) {
  return {
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      if (fn !== 'app_send_preliminary_schedule') {
        return { data: null, error: { message: `Unexpected RPC ${fn}` } }
      }

      if (context.rpcError) {
        return { data: null, error: context.rpcError }
      }

      return {
        data: [
          {
            id: context.activeSnapshotId ?? 'snapshot-1',
            label: 'April schedule',
            was_refresh: Boolean(context.rpcWasRefresh),
          },
        ],
        error: null,
        args,
      }
    }),
  }
}

describe('sendPreliminaryScheduleAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    toDraftInputSupabaseClientMock.mockImplementation((client: unknown) => client)
    loadDraftInputsForCycleMock.mockResolvedValue({ data: { cycleId: 'cycle-1' }, error: null })
    generateDraftForCycleMock.mockReturnValue({ generated: true })
    buildReadinessIssuesMock.mockReturnValue([])
    getBlockingReadinessIssuesMock.mockImplementation((issues: Array<{ severity: string }>) =>
      issues.filter((issue) => issue.severity === 'blocking')
    )
    createAdminClientMock.mockReturnValue(createAdminMock({}))
  })

  it('lets a manager send a preliminary schedule for a draft cycle', async () => {
    const profileFilterSnapshots: Array<Map<string, unknown>> = []
    const supabase = createSupabaseMock({
      userId: 'manager-1',
      role: 'manager',
      cyclePublished: false,
      cycleSiteId: 'site-main',
      profileFilterSnapshots,
    })
    const admin = createAdminMock({})
    createClientMock.mockResolvedValue(supabase)
    createAdminClientMock.mockReturnValue(admin)

    await expect(sendPreliminaryScheduleAction(makeFormData())).rejects.toThrow(
      'REDIRECT:/schedule?cycle=cycle-1&success=preliminary_sent'
    )

    expect(admin.rpc).toHaveBeenCalledWith('app_send_preliminary_schedule', {
      p_actor_id: 'manager-1',
      p_cycle_id: 'cycle-1',
    })
    expect(notifyUsersMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'preliminary_sent',
      })
    )
    expect(profileFilterSnapshots.some((filters) => filters.get('site_id') === 'site-main')).toBe(
      true
    )
    expect(profileFilterSnapshots.some((filters) => filters.get('archived_at') === null)).toBe(true)
    expect(revalidatePathMock).toHaveBeenCalledWith('/preliminary')
  })

  it('blocks preliminary send when shared readiness has blocking issues', async () => {
    const blockingIssue = {
      id: 'missing-lead:2026-04-08:day',
      severity: 'blocking',
      type: 'missing_lead',
    }
    buildReadinessIssuesMock.mockReturnValue([blockingIssue])
    const admin = createAdminMock({})
    const supabase = createSupabaseMock({
      userId: 'manager-1',
      role: 'manager',
      cyclePublished: false,
      cycleSiteId: 'site-main',
      shifts: [
        {
          id: 'shift-inactive-1',
          cycle_id: 'cycle-1',
          user_id: 'inactive-1',
          date: '2026-04-02',
          shift_type: 'day',
          status: 'scheduled',
          role: 'staff',
          profiles: { full_name: 'Inactive Therapist' },
        },
      ],
      assignmentProfiles: [
        {
          id: 'inactive-1',
          full_name: 'Inactive Therapist',
          is_active: false,
          on_fmla: false,
          archived_at: null,
        },
      ],
    })
    createClientMock.mockResolvedValue(supabase)
    createAdminClientMock.mockReturnValue(admin)

    await expect(sendPreliminaryScheduleAction(makeFormData())).rejects.toThrow(
      'REDIRECT:/schedule?cycle=cycle-1&error=preliminary_readiness_blocked&readiness_issues=1'
    )

    expect(loadDraftInputsForCycleMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        cycle: expect.objectContaining({
          id: 'cycle-1',
          site_id: 'site-main',
        }),
        therapistScope: 'active-non-fmla',
      })
    )
    expect(buildReadinessIssuesMock).toHaveBeenCalledWith(expect.anything(), {
      ineligibleAssignments: [
        {
          shiftId: 'shift-inactive-1',
          therapistId: 'inactive-1',
          therapistName: 'Inactive Therapist',
          date: '2026-04-02',
          shiftType: 'day',
          reason: 'inactive',
        },
      ],
    })
    expect(admin.rpc).not.toHaveBeenCalled()
    expect(notifyUsersMock).not.toHaveBeenCalled()
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

    expect(createAdminClientMock).not.toHaveBeenCalled()
  })

  it('treats a repeat send as a refresh of the active snapshot', async () => {
    const admin = createAdminMock({ activeSnapshotId: 'snapshot-existing', rpcWasRefresh: true })
    const supabase = createSupabaseMock({
      userId: 'manager-1',
      role: 'manager',
      activeSnapshotId: 'snapshot-existing',
      cycleStatus: 'preliminary',
    })
    createClientMock.mockResolvedValue(supabase)
    createAdminClientMock.mockReturnValue(admin)

    await expect(sendPreliminaryScheduleAction(makeFormData())).rejects.toThrow(
      'REDIRECT:/schedule?cycle=cycle-1&success=preliminary_refreshed'
    )

    expect(admin.rpc).toHaveBeenCalledWith('app_send_preliminary_schedule', {
      p_actor_id: 'manager-1',
      p_cycle_id: 'cycle-1',
    })
  })

  it('delegates open placeholder creation and snapshot refresh to one RPC', async () => {
    const admin = createAdminMock({})
    const supabase = createSupabaseMock({
      userId: 'manager-1',
      role: 'manager',
      cycleStartDate: '2026-04-01',
      cycleEndDate: '2026-04-01',
      shifts: [
        {
          id: 'shift-1',
          cycle_id: 'cycle-1',
          user_id: 'therapist-1',
          date: '2026-04-01',
          shift_type: 'day',
          status: 'scheduled',
          role: 'staff',
          profiles: { full_name: 'Barbara C.' },
        },
      ],
    })
    createClientMock.mockResolvedValue(supabase)
    createAdminClientMock.mockReturnValue(admin)

    await expect(sendPreliminaryScheduleAction(makeFormData())).rejects.toThrow(
      'REDIRECT:/schedule?cycle=cycle-1&success=preliminary_sent'
    )

    expect(admin.rpc).toHaveBeenCalledWith('app_send_preliminary_schedule', {
      p_actor_id: 'manager-1',
      p_cycle_id: 'cycle-1',
    })
  })
})
