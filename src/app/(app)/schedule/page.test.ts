import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { redirectMock, loadScheduleGridDataMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
  loadScheduleGridDataMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}))

vi.mock('@/app/(app)/schedule/schedule-grid-data', () => ({
  loadScheduleGridData: loadScheduleGridDataMock,
}))

vi.mock('@/app/(app)/schedule/actions/draft-actions', () => ({
  generateDraftScheduleAction: vi.fn(),
}))

vi.mock('@/app/(app)/schedule/actions/publish-actions', () => ({
  toggleCyclePublishedAction: vi.fn(),
}))

vi.mock('@/components/schedule-grid/ScheduleGrid', () => ({
  ScheduleGrid: ({
    initialDataset,
    initialShiftTab,
  }: {
    initialDataset: { cycleDateRangeLabel: string }
    initialShiftTab: 'Day' | 'Night'
  }) =>
    createElement(
      'section',
      null,
      createElement('h2', null, 'Mock Schedule Grid'),
      createElement('p', null, initialDataset.cycleDateRangeLabel),
      createElement('p', null, initialShiftTab)
    ),
}))

import SchedulePage from '@/app/(app)/schedule/page'

const setupCompleteBannerSource = readFileSync(
  resolve(process.cwd(), 'src/app/(app)/schedule/SetupCompleteBanner.tsx'),
  'utf8'
)

function okDataset() {
  return {
    cycleId: 'cycle-2',
    shiftType: 'day' as const,
    availableCycles: [{ id: 'cycle-2', label: 'May 3 - Jun 13, 2026' }],
    cycleDates: ['2026-05-03', '2026-05-04'],
    cycleDateRangeLabel: 'May 3 - Jun 13, 2026',
    isPublished: false,
    therapistRows: [],
    dailyTotals: {},
    viewerUserId: 'manager-1',
    viewerRole: 'manager' as const,
    canManageCoverage: true,
    canUpdateAssignmentStatus: true,
  }
}

describe('schedule route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads the unified schedule grid data and renders ScheduleGrid', async () => {
    loadScheduleGridDataMock.mockResolvedValue({
      status: 'ok',
      dataset: okDataset(),
      initialShiftTab: 'Day',
      preFlightSummary: null,
    })

    const html = renderToStaticMarkup(
      await SchedulePage({ searchParams: Promise.resolve({ cycle: 'cycle-2' }) })
    )

    expect(loadScheduleGridDataMock).toHaveBeenCalledWith({ cycle: 'cycle-2' })
    expect(html).toContain('Team Schedule')
    expect(html).toContain('Draft staffing, coverage review, and live schedule visibility.')
    expect(html).toContain('Mock Schedule Grid')
    expect(html).toContain('May 3 - Jun 13, 2026')
  })

  it('shows setup completion feedback on the schedule page', async () => {
    loadScheduleGridDataMock.mockResolvedValue({
      status: 'ok',
      dataset: okDataset(),
      initialShiftTab: 'Day',
      preFlightSummary: null,
    })

    const html = renderToStaticMarkup(
      await SchedulePage({ searchParams: Promise.resolve({ setup: 'complete' }) })
    )

    expect(loadScheduleGridDataMock).toHaveBeenCalledWith({ setup: 'complete' })
    expect(html).toContain('You&#x27;re all set')
    expect(html).toContain('Your work pattern and preferences have been saved.')
    expect(html).toContain('Edit preferences')
    expect(html).not.toContain('Your schedule is ready')
  })

  it('redirects unauthenticated users to login', async () => {
    loadScheduleGridDataMock.mockResolvedValue({ status: 'unauthenticated' })

    await expect(SchedulePage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'REDIRECT:/login'
    )
  })

  it('redirects forbidden users to the staff dashboard', async () => {
    loadScheduleGridDataMock.mockResolvedValue({ status: 'forbidden' })

    await expect(SchedulePage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'REDIRECT:/dashboard/staff'
    )
  })

  it('renders an empty state when there is no cycle visible to the user', async () => {
    loadScheduleGridDataMock.mockResolvedValue({ status: 'no_cycle' })

    const html = renderToStaticMarkup(await SchedulePage({ searchParams: Promise.resolve({}) }))

    expect(html).toContain('No active Schedule Block is available yet.')
    expect(html).toContain('Managers can create or publish a Schedule Block')
    expect(html).toContain('Staff will see their Team Schedule here after a block is available.')
  })

  it('keeps setup completion feedback visible when no Schedule Block is available', async () => {
    loadScheduleGridDataMock.mockResolvedValue({ status: 'no_cycle' })

    const html = renderToStaticMarkup(
      await SchedulePage({ searchParams: Promise.resolve({ setup: 'complete' }) })
    )

    expect(html).toContain('You&#x27;re all set')
    expect(html).toContain('Your work pattern and preferences have been saved.')
    expect(html).toContain('No active Schedule Block is available yet.')
    expect(html).not.toContain('Your schedule is ready')
  })

  it('sets unified schedule metadata', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/(app)/schedule/page.tsx'), 'utf8')

    expect(source).toContain("title: 'Team Schedule'")
    expect(source).toContain('unified schedule grid')
  })

  it('remounts the grid when the loaded cycle or shift changes', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/(app)/schedule/page.tsx'), 'utf8')

    expect(source).toContain('key={`${result.dataset.cycleId}:${result.dataset.shiftType}`}')
  })

  it('removes the setup completion URL state when the banner is dismissed', () => {
    expect(setupCompleteBannerSource).toContain("url.searchParams.delete('setup')")
    expect(setupCompleteBannerSource).toContain('window.history.replaceState')
    expect(setupCompleteBannerSource).toContain('Dismiss setup complete message')
  })
})
