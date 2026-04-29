import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createAssignmentKey } from '@/lib/mock-coverage-roster'

const { redirectMock, replaceMock, loadScheduleRosterPageDataMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
  replaceMock: vi.fn(),
  loadScheduleRosterPageDataMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
  useRouter: () => ({
    replace: replaceMock,
  }),
}))

vi.mock('@/app/(app)/schedule/schedule-roster-live-data', () => ({
  loadScheduleRosterPageData: loadScheduleRosterPageDataMock,
}))

import SchedulePage from '@/app/(app)/schedule/page'

describe('schedule route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads the selected cycle and renders the live roster screen for managers', async () => {
    loadScheduleRosterPageDataMock.mockResolvedValue({
      status: 'ok',
      data: {
        cycleId: 'cycle-2',
        label: 'Cycle Beta',
        startDate: '2026-05-03',
        endDate: '2026-05-09',
        shortLabel: 'May 3 - May 9, 2026',
        isPublished: false,
        availableCycles: [
          { id: 'cycle-1', label: 'Cycle Alpha' },
          { id: 'cycle-2', label: 'Cycle Beta' },
        ],
        staff: [
          {
            id: 'day-core',
            name: 'Day Core',
            roleLabel: 'Therapist',
            rosterKind: 'core',
            shiftType: 'day',
          },
          {
            id: 'day-prn',
            name: 'Day PRN',
            roleLabel: 'Therapist',
            rosterKind: 'prn',
            shiftType: 'day',
          },
          {
            id: 'night-core',
            name: 'Night Core',
            roleLabel: 'Therapist',
            rosterKind: 'core',
            shiftType: 'night',
          },
        ],
        assignments: {
          [createAssignmentKey('day-core', '2026-05-03', 'day')]: {
            id: 'shift-1',
            staffId: 'day-core',
            isoDate: '2026-05-03',
            shiftType: 'day',
            status: 'assigned',
            assignmentStatus: null,
          },
          [createAssignmentKey('day-prn', '2026-05-04', 'day')]: {
            id: 'shift-2',
            staffId: 'day-prn',
            isoDate: '2026-05-04',
            shiftType: 'day',
            status: 'assigned',
            assignmentStatus: 'on_call',
          },
        },
        availabilityApprovals: {
          [createAssignmentKey('day-core', '2026-05-04', 'day')]: 'approved_off',
          [createAssignmentKey('day-prn', '2026-05-03', 'day')]: 'approved_work',
        },
      },
    })

    const html = renderToStaticMarkup(
      await SchedulePage({ searchParams: Promise.resolve({ cycle: 'cycle-2' }) })
    )

    expect(loadScheduleRosterPageDataMock).toHaveBeenCalledWith({ cycle: 'cycle-2' })
    expect(html).toContain('Respiratory Therapy - Day Shift')
    expect(html).toContain('Cycle Beta')
    expect(html).toContain('May 3 - May 9, 2026')
    expect(html).toContain('Day Core')
    expect(html).toContain('Day PRN')
    expect(html).not.toContain('Night Core')
    expect(html).toContain('OFF')
    expect(html).toContain('OC')
    expect(html).toContain('Cycle Alpha')
  })

  it('redirects unauthenticated users to login', async () => {
    loadScheduleRosterPageDataMock.mockResolvedValue({ status: 'unauthenticated' })

    await expect(SchedulePage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'REDIRECT:/login'
    )
  })

  it('redirects non-manager users to the staff dashboard', async () => {
    loadScheduleRosterPageDataMock.mockResolvedValue({ status: 'forbidden' })

    await expect(SchedulePage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'REDIRECT:/dashboard/staff'
    )
  })

  it('renders a setup message when there is no active cycle yet', async () => {
    loadScheduleRosterPageDataMock.mockResolvedValue({ status: 'no_cycle' })

    const html = renderToStaticMarkup(await SchedulePage({ searchParams: Promise.resolve({}) }))

    expect(html).toContain('No active schedule block yet')
    expect(html).toContain('Create or reopen a cycle in Coverage')
  })
})
