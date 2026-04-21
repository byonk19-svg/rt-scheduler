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
  unpublishCycleKeepShiftsAction: vi.fn(),
  archiveCycleAction: vi.fn(),
}))

vi.mock('@/app/schedule/actions', () => ({
  deleteCycleAction: vi.fn(),
}))

vi.mock('@/lib/coverage/fetch-schedule-cycles', () => ({
  fetchScheduleCyclesForCoverage: vi.fn(async () => ({
    data: [
      {
        id: 'cycle-live',
        label: 'Live cycle',
        start_date: '2026-03-19',
        end_date: '2026-03-25',
        published: true,
      },
      {
        id: 'cycle-draft',
        label: 'Draft cycle',
        start_date: '2026-03-26',
        end_date: '2026-04-01',
        published: false,
      },
    ],
    error: null,
  })),
}))

import FinalizeSchedulePage from '@/app/(app)/publish/page'

function createSupabaseMock(role: string | null) {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: { id: 'manager-1' },
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
        async maybeSingle() {
          if (table === 'profiles' && selected === 'role' && filters.get('id') === 'manager-1') {
            return { data: { role }, error: null }
          }
          return { data: null, error: null }
        },
      }

      return builder
    },
  }
}

describe('FinalizeSchedulePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the finalization surface and links to delivery history', async () => {
    createClientMock.mockResolvedValue(createSupabaseMock('manager'))

    const html = renderToStaticMarkup(await FinalizeSchedulePage({}))

    expect(html).toContain('Finalize schedule')
    expect(html).toContain('Delivery history')
    expect(html).toContain('Schedule blocks to finalize')
    expect(html).toContain('Take offline')
    expect(html).toContain('Clear &amp; restart')
    expect(html).toContain('Archive')
    expect(html).toContain('Delete draft')
    expect(html).toContain('Live cycle')
    expect(html).toContain('Draft cycle')
  })

  it('shows cycle success banners on the finalization page', async () => {
    createClientMock.mockResolvedValue(createSupabaseMock('manager'))

    const html = renderToStaticMarkup(
      await FinalizeSchedulePage({
        searchParams: Promise.resolve({ success: 'cycle_restarted' }),
      })
    )

    expect(html).toContain('Cycle restarted')
    expect(html).toContain('published shifts were cleared')
  })

  it('redirects non-managers away from the finalization page', async () => {
    createClientMock.mockResolvedValue(createSupabaseMock('therapist'))

    await expect(FinalizeSchedulePage({})).rejects.toThrow('REDIRECT:/dashboard')
  })
})
