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
  method: 'eq' | 'in' | 'is'
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
}: {
  profileRows: Array<{
    id: string
    full_name: string | null
    email: string | null
    notification_email_enabled: boolean | null
  }>
  submissionRows: Array<{ therapist_id: string }>
}) {
  const queries: QueryRecord[] = []

  return {
    queries,
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
        maybeSingle: async () => {
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
          if (table === 'profiles') {
            return Promise.resolve(resolve({ data: profileRows, error: null }))
          }

          if (table === 'therapist_availability_submissions') {
            return Promise.resolve(resolve({ data: submissionRows, error: null }))
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
      role: 'manager',
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
      ])
    )
    expect(
      supabase.queries.find((query) => query.table === 'therapist_availability_submissions')
        ?.filters
    ).toContainEqual({ method: 'eq', column: 'schedule_cycle_id', value: 'cycle-1' })
  })
})
