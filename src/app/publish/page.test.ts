import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { redirectMock, createClientMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
  createClientMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

vi.mock('@/app/publish/actions', () => ({
  restartPublishedCycleAction: vi.fn(),
  deletePublishEventAction: vi.fn(),
  archiveCycleAction: vi.fn(),
}))

vi.mock('@/app/schedule/actions', () => ({
  deleteCycleAction: vi.fn(),
}))

vi.mock('@/lib/coverage/fetch-schedule-cycles', () => ({
  fetchScheduleCyclesForCoverage: vi.fn(async () => ({
    data: [],
    error: null,
  })),
}))

import PublishHistoryPage from '@/app/publish/page'

type TestContext = {
  userId?: string | null
  role?: string | null
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
        then(
          resolve: (value: {
            data: Array<{
              id: string
              cycle_id: string
              published_at: string
              status: 'success' | 'failed'
              recipient_count: number
              channel: string
              queued_count: number
              sent_count: number
              failed_count: number
              error_message: string | null
              schedule_cycles: { label: string; published: boolean }
              profiles: { full_name: string | null }
            }>
            error: null
          }) => unknown
        ) {
          if (table === 'publish_events') {
            return Promise.resolve(
              resolve({
                data: [
                  {
                    id: 'event-live',
                    cycle_id: 'cycle-live',
                    published_at: '2026-03-19T08:00:00.000Z',
                    status: 'success',
                    recipient_count: 12,
                    channel: 'email',
                    queued_count: 0,
                    sent_count: 12,
                    failed_count: 0,
                    error_message: null,
                    schedule_cycles: { label: 'Live cycle', published: true },
                    profiles: { full_name: 'Manager A.' },
                  },
                  {
                    id: 'event-old',
                    cycle_id: 'cycle-old',
                    published_at: '2026-03-12T08:00:00.000Z',
                    status: 'success',
                    recipient_count: 10,
                    channel: 'email',
                    queued_count: 0,
                    sent_count: 10,
                    failed_count: 0,
                    error_message: null,
                    schedule_cycles: { label: 'Old cycle', published: false },
                    profiles: { full_name: 'Manager B.' },
                  },
                ],
                error: null,
              })
            )
          }

          return Promise.resolve(resolve({ data: [], error: null }))
        },
      }

      return builder
    },
  }
}

describe('PublishHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows start over for currently published cycles and marks reopened cycles as no longer live', async () => {
    createClientMock.mockResolvedValue(
      createSupabaseMock({
        userId: 'manager-1',
        role: 'manager',
      })
    )

    const html = renderToStaticMarkup(await PublishHistoryPage({}))

    expect(html).toContain('Schedule blocks')
    expect(html).toContain('Publish email log')
    expect(html).toContain('Start over')
    expect(html).toContain('Archive cycle')
    expect(html).toContain('Delete history')
    expect(html).toContain('Open cycle')
    expect(html).toContain('No longer live')
    expect(html).toContain('Live cycle')
    expect(html).toContain('Old cycle')
  })

  it('shows a success banner after restarting a cycle', async () => {
    createClientMock.mockResolvedValue(
      createSupabaseMock({
        userId: 'manager-1',
        role: 'manager',
      })
    )

    const html = renderToStaticMarkup(
      await PublishHistoryPage({
        searchParams: Promise.resolve({ success: 'cycle_restarted' }),
      })
    )

    expect(html).toContain('Cycle restarted')
    expect(html).toContain('draft schedule')
  })

  it('shows a success banner after deleting publish history', async () => {
    createClientMock.mockResolvedValue(
      createSupabaseMock({
        userId: 'manager-1',
        role: 'manager',
      })
    )

    const html = renderToStaticMarkup(
      await PublishHistoryPage({
        searchParams: Promise.resolve({ success: 'publish_event_deleted' }),
      })
    )

    expect(html).toContain('Publish history entry deleted')
  })

  it('shows a success banner after archiving a cycle', async () => {
    createClientMock.mockResolvedValue(
      createSupabaseMock({
        userId: 'manager-1',
        role: 'manager',
      })
    )

    const html = renderToStaticMarkup(
      await PublishHistoryPage({
        searchParams: Promise.resolve({ success: 'cycle_archived' }),
      })
    )

    expect(html).toContain('Cycle archived')
    expect(html).toContain('will no longer appear in Coverage')
  })
})
