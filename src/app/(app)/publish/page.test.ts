import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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
  takeScheduleBlockOfflineAction: vi.fn(),
  deletePublishEventAction: vi.fn(),
  archiveCycleAction: vi.fn(),
}))

vi.mock('@/app/schedule/actions', () => ({
  deleteCycleAction: vi.fn(),
  toggleCyclePublishedAction: vi.fn(),
}))

vi.mock('@/lib/coverage/fetch-schedule-cycles', () => ({
  fetchScheduleCyclesForCoverage: vi.fn(async () => ({
    data: [],
    error: null,
  })),
}))

import PublishHistoryPage from '@/app/(app)/publish/page'

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
          if (
            table === 'profiles' &&
            selected.includes('role') &&
            filters.get('id') === context.userId
          ) {
            return { data: { role: context.role, is_active: true, archived_at: null }, error: null }
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
              schedule_cycles: {
                label: string
                published: boolean
                status: 'final' | 'offline'
              }
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
                    schedule_cycles: { label: 'Live cycle', published: true, status: 'final' },
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
                    schedule_cycles: { label: 'Old cycle', published: false, status: 'offline' },
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

  it('shows take-offline and offline lifecycle actions without start-over for live blocks', async () => {
    createClientMock.mockResolvedValue(
      createSupabaseMock({
        userId: 'manager-1',
        role: 'manager',
      })
    )

    const html = renderToStaticMarkup(await PublishHistoryPage({}))

    expect(html).toContain('Schedule Blocks')
    expect(html).toContain('Publish checklist')
    expect(html).toContain('Use this page after a schedule has been sent.')
    expect(html).toContain('Send from Schedule')
    expect(html).toContain('Check delivery')
    expect(html).toContain('Manage lifecycle')
    expect(html).toContain('Publish email log')
    expect(html).toContain('Take offline')
    expect(html).not.toContain('Clear &amp; restart')
    expect(html).toContain('Archive Schedule Block')
    expect(html).toContain('Delete history')
    expect(html).toContain('Open Schedule Block')
    expect(html).toContain('No longer live')
    expect(html).toContain('Live cycle')
    expect(html).toContain('Old cycle')
  })

  it('shows a success banner after taking a cycle offline', async () => {
    createClientMock.mockResolvedValue(
      createSupabaseMock({
        userId: 'manager-1',
        role: 'manager',
      })
    )

    const html = renderToStaticMarkup(
      await PublishHistoryPage({
        searchParams: Promise.resolve({ success: 'cycle_taken_offline' }),
      })
    )

    expect(html).toContain('Schedule Block taken offline')
    expect(html).toContain('Assignments were preserved')
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

    expect(html).toContain('Schedule Block archived')
    expect(html).toContain('will no longer appear in Schedule')
  })

  it('does not duplicate the canonical dashboard Lottery entry point from publish history', async () => {
    createClientMock.mockResolvedValue(
      createSupabaseMock({
        userId: 'manager-1',
        role: 'manager',
      })
    )

    const html = renderToStaticMarkup(await PublishHistoryPage({}))

    expect(html).not.toContain('Open Lottery')
    expect(html).not.toContain('href="/lottery"')
  })

  it('keeps publish event time formatting out of table row render work', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/(app)/publish/page.tsx'), 'utf8')

    expect(source).toContain('const publishEventDateFormatter = new Intl.DateTimeFormat')
    expect(source).toContain('function formatPublishEventTime(value: string): string')
    expect(source).toContain('{formatPublishEventTime(event.published_at)}')
    expect(source).not.toContain('new Date(event.published_at).toLocaleString')
  })
})
