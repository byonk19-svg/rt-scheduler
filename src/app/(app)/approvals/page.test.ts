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
  requesterShiftType?: 'day' | 'night' | null
  affectedShiftUserId?: string | null
  affectedShiftProfileName?: string | null
  impactShifts?: Array<{
    id: string
    cycle_id: string | null
    user_id: string | null
    date: string
    shift_type: 'day' | 'night'
    status: string
    role: string
  }>
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
          if (
            table === 'profiles' &&
            selected.includes('role') &&
            filters.get('id') === context.userId
          ) {
            return { data: { role: context.role, is_active: true, archived_at: null }, error: null }
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

          if (table === 'shifts' && selected.includes('profiles:')) {
            return Promise.resolve(
              resolve({
                data: [
                  {
                    id: 'shift-1',
                    cycle_id: 'cycle-1',
                    user_id: context.affectedShiftUserId ?? null,
                    date: '2026-03-22',
                    shift_type: 'day',
                    status: 'scheduled',
                    role: 'staff',
                    profiles: context.affectedShiftProfileName
                      ? { full_name: context.affectedShiftProfileName }
                      : null,
                  },
                ],
                error: null,
              })
            )
          }

          if (table === 'shifts') {
            return Promise.resolve(
              resolve({
                data: context.impactShifts ?? [
                  {
                    id: 'shift-1',
                    cycle_id: 'cycle-1',
                    user_id: null,
                    date: '2026-03-22',
                    shift_type: 'day',
                    status: 'scheduled',
                    role: 'staff',
                  },
                  {
                    id: 'shift-2',
                    cycle_id: 'cycle-1',
                    user_id: 'lead-1',
                    date: '2026-03-22',
                    shift_type: 'day',
                    status: 'scheduled',
                    role: 'lead',
                  },
                  {
                    id: 'shift-3',
                    cycle_id: 'cycle-1',
                    user_id: 'staff-2',
                    date: '2026-03-22',
                    shift_type: 'day',
                    status: 'scheduled',
                    role: 'staff',
                  },
                ],
                error: null,
              })
            )
          }

          if (table === 'profiles' && Array.isArray(filters.get('id'))) {
            return Promise.resolve(
              resolve({
                data: [
                  {
                    id: 'therapist-1',
                    full_name: 'Barbara C.',
                    shift_type: context.requesterShiftType ?? 'day',
                  },
                ],
                error: null,
              })
            )
          }

          if (table === 'schedule_cycles') {
            return Promise.resolve(
              resolve({
                data: [
                  {
                    id: 'cycle-1',
                    label: 'Demo Cycle',
                    start_date: '2026-03-08',
                    end_date: '2026-04-18',
                  },
                ],
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
    expect(html).toContain('Barbara C. wants to fill this open Day Staff slot.')
    expect(html).toContain('Affected shift')
    expect(html).toContain('Sun, Mar 22')
    expect(html).toContain('Day shift')
    expect(html).toContain('Current: Open')
    expect(html).toContain('Coverage impact')
    expect(html).toContain('2 / 5 staffed')
    expect(html).toContain('After approval')
    expect(html).toContain('3 / 5 staffed')
    expect(html).toContain('Schedule preview')
    expect(html).toContain('Request would fill')
    expect(html).toContain('Approve assigns Barbara C. to this preliminary slot.')
    expect(html).toContain('Approve')
    expect(html).toContain('I can fill this shift.')
  })

  it('shows approval impact when a change request would reopen a filled slot', async () => {
    createClientMock.mockResolvedValue(
      createSupabaseMock({
        userId: 'manager-1',
        role: 'manager',
        affectedShiftUserId: 'therapist-1',
        affectedShiftProfileName: 'Barbara C.',
        pendingRequests: [
          {
            id: 'request-1',
            snapshot_id: 'snapshot-1',
            shift_id: 'shift-1',
            requester_id: 'therapist-1',
            type: 'request_change',
            status: 'pending',
            note: 'Need this day back.',
            decision_note: null,
            approved_by: null,
            approved_at: null,
            created_at: '2026-03-19T10:00:00.000Z',
          },
        ],
        impactShifts: [
          {
            id: 'shift-1',
            cycle_id: 'cycle-1',
            user_id: 'therapist-1',
            date: '2026-03-22',
            shift_type: 'day',
            status: 'scheduled',
            role: 'staff',
          },
          {
            id: 'shift-2',
            cycle_id: 'cycle-1',
            user_id: 'staff-2',
            date: '2026-03-22',
            shift_type: 'day',
            status: 'scheduled',
            role: 'staff',
          },
        ],
      })
    )

    const html = renderToStaticMarkup(await ApprovalsPage({ searchParams: Promise.resolve({}) }))

    expect(html).toContain('Schedule change request')
    expect(html).toContain('2 / 5 staffed')
    expect(html).toContain('1 / 5 staffed')
    expect(html).toContain('Approval would open')
    expect(html).toContain('Approve applies the requested preliminary schedule change.')
  })

  it('labels opposite-shift preliminary interest explicitly in the queue', async () => {
    createClientMock.mockResolvedValue(
      createSupabaseMock({
        userId: 'manager-1',
        role: 'manager',
        pendingRequests: [
          {
            id: 'request-1',
            snapshot_id: 'snapshot-1',
            shift_id: 'shift-1',
            requester_id: 'therapist-1',
            type: 'claim_open_shift',
            status: 'pending',
            note: 'Can cover if needed.',
            decision_note: null,
            approved_by: null,
            approved_at: null,
            created_at: '2026-03-19T10:00:00.000Z',
          },
        ],
        requesterShiftType: 'night',
      })
    )

    const html = renderToStaticMarkup(await ApprovalsPage({ searchParams: Promise.resolve({}) }))

    expect(html).toContain('Open-slot claim outside usual shift')
    expect(html).toContain('Usual shift: Night')
    expect(html).toContain('Approve only if that exception is intentional for this date.')
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

  it('renders a compact empty state with a schedule CTA when the queue is clear', async () => {
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
    expect(html).toContain('Send a preliminary schedule from Schedule to open this queue.')
    expect(html).toContain('Open Schedule')
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
