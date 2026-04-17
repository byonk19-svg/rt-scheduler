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

import {
  approvePendingAccessRequestAction,
  declinePendingAccessRequestAction,
} from '@/app/requests/user-access/actions'

type ServerContext = {
  userId?: string | null
  role?: string | null
}

function createServerSupabaseMock(context: ServerContext) {
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
      return {
        select() {
          return this
        },
        eq(column: string, value: unknown) {
          filters.set(column, value)
          return this
        },
        maybeSingle: async () => {
          if (table === 'profiles' && filters.get('id') === context.userId) {
            return { data: { role: context.role ?? null }, error: null }
          }
          return { data: null, error: null }
        },
      }
    },
  }
}

type AdminState = {
  profileRole: string | null
  approvedRole: string | null
  deletedUserId: string | null
}

function createAdminSupabaseMock(state: AdminState) {
  return {
    auth: {
      admin: {
        deleteUser: vi.fn(async (userId: string) => {
          state.deletedUserId = userId
          return { error: null }
        }),
      },
    },
    from(table: string) {
      const filters = new Map<string, unknown>()
      const nullFilters = new Set<string>()
      return {
        select() {
          return this
        },
        eq(column: string, value: unknown) {
          filters.set(column, value)
          return this
        },
        is(column: string, value: unknown) {
          if (value === null) nullFilters.add(column)
          return this
        },
        order() {
          return this
        },
        maybeSingle: async () => {
          if (table !== 'profiles') return { data: null, error: null }
          const id = String(filters.get('id') ?? '')
          if (!id || !nullFilters.has('role')) return { data: null, error: null }
          if (state.profileRole !== null) return { data: null, error: null }
          return {
            data: {
              id,
              email: 'pending.user@teamwise.test',
              full_name: 'Pending User',
            },
            error: null,
          }
        },
        update(payload: Record<string, unknown>) {
          const updateBuilder = {
            eq(column: string, value: unknown) {
              void column
              void value
              return updateBuilder
            },
            is: async (isColumn: string, isValue: unknown) => {
              void isColumn
              void isValue
              if (table === 'profiles') {
                state.approvedRole = (payload.role as string) ?? null
                state.profileRole = state.approvedRole
              }
              return { error: null }
            },
          }
          return updateBuilder
        },
      }
    },
  }
}

function makeApproveFormData(role: 'therapist' | 'lead' = 'lead') {
  const formData = new FormData()
  formData.set('profile_id', 'pending-user-id')
  formData.set('role', role)
  return formData
}

function makeDeclineFormData() {
  const formData = new FormData()
  formData.set('profile_id', 'pending-user-id')
  return formData
}

describe('approvePendingAccessRequestAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => '',
      }))
    )
    process.env.RESEND_API_KEY = 'resend-key'
    process.env.PUBLISH_EMAIL_FROM = 'Teamwise <noreply@mail.teamwise.work>'
    process.env.NEXT_PUBLIC_APP_URL = 'https://www.teamwise.work'
  })

  it('approves pending users, assigns selected role, sends email, and redirects', async () => {
    const serverSupabase = createServerSupabaseMock({ userId: 'manager-1', role: 'manager' })
    const adminState: AdminState = { profileRole: null, approvedRole: null, deletedUserId: null }
    const adminSupabase = createAdminSupabaseMock(adminState)
    createClientMock.mockResolvedValue(serverSupabase)
    createAdminClientMock.mockReturnValue(adminSupabase)

    await expect(approvePendingAccessRequestAction(makeApproveFormData('lead'))).rejects.toThrow(
      'REDIRECT:/requests/user-access?success=approved'
    )

    expect(adminState.approvedRole).toBe('lead')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(revalidatePathMock).toHaveBeenCalledWith('/requests/user-access')
  })

  it('rejects invalid role before approval', async () => {
    const serverSupabase = createServerSupabaseMock({ userId: 'manager-1', role: 'manager' })
    createClientMock.mockResolvedValue(serverSupabase)

    const formData = new FormData()
    formData.set('profile_id', 'pending-user-id')
    formData.set('role', 'manager')

    await expect(approvePendingAccessRequestAction(formData)).rejects.toThrow(
      'REDIRECT:/requests/user-access?error=invalid_approval'
    )
  })

  it('rejects non-manager access', async () => {
    const serverSupabase = createServerSupabaseMock({ userId: 'therapist-1', role: 'therapist' })
    createClientMock.mockResolvedValue(serverSupabase)

    await expect(approvePendingAccessRequestAction(makeApproveFormData())).rejects.toThrow(
      'REDIRECT:/dashboard'
    )
  })
})

describe('declinePendingAccessRequestAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes pending auth user and redirects success', async () => {
    const serverSupabase = createServerSupabaseMock({ userId: 'manager-1', role: 'manager' })
    const adminState: AdminState = { profileRole: null, approvedRole: null, deletedUserId: null }
    const adminSupabase = createAdminSupabaseMock(adminState)
    createClientMock.mockResolvedValue(serverSupabase)
    createAdminClientMock.mockReturnValue(adminSupabase)

    await expect(declinePendingAccessRequestAction(makeDeclineFormData())).rejects.toThrow(
      'REDIRECT:/requests/user-access?success=declined'
    )

    expect(adminState.deletedUserId).toBe('pending-user-id')
    expect(revalidatePathMock).toHaveBeenCalledWith('/requests/user-access')
  })

  it('rejects non-manager access', async () => {
    const serverSupabase = createServerSupabaseMock({ userId: 'therapist-1', role: 'therapist' })
    createClientMock.mockResolvedValue(serverSupabase)

    await expect(declinePendingAccessRequestAction(makeDeclineFormData())).rejects.toThrow(
      'REDIRECT:/dashboard'
    )
  })
})
