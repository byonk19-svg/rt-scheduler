import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createServerClientMock, isValidPublishWorkerRequestMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
  isValidPublishWorkerRequestMock: vi.fn(async () => false),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: createServerClientMock,
}))

vi.mock('@/lib/security/worker-auth', () => ({
  isValidPublishWorkerRequest: isValidPublishWorkerRequestMock,
}))

import { NextRequest } from 'next/server'

import { proxy } from '@/proxy'

type ProxyScenario = {
  user?: {
    id: string
    app_metadata?: Record<string, unknown>
    user_metadata?: Record<string, unknown>
  } | null
  profile?: {
    role: string | null
    access_status?: string | null
    is_active: boolean | null
    archived_at: string | null
    staff_onboarding_required: boolean | null
    preferred_work_days_mode: 'unset' | 'specific_days' | 'no_preference' | null
    staff_onboarding_preferences_confirmed_at: string | null
    staff_onboarding_theme_confirmed_at: string | null
    staff_onboarding_completed_at: string | null
    work_patterns:
      | {
          pattern_type:
            | 'weekly_fixed'
            | 'weekly_with_weekend_rotation'
            | 'repeating_cycle'
            | 'none'
            | null
        }[]
      | null
  } | null
}

function makeSupabaseMock(scenario: ProxyScenario) {
  const resolvedUser = Object.prototype.hasOwnProperty.call(scenario, 'user')
    ? scenario.user
    : { id: 'user-1' }
  const resolvedProfile = Object.prototype.hasOwnProperty.call(scenario, 'profile')
    ? scenario.profile
    : ({
        role: 'therapist',
        access_status: 'approved',
        is_active: true,
        archived_at: null,
        staff_onboarding_required: false,
        staff_onboarding_completed_at: null,
        preferred_work_days_mode: 'unset',
        staff_onboarding_preferences_confirmed_at: null,
        staff_onboarding_theme_confirmed_at: null,
        work_patterns: null,
      } satisfies NonNullable<ProxyScenario['profile']>)

  return {
    auth: {
      getUser: async () => ({
        data: {
          user: resolvedUser,
        },
      }),
    },
    from(table: string) {
      if (table !== 'profiles') {
        throw new Error(`Unexpected table ${table}`)
      }

      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({
                  data: resolvedProfile,
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

function makeRequest(path: string) {
  return new NextRequest(`https://teamwise.test${path}`)
}

describe('proxy onboarding and pending gates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isValidPublishWorkerRequestMock.mockResolvedValue(false)
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.test'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  })

  it('keeps the inbound availability webhook public and bypasses auth middleware', async () => {
    const response = await proxy(makeRequest('/api/inbound/availability-email'))

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
    expect(createServerClientMock).not.toHaveBeenCalled()
  })

  it('redirects unauthenticated schedule access to login with a return path', async () => {
    createServerClientMock.mockReturnValue(
      makeSupabaseMock({
        user: null,
      })
    )

    const response = await proxy(makeRequest('/schedule'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://teamwise.test/login?redirectTo=%2Fschedule'
    )
  })

  it('redirects incomplete required staff to onboarding and preserves current search params', async () => {
    createServerClientMock.mockReturnValue(
      makeSupabaseMock({
        profile: {
          role: 'therapist',
          access_status: 'approved',
          is_active: true,
          archived_at: null,
          staff_onboarding_required: true,
          preferred_work_days_mode: 'unset',
          staff_onboarding_preferences_confirmed_at: null,
          staff_onboarding_theme_confirmed_at: null,
          staff_onboarding_completed_at: null,
          work_patterns: null,
        },
      })
    )

    const response = await proxy(makeRequest('/dashboard?success=signed_in'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://teamwise.test/onboarding?success=signed_in'
    )
  })

  it('keeps onboarding step routes reachable while required setup is still incomplete', async () => {
    createServerClientMock.mockReturnValue(
      makeSupabaseMock({
        profile: {
          role: 'therapist',
          access_status: 'approved',
          is_active: true,
          archived_at: null,
          staff_onboarding_required: true,
          preferred_work_days_mode: 'unset',
          staff_onboarding_preferences_confirmed_at: null,
          staff_onboarding_theme_confirmed_at: null,
          staff_onboarding_completed_at: null,
          work_patterns: null,
        },
      })
    )

    const response = await proxy(
      makeRequest('/therapist/recurring-pattern?return_to=%2Fonboarding')
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })

  it('allows future availability from onboarding once the required setup steps are complete', async () => {
    createServerClientMock.mockReturnValue(
      makeSupabaseMock({
        profile: {
          role: 'therapist',
          access_status: 'approved',
          is_active: true,
          archived_at: null,
          staff_onboarding_required: true,
          preferred_work_days_mode: 'no_preference',
          staff_onboarding_preferences_confirmed_at: '2026-04-29T12:00:00.000Z',
          staff_onboarding_theme_confirmed_at: '2026-04-29T12:05:00.000Z',
          staff_onboarding_completed_at: null,
          work_patterns: [{ pattern_type: 'none' }],
        },
      })
    )

    const response = await proxy(makeRequest('/therapist/availability'))

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })

  it('preserves success query params when sending staff from /dashboard to /dashboard/staff', async () => {
    createServerClientMock.mockReturnValue(
      makeSupabaseMock({
        profile: {
          role: 'therapist',
          access_status: 'approved',
          is_active: true,
          archived_at: null,
          staff_onboarding_required: false,
          preferred_work_days_mode: 'unset',
          staff_onboarding_preferences_confirmed_at: null,
          staff_onboarding_theme_confirmed_at: null,
          staff_onboarding_completed_at: '2026-04-29T12:00:00.000Z',
          work_patterns: null,
        },
      })
    )

    const response = await proxy(makeRequest('/dashboard?success=onboarding_complete'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://teamwise.test/dashboard/staff?success=onboarding_complete'
    )
  })

  it('does not redirect managers to onboarding', async () => {
    createServerClientMock.mockReturnValue(
      makeSupabaseMock({
        profile: {
          role: 'manager',
          access_status: 'approved',
          is_active: true,
          archived_at: null,
          staff_onboarding_required: true,
          preferred_work_days_mode: 'unset',
          staff_onboarding_preferences_confirmed_at: null,
          staff_onboarding_theme_confirmed_at: null,
          staff_onboarding_completed_at: null,
          work_patterns: null,
        },
      })
    )

    const response = await proxy(makeRequest('/dashboard?success=signed_in'))

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })

  it('does not use auth metadata role when the profile row has not been created yet', async () => {
    createServerClientMock.mockReturnValue(
      makeSupabaseMock({
        user: { id: 'manager-1', user_metadata: { role: 'manager' } },
        profile: null,
      })
    )

    const response = await proxy(makeRequest('/dashboard'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://teamwise.test/pending-setup')
  })

  it('redirects signed-in users without a role to pending setup', async () => {
    createServerClientMock.mockReturnValue(
      makeSupabaseMock({
        profile: {
          role: null,
          access_status: 'approved',
          is_active: true,
          archived_at: null,
          staff_onboarding_required: false,
          preferred_work_days_mode: 'unset',
          staff_onboarding_preferences_confirmed_at: null,
          staff_onboarding_theme_confirmed_at: null,
          staff_onboarding_completed_at: null,
          work_patterns: null,
        },
      })
    )

    const response = await proxy(makeRequest('/dashboard'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://teamwise.test/pending-setup')
  })

  it('redirects pending access users to pending setup before inactive signout', async () => {
    createServerClientMock.mockReturnValue(
      makeSupabaseMock({
        profile: {
          role: 'therapist',
          access_status: 'pending',
          is_active: false,
          archived_at: null,
          staff_onboarding_required: false,
          preferred_work_days_mode: 'unset',
          staff_onboarding_preferences_confirmed_at: null,
          staff_onboarding_theme_confirmed_at: null,
          staff_onboarding_completed_at: null,
          work_patterns: null,
        },
      })
    )

    const response = await proxy(makeRequest('/dashboard'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://teamwise.test/pending-setup')
  })

  it('signs inactive users out and sends them back to login with an auth error', async () => {
    createServerClientMock.mockReturnValue(
      makeSupabaseMock({
        profile: {
          role: 'therapist',
          access_status: 'approved',
          is_active: false,
          archived_at: null,
          staff_onboarding_required: false,
          preferred_work_days_mode: 'unset',
          staff_onboarding_preferences_confirmed_at: null,
          staff_onboarding_theme_confirmed_at: null,
          staff_onboarding_completed_at: null,
          work_patterns: null,
        },
      })
    )

    const response = await proxy(makeRequest('/dashboard'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://teamwise.test/auth/signout?next=%2Flogin%3Ferror%3Daccount_inactive'
    )
  })

  it('redirects managers away from staff-only routes', async () => {
    createServerClientMock.mockReturnValue(
      makeSupabaseMock({
        profile: {
          role: 'manager',
          access_status: 'approved',
          is_active: true,
          archived_at: null,
          staff_onboarding_required: false,
          preferred_work_days_mode: 'unset',
          staff_onboarding_preferences_confirmed_at: null,
          staff_onboarding_theme_confirmed_at: null,
          staff_onboarding_completed_at: null,
          work_patterns: null,
        },
      })
    )

    const response = await proxy(makeRequest('/requests/new'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://teamwise.test/dashboard')
  })
})
