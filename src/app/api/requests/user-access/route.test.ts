import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  createClientMock,
  createAdminClientMock,
  isTrustedMutationRequestMock,
  linkEmployeeRosterToProfileMock,
  fetchMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createAdminClientMock: vi.fn(),
  isTrustedMutationRequestMock: vi.fn(() => true),
  linkEmployeeRosterToProfileMock: vi.fn(async () => undefined),
  fetchMock: vi.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => '',
  })),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}))

vi.mock('@/lib/security/request-origin', () => ({
  isTrustedMutationRequest: isTrustedMutationRequestMock,
}))

vi.mock('@/lib/employee-roster-link', () => ({
  linkEmployeeRosterToProfile: linkEmployeeRosterToProfileMock,
}))

import { POST } from '@/app/api/requests/user-access/route'

type ManagerAccessContext = {
  userId?: string | null
  role?: string | null
  isActive?: boolean | null
  archivedAt?: string | null
  siteId?: string | null
}

function makeServerClient(context: ManagerAccessContext) {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: context.userId ? { id: context.userId } : null,
        },
      })),
    },
    from(table: string) {
      if (table !== 'profiles') {
        throw new Error(`Unexpected server table ${table}`)
      }

      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({
                  data: context.userId
                    ? {
                        role: context.role ?? 'manager',
                        is_active: context.isActive ?? true,
                        archived_at: context.archivedAt ?? null,
                        site_id: Object.prototype.hasOwnProperty.call(context, 'siteId')
                          ? context.siteId
                          : 'site-a',
                      }
                    : null,
                  error: null,
                }),
              }
            },
          }
        },
      }
    },
  } as never
}

function makeAdminClient() {
  const state = {
    profileUpdatePayload: null as Record<string, unknown> | null,
    profileUpdateFilters: [] as Array<[string, unknown]>,
    deletedWorkPatternsForProfileId: null as string | null,
    selectedPendingProfile: {
      id: 'profile-1',
      email: 'therapist@example.com',
      full_name: 'Taylor Therapist',
      site_id: 'site-a',
    },
  }

  const makeProfilesSelectChain = () => {
    const query = {
      eq() {
        return query
      },
      maybeSingle: async () => ({
        data: state.selectedPendingProfile,
        error: null,
      }),
    }
    return query
  }

  return {
    state,
    from(table: string) {
      if (table === 'profiles') {
        return {
          select() {
            return makeProfilesSelectChain()
          },
          update(payload: Record<string, unknown>) {
            state.profileUpdatePayload = payload

            const query = {
              eq(column: string, value: unknown) {
                state.profileUpdateFilters.push([column, value])
                return query
              },
              then(resolve: (value: unknown) => unknown) {
                return Promise.resolve(resolve({ data: null, error: null }))
              },
            }
            return query
          },
        }
      }

      if (table === 'work_patterns') {
        return {
          delete() {
            return {
              eq: async (_column: string, value: unknown) => {
                state.deletedWorkPatternsForProfileId = String(value)
                return {
                  data: null,
                  error: null,
                }
              },
            }
          },
        }
      }

      throw new Error(`Unexpected admin table ${table}`)
    },
  }
}

function makeApproveRequest(role: 'therapist' | 'lead' = 'therapist') {
  return new Request('https://teamwise.test/api/requests/user-access', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://teamwise.test',
    },
    body: JSON.stringify({
      action: 'approve',
      profileId: 'profile-1',
      role,
    }),
  })
}

describe('user access approval route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
    isTrustedMutationRequestMock.mockReturnValue(true)
    createClientMock.mockResolvedValue(makeServerClient({ userId: 'manager-1', role: 'manager' }))
    process.env.RESEND_API_KEY = 'test-key'
    process.env.PUBLISH_EMAIL_FROM = 'noreply@teamwise.test'
    process.env.NEXT_PUBLIC_APP_URL = 'https://teamwise.test'
  })

  it.each(['therapist', 'lead'] as const)(
    'resets onboarding-required fields when approving %s access',
    async (role) => {
      const adminClient = makeAdminClient()
      createAdminClientMock.mockReturnValue(adminClient)

      const response = await POST(makeApproveRequest(role))

      expect(response.status).toBe(200)
      expect(adminClient.state.profileUpdatePayload).toMatchObject({
        role,
        access_status: 'approved',
        is_active: true,
        archived_at: null,
        staff_onboarding_required: true,
        staff_onboarding_completed_at: null,
        staff_onboarding_preferences_confirmed_at: null,
        staff_onboarding_theme_confirmed_at: null,
        preferred_work_days: [],
        preferred_work_days_mode: 'unset',
      })
      expect(adminClient.state.profileUpdateFilters).toContainEqual(['site_id', 'site-a'])
      expect(adminClient.state.deletedWorkPatternsForProfileId).toBe('profile-1')
      expect(linkEmployeeRosterToProfileMock).toHaveBeenCalledWith({
        id: 'profile-1',
        full_name: 'Taylor Therapist',
        email: 'therapist@example.com',
      })
      expect(fetchMock).toHaveBeenCalledTimes(1)
    }
  )

  it('blocks managers without a site before admin approval work', async () => {
    const adminClient = makeAdminClient()
    createClientMock.mockResolvedValue(
      makeServerClient({ userId: 'manager-1', role: 'manager', siteId: null })
    )
    createAdminClientMock.mockReturnValue(adminClient)

    const response = await POST(makeApproveRequest())

    expect(response.status).toBe(403)
    expect(adminClient.state.profileUpdatePayload).toBeNull()
    expect(linkEmployeeRosterToProfileMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
