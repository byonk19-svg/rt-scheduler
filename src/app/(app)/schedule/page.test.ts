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
    expect(html).toContain('Schedule')
    expect(html).toContain('State')
    expect(html).toContain('Access')
    expect(html).toContain('Manager edit')
    expect(html).toContain('Mock Schedule Grid')
    expect(html).toContain('May 3 - Jun 13, 2026')
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
    expect(html).toContain('Managers can open Coverage to start the next Schedule Block')
    expect(html).toContain(
      'Staff will see this page once a manager makes the Schedule Block available'
    )
  })

  it('sets unified schedule metadata', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/(app)/schedule/page.tsx'), 'utf8')

    expect(source).toContain("title: 'Schedule'")
    expect(source).toContain('unified respiratory therapy schedule grid')
    expect(source).toContain('Review your row and the live team schedule')
    expect(source).toContain('Review the team schedule and update published shift status')
  })

  it('remounts the grid when the loaded cycle or shift changes', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/(app)/schedule/page.tsx'), 'utf8')

    expect(source).toContain('key={`${result.dataset.cycleId}:${result.dataset.shiftType}`}')
  })
})
