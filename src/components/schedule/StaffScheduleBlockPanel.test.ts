import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) =>
    createElement('a', { href, ...props }, children),
}))

import { StaffScheduleBlockPanel } from '@/components/schedule/StaffScheduleBlockPanel'
import type { StaffScheduleBlockView } from '@/lib/staff-my-schedule'

const sampleSchedule: StaffScheduleBlockView = {
  cycleId: 'cycle-1',
  title: 'July Block',
  dateRangeLabel: 'Jul 19 - Aug 29, 2026',
  lifecycleLabel: 'Final schedule published',
  assignedCount: 2,
  nextAssignmentDate: '2026-07-20',
  days: [
    {
      date: '2026-07-19',
      isToday: false,
      isWeekend: true,
      assignment: null,
    },
    {
      date: '2026-07-20',
      isToday: true,
      isWeekend: false,
      assignment: {
        id: 'shift-1',
        shiftType: 'day',
        role: 'staff',
        status: 'scheduled',
        assignmentStatus: null,
        canRequestChange: true,
        isLead: false,
        leadName: 'Lead Avery',
        coworkerNames: ['Jordan Lee', 'Sam Patel'],
        coworkerCount: 3,
      },
    },
    {
      date: '2026-07-21',
      isToday: false,
      isWeekend: false,
      assignment: {
        id: 'shift-2',
        shiftType: 'night',
        role: 'lead',
        status: 'scheduled',
        assignmentStatus: 'on_call',
        canRequestChange: false,
        isLead: true,
        leadName: null,
        coworkerNames: [],
        coworkerCount: 0,
      },
    },
  ],
}

describe('StaffScheduleBlockPanel', () => {
  it('renders the six-week staff schedule context with coworkers, lead, and team schedule links', () => {
    const html = renderToStaticMarkup(
      createElement(StaffScheduleBlockPanel, { schedule: sampleSchedule })
    )

    expect(html).toContain('My Shifts')
    expect(html).toContain('Your six-week schedule')
    expect(html).toContain('Final schedule published')
    expect(html).toContain('2 assigned days')
    expect(html).toContain('Lead: Lead Avery')
    expect(html).toContain('With Jordan Lee, Sam Patel +1')
    expect(html).toContain('On Call')
    expect(html).toContain('Need coverage')
    expect(html).toContain('href="/therapist/swaps?new=1&amp;shiftId=shift-1&amp;type=pickup"')
    expect(html).toContain('Trade shift')
    expect(html).toContain('href="/therapist/swaps?new=1&amp;shiftId=shift-1&amp;type=swap"')
    expect(html).not.toContain('shiftId=shift-2&amp;type=pickup')
    expect(html).not.toContain('shiftId=shift-2&amp;type=swap')
    expect(html).toContain('View Team Schedule')
    expect(html).toContain('href="/schedule?cycle=cycle-1"')
    expect(html).toContain('Print from Team Schedule')
    expect(html).toContain('role="table"')
  })

  it('explains when no preliminary or final schedule block is visible yet', () => {
    const html = renderToStaticMarkup(createElement(StaffScheduleBlockPanel, { schedule: null }))

    expect(html).toContain('No schedule block is visible yet')
    expect(html).toContain('six-week view will appear here')
    expect(html).toContain('Open Team Schedule')
    expect(html).toContain('Check Availability')
  })
})
