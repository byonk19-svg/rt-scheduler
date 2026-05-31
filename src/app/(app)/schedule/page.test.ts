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

vi.mock('@/app/(app)/schedule/actions/preliminary-actions', () => ({
  sendPreliminaryScheduleAction: vi.fn(),
}))

vi.mock('@/app/(app)/schedule/actions/publish-actions', () => ({
  toggleCyclePublishedAction: vi.fn(),
}))

vi.mock('@/components/schedule-grid/ScheduleGrid', () => ({
  ScheduleGrid: ({
    initialDataset,
    initialShiftTab,
    preliminaryAction,
  }: {
    initialDataset: { cycleDateRangeLabel: string }
    initialShiftTab: 'Day' | 'Night'
    preliminaryAction?: unknown
  }) =>
    createElement(
      'section',
      null,
      createElement('h2', null, 'Mock Schedule Grid'),
      createElement('p', null, initialDataset.cycleDateRangeLabel),
      createElement('p', null, initialShiftTab),
      preliminaryAction ? createElement('p', null, 'Preliminary action wired') : null
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
    interactionMode: {
      kind: 'manager_edit' as const,
      canUseManagerToolbar: true,
      canAssignShifts: true,
      canUnassignShifts: true,
      canDesignateLead: true,
      canUpdateAssignmentStatus: true,
    },
    availableCycles: [{ id: 'cycle-2', label: 'May 3 - Jun 13, 2026' }],
    cycleDates: ['2026-05-03', '2026-05-04'],
    cycleDateRangeLabel: 'May 3 - Jun 13, 2026',
    isPublished: false,
    cycleStatus: 'draft' as const,
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
    expect(html).toContain('Preliminary action wired')
  })

  it('renders publish validation failures as visible manager feedback', async () => {
    loadScheduleGridDataMock.mockResolvedValue({
      status: 'ok',
      dataset: okDataset(),
      initialShiftTab: 'Day',
      preFlightSummary: null,
    })

    const html = renderToStaticMarkup(
      await SchedulePage({
        searchParams: Promise.resolve({
          error: 'publish_weekly_rule_violation',
          violations: '1243',
          under: '1243',
          over: '0',
        }),
      })
    )

    expect(html).toContain('Publish blocked: 1243 weekly staffing rule violations need review')
    expect(html).toContain('1243 under, 0 over')
  })

  it('renders missing availability publish warnings with the continuation action label', async () => {
    loadScheduleGridDataMock.mockResolvedValue({
      status: 'ok',
      dataset: okDataset(),
      initialShiftTab: 'Day',
      preFlightSummary: null,
    })

    const html = renderToStaticMarkup(
      await SchedulePage({
        searchParams: Promise.resolve({
          error: 'publish_missing_availability_warning',
          missing_availability: '32',
        }),
      })
    )

    expect(html).toContain('Publish paused: 32 staff members are missing availability.')
    expect(html).toContain('Publish with missing availability')
  })

  it('renders readiness blockers for preliminary and final publish actions', async () => {
    loadScheduleGridDataMock.mockResolvedValue({
      status: 'ok',
      dataset: okDataset(),
      initialShiftTab: 'Day',
      preFlightSummary: null,
    })

    const publishHtml = renderToStaticMarkup(
      await SchedulePage({
        searchParams: Promise.resolve({
          error: 'publish_readiness_blocked',
          readiness_issues: '2',
        }),
      })
    )
    expect(publishHtml).toContain(
      'Publish blocked: resolve 2 blocking readiness issues in pre-flight before final publish.'
    )

    const preliminaryHtml = renderToStaticMarkup(
      await SchedulePage({
        searchParams: Promise.resolve({
          error: 'preliminary_readiness_blocked',
          readiness_issues: '1',
        }),
      })
    )
    expect(preliminaryHtml).toContain(
      'Preliminary send blocked: resolve 1 blocking readiness issue in pre-flight before staff review.'
    )
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

  it('redirects inactive or archived users to the inactive-account login state', async () => {
    loadScheduleGridDataMock.mockResolvedValue({ status: 'inactive' })

    await expect(SchedulePage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'REDIRECT:/login?error=account_inactive'
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

  it('renders a load error state without treating failed reads as an empty schedule', async () => {
    loadScheduleGridDataMock.mockResolvedValue({ status: 'load_error' })

    const html = renderToStaticMarkup(await SchedulePage({ searchParams: Promise.resolve({}) }))

    expect(html).toContain('Could not load Team Schedule.')
    expect(html).toContain('Refresh this page. If this keeps happening, contact an administrator.')
    expect(html).not.toContain('No active Schedule Block is available yet.')
    expect(html).not.toContain('Mock Schedule Grid')
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
