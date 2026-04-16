import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const {
  redirectMock,
  revalidatePathMock,
  createClientMock,
  approvePreliminaryRequestMock,
  denyPreliminaryRequestMock,
  notifyUsersMock,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
  revalidatePathMock: vi.fn(),
  createClientMock: vi.fn(),
  approvePreliminaryRequestMock: vi.fn(),
  denyPreliminaryRequestMock: vi.fn(),
  notifyUsersMock: vi.fn(),
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

vi.mock('@/lib/preliminary-schedule/mutations', () => ({
  approvePreliminaryRequest: approvePreliminaryRequestMock,
  denyPreliminaryRequest: denyPreliminaryRequestMock,
}))

vi.mock('@/lib/notifications', () => ({
  notifyUsers: notifyUsersMock,
}))

import ApprovalsPage from '@/app/(app)/approvals/page'
import {
  approvePreliminaryRequestAction,
  denyPreliminaryRequestAction,
} from '@/app/approvals/actions'

type TestContext = {
  userId?: string | null
  role?: string | null
  pendingRequests?: Array<{
    id: string
    snapshot_id: string
    shift_id: string
    requester_id: string
    type: string
    status: string
    note: string | null
    decision_note: string | null
    approved_by: string | null
    approved_at: string | null
    created_at: string
  }>
  hasActivePreliminary?: boolean
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
        in(column: string, value: unknown[]) {
          filters.set(column, value)
          return builder
        },
        order() {
          return builder
        },
        limit() {
          return builder
        },
        async maybeSingle() {
          if (table === 'profiles' && selected === 'role' && filters.get('id') === context.userId) {
            return { data: { role: context.role }, error: null }
          }

          return { data: null, error: null }
        },
        then(resolve: (value: { data: unknown; error: null }) => unknown) {
          if (table === 'preliminary_requests') {
            return Promise.resolve(
              resolve({
                data: context.pendingRequests ?? [
                  {
                    id: 'request-1',
                    snapshot_id: 'snapshot-1',
                    shift_id: 'shift-1',
                    requester_id: 'therapist-1',
                    type: 'claim_open_shift',
                    status: 'pending',
                    note: 'I can fill this shift.',
                    decision_note: null,
                    approved_by: null,
                    approved_at: null,
                    created_at: '2026-03-19T10:00:00.000Z',
                  },
                ],
                error: null,
              })
            )
          }

          if (table === 'shifts') {
            return Promise.resolve(
              resolve({
                data: [
                  {
                    id: 'shift-1',
                    cycle_id: 'cycle-1',
                    user_id: null,
                    date: '2026-03-22',
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
            return Promise.resolve(
              resolve({
                data: [{ id: 'therapist-1', full_name: 'Barbara C.' }],
                error: null,
              })
            )
          }

          if (table === 'preliminary_snapshots') {
            return Promise.resolve(
              resolve({
                data: context.hasActivePreliminary ? [{ id: 'snapshot-1' }] : [],
                error: null,
              })
            )
          }

          return Promise.resolve(resolve({ data: [], error: null }))
        },
        update() {
          return {
            eq() {
              return Promise.resolve({ data: null, error: null })
            },
          }
        },
      }

      return builder
    },
  }
}

function makeFormData() {
  const formData = new FormData()
  formData.set('request_id', 'request-1')
  return formData
}

describe('approvals preliminary queue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    approvePreliminaryRequestMock.mockResolvedValue({
      data: {
        id: 'request-1',
        requester_id: 'therapist-1',
        snapshot_id: 'snapshot-1',
        shift_id: 'shift-1',
        type: 'claim_open_shift',
        status: 'approved',
        note: 'I can fill this shift.',
      },
      error: null,
    })
    denyPreliminaryRequestMock.mockResolvedValue({
      data: {
        id: 'request-1',
        requester_id: 'therapist-1',
        snapshot_id: 'snapshot-1',
        shift_id: 'shift-1',
        type: 'claim_open_shift',
        status: 'denied',
        note: 'I can fill this shift.',
      },
      error: null,
    })
  })

  it('renders pending preliminary requests for managers', async () => {
    createClientMock.mockResolvedValue(
      createSupabaseMock({
        userId: 'manager-1',
        role: 'manager',
      })
    )

    const html = renderToStaticMarkup(await ApprovalsPage({ searchParams: Promise.resolve({}) }))

    expect(html).toContain('Preliminary approvals')
    expect(html).toContain('Barbara C.')
    expect(html).toContain('Approve')
    expect(html).toContain('I can fill this shift.')
  })

  it('redirects non-managers away from approvals', async () => {
    createClientMock.mockResolvedValue(
      createSupabaseMock({
        userId: 'therapist-1',
        role: 'therapist',
      })
    )

    await expect(ApprovalsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'REDIRECT:/dashboard'
    )
  })

  it('renders a compact empty state with a coverage CTA when the queue is clear', async () => {
    createClientMock.mockResolvedValue(
      createSupabaseMock({
        userId: 'manager-1',
        role: 'manager',
        pendingRequests: [],
        hasActivePreliminary: false,
      })
    )

    const html = renderToStaticMarkup(await ApprovalsPage({ searchParams: Promise.resolve({}) }))

    expect(html).toContain('No pending preliminary requests')
    expect(html).toContain('Send a preliminary schedule from Coverage to open this queue.')
    expect(html).toContain('Send preliminary from Coverage')
    expect(html).not.toContain('Approve')
  })

  it('approves and denies preliminary requests through server actions', async () => {
    createClientMock.mockResolvedValue(
      createSupabaseMock({
        userId: 'manager-1',
        role: 'manager',
      })
    )

    await expect(approvePreliminaryRequestAction(makeFormData())).rejects.toThrow(
      'REDIRECT:/approvals?success=preliminary_request_approved'
    )
    await expect(denyPreliminaryRequestAction(makeFormData())).rejects.toThrow(
      'REDIRECT:/approvals?success=preliminary_request_denied'
    )

    expect(approvePreliminaryRequestMock).toHaveBeenCalledTimes(1)
    expect(denyPreliminaryRequestMock).toHaveBeenCalledTimes(1)
    expect(revalidatePathMock).toHaveBeenCalledWith('/preliminary')
  })
})
