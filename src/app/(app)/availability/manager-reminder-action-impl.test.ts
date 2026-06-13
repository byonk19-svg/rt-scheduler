import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getAuthenticatedUserWithRoleMock, getPublishEmailConfigMock, sendReminderEmailsMock } =
  vi.hoisted(() => ({
    getAuthenticatedUserWithRoleMock: vi.fn(),
    getPublishEmailConfigMock: vi.fn(),
    sendReminderEmailsMock: vi.fn(),
  }))

vi.mock('@/app/(app)/availability/_actions/shared', () => ({
  getAuthenticatedUserWithRole: getAuthenticatedUserWithRoleMock,
}))

vi.mock('@/lib/publish-events', () => ({
  getPublishEmailConfig: getPublishEmailConfigMock,
}))

vi.mock('@/lib/availability-reminders', () => ({
  sendAvailabilityReminderEmails: sendReminderEmailsMock,
}))

import { sendAvailabilityRemindersAction } from '@/app/(app)/availability/manager-reminder-action-impl'

type QueryFilter = {
  method: 'eq' | 'in' | 'is' | 'gte' | 'order' | 'limit'
  column: string
  value: unknown
}

type QueryRecord = {
  table: string
  selection?: string
  filters: QueryFilter[]
}

function createReminderSupabaseMock({
  profileRows,
  submissionRows,
  cycleSiteId = 'site-main',
  recentReminderRows = [],
  auditInsertError = null,
}: {
  profileRows: Array<{
    id: string
    full_name: string | null
    email: string | null
    notification_email_enabled: boolean | null
  }>
  submissionRows: Array<{ therapist_id: string }>
  cycleSiteId?: string
  recentReminderRows?: Array<{ created_at: string }>
  auditInsertError?: { message: string } | null
}) {
  const queries: QueryRecord[] = []
  const inserts: Array<{ table: string; payload: unknown }> = []

  return {
    queries,
    inserts,
    from(table: string) {
      const query: QueryRecord = { table, filters: [] }
      queries.push(query)

      const builder = {
        select(selection?: string) {
          query.selection = selection
          return builder
        },
        eq(column: string, value: unknown) {
          query.filters.push({ method: 'eq', column, value })
          return builder
        },
        in(column: string, value: unknown[]) {
          query.filters.push({ method: 'in', column, value })
          return builder
        },
        is(column: string, value: unknown) {
          query.filters.push({ method: 'is', column, value })
          return builder
        },
        gte(column: string, value: unknown) {
          query.filters.push({ method: 'gte', column, value })
          return builder
        },
        order(column: string, value: unknown) {
          query.filters.push({ method: 'order', column, value })
          return builder
        },
        limit(value: number) {
          query.filters.push({ method: 'limit', column: 'limit', value })
          return builder
        },
        insert(payload: unknown) {
          inserts.push({ table, payload })
          return Promise.resolve({ error: auditInsertError })
        },
        maybeSingle: async () => {
          if (table === 'schedule_cycles') {
            return {
              data: {
                start_date: '2026-03-22',
                end_date: '2026-05-02',
                site_id: cycleSiteId,
              },
              error: null,
            }
          }

          return { data: null, error: null }
        },
        then(resolve: (value: unknown) => unknown) {
          if (table === 'profiles') {
            return Promise.resolve(resolve({ data: profileRows, error: null }))
          }

          if (table === 'therapist_availability_submissions') {
            return Promise.resolve(resolve({ data: submissionRows, error: null }))
          }

          if (table === 'audit_log') {
            return Promise.resolve(resolve({ data: recentReminderRows, error: null }))
          }

          return Promise.resolve(resolve({ data: [], error: null }))
        },
      }

      return builder
    },
  }
}

describe('sendAvailabilityRemindersAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPublishEmailConfigMock.mockReturnValue({
      configured: true,
      resendApiKey: 'test-key',
      fromEmail: 'Teamwise <noreply@mail.teamwise.work>',
      resendApiUrl: 'https://api.resend.com/emails',
      appBaseUrl: 'https://www.teamwise.work',
    })
    sendReminderEmailsMock.mockResolvedValue({ sent: 1, failed: 0 })
  })

  it('keeps reminder recipients scoped to all missing submissions for the Schedule Block', async () => {
    const supabase = createReminderSupabaseMock({
      profileRows: [
        {
          id: 'submitted-therapist',
          full_name: 'Adrienne S.',
          email: 'adrienne@example.com',
          notification_email_enabled: true,
        },
        {
          id: 'missing-therapist',
          full_name: 'Layne P.',
          email: 'layne@example.com',
          notification_email_enabled: true,
        },
        {
          id: 'email-disabled',
          full_name: 'Tannie L.',
          email: 'tannie@example.com',
          notification_email_enabled: false,
        },
        {
          id: 'missing-email',
          full_name: 'Rosa V.',
          email: null,
          notification_email_enabled: true,
        },
      ],
      submissionRows: [{ therapist_id: 'submitted-therapist' }],
    })
    getAuthenticatedUserWithRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'manager-1' },
      role: 'manager',
      siteId: 'site-main',
      permissionContext: { isActive: true, archivedAt: null },
    })

    const result = await sendAvailabilityRemindersAction('cycle-1')

    expect(result).toEqual({ sent: 1, skipped: 2, failed: 0 })
    expect(sendReminderEmailsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        recipients: [
          {
            therapistId: 'missing-therapist',
            email: 'layne@example.com',
            name: 'Layne P.',
          },
        ],
      })
    )
    expect(supabase.queries.find((query) => query.table === 'profiles')?.filters).toEqual(
      expect.arrayContaining([
        { method: 'in', column: 'role', value: ['therapist', 'lead'] },
        { method: 'eq', column: 'is_active', value: true },
        { method: 'is', column: 'archived_at', value: null },
        { method: 'eq', column: 'on_fmla', value: false },
        { method: 'eq', column: 'site_id', value: 'site-main' },
      ])
    )
    expect(
      supabase.queries.find((query) => query.table === 'therapist_availability_submissions')
        ?.filters
    ).toContainEqual({ method: 'eq', column: 'schedule_cycle_id', value: 'cycle-1' })
    expect(supabase.inserts).toEqual([
      {
        table: 'audit_log',
        payload: {
          user_id: 'manager-1',
          action: 'availability_reminders_sent',
          target_type: 'schedule_cycle',
          target_id: 'cycle-1',
        },
      },
    ])
  })

  it('surfaces duplicate marker write failure after reminders are sent', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const supabase = createReminderSupabaseMock({
      profileRows: [
        {
          id: 'missing-therapist',
          full_name: 'Layne P.',
          email: 'layne@example.com',
          notification_email_enabled: true,
        },
      ],
      submissionRows: [],
      auditInsertError: { message: 'audit unavailable' },
    })
    getAuthenticatedUserWithRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'manager-1' },
      role: 'manager',
      siteId: 'site-main',
      permissionContext: { isActive: true, archivedAt: null },
    })

    const result = await sendAvailabilityRemindersAction('cycle-1')

    expect(result).toEqual({
      sent: 1,
      skipped: 0,
      failed: 0,
      error: 'duplicate_marker_failed',
    })
    expect(sendReminderEmailsMock).toHaveBeenCalledTimes(1)
    expect(supabase.inserts).toEqual([
      {
        table: 'audit_log',
        payload: {
          user_id: 'manager-1',
          action: 'availability_reminders_sent',
          target_type: 'schedule_cycle',
          target_id: 'cycle-1',
        },
      },
    ])
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[sendAvailabilityRemindersAction] reminder audit write failed:',
      { message: 'audit unavailable' }
    )
    consoleErrorSpy.mockRestore()
  })

  it('does not send reminders for a Schedule Block outside the manager site', async () => {
    const supabase = createReminderSupabaseMock({
      cycleSiteId: 'site-other',
      profileRows: [
        {
          id: 'missing-therapist',
          full_name: 'Layne P.',
          email: 'layne@example.com',
          notification_email_enabled: true,
        },
      ],
      submissionRows: [],
    })
    getAuthenticatedUserWithRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'manager-1' },
      role: 'manager',
      siteId: 'site-main',
      permissionContext: { isActive: true, archivedAt: null },
    })

    const result = await sendAvailabilityRemindersAction('cycle-1')

    expect(result).toEqual({ sent: 0, skipped: 0, failed: 0, error: 'cycle_not_found' })
    expect(sendReminderEmailsMock).not.toHaveBeenCalled()
    expect(supabase.queries.some((query) => query.table === 'profiles')).toBe(false)
    expect(
      supabase.queries.some((query) => query.table === 'therapist_availability_submissions')
    ).toBe(false)
  })

  it('does not allow non-manager users to send reminders', async () => {
    const supabase = createReminderSupabaseMock({
      profileRows: [
        {
          id: 'missing-therapist',
          full_name: 'Layne P.',
          email: 'layne@example.com',
          notification_email_enabled: true,
        },
      ],
      submissionRows: [],
    })
    getAuthenticatedUserWithRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'therapist-1' },
      role: 'therapist',
      siteId: 'site-main',
      permissionContext: { isActive: true, archivedAt: null },
    })

    const result = await sendAvailabilityRemindersAction('cycle-1')

    expect(result).toEqual({ sent: 0, skipped: 0, failed: 0, error: 'unauthorized' })
    expect(sendReminderEmailsMock).not.toHaveBeenCalled()
    expect(supabase.queries).toEqual([])
    expect(supabase.inserts).toEqual([])
  })

  it('blocks duplicate reminder sends for the same Schedule Block within the recent window', async () => {
    const supabase = createReminderSupabaseMock({
      profileRows: [
        {
          id: 'missing-therapist',
          full_name: 'Layne P.',
          email: 'layne@example.com',
          notification_email_enabled: true,
        },
      ],
      submissionRows: [],
      recentReminderRows: [{ created_at: '2026-06-10T10:30:00.000Z' }],
    })
    getAuthenticatedUserWithRoleMock.mockResolvedValue({
      supabase,
      user: { id: 'manager-1' },
      role: 'manager',
      siteId: 'site-main',
      permissionContext: { isActive: true, archivedAt: null },
    })

    const result = await sendAvailabilityRemindersAction('cycle-1')

    expect(result).toEqual({
      sent: 0,
      skipped: 0,
      failed: 0,
      error: 'recently_sent',
      lastSentAt: '2026-06-10T10:30:00.000Z',
    })
    expect(sendReminderEmailsMock).not.toHaveBeenCalled()
    expect(supabase.queries.find((query) => query.table === 'audit_log')?.filters).toEqual(
      expect.arrayContaining([
        { method: 'eq', column: 'action', value: 'availability_reminders_sent' },
        { method: 'eq', column: 'target_type', value: 'schedule_cycle' },
        { method: 'eq', column: 'target_id', value: 'cycle-1' },
        expect.objectContaining({ method: 'gte', column: 'created_at' }),
      ])
    )
    expect(supabase.queries.some((query) => query.table === 'profiles')).toBe(false)
    expect(supabase.inserts).toEqual([])
  })
})
