import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  TherapistShiftCalendar,
  type TherapistShiftDay,
  type TherapistShiftMember,
  type TherapistShiftWeek,
} from '@/components/schedule/TherapistShiftCalendar'
import { addDays, formatShortDate } from '@/lib/my-shifts-schedule-block'

const you: TherapistShiftMember = {
  id: 'you',
  name: 'Alex Therapist',
  shortName: 'Alex T.',
  initials: 'AT',
  colorClass: 'bg-primary',
  isLead: false,
  isYou: true,
}

const lead: TherapistShiftMember = {
  id: 'lead',
  name: 'Morgan Lead',
  shortName: 'Morgan L.',
  initials: 'ML',
  colorClass: 'bg-[color:var(--attention)]',
  isLead: true,
  isYou: false,
}

function buildWeeks(startIso: string): TherapistShiftWeek[] {
  return Array.from({ length: 6 }, (_, weekIndex) => {
    const weekStart = addDays(startIso, weekIndex * 7)
    const days: TherapistShiftDay[] = Array.from({ length: 7 }, (_, dayIndex) => {
      const isoDate = addDays(weekStart, dayIndex)
      const date = new Date(`${isoDate}T12:00:00`)
      const isSelectedShift = isoDate === startIso

      return {
        isoDate,
        weekdayLabel: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayLabel: `${date.getMonth() + 1}/${date.getDate()}`,
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        userShift: isSelectedShift
          ? {
              shiftType: 'day',
              role: 'staff',
              assignmentStatus: 'scheduled',
              status: 'scheduled',
            }
          : null,
        team: isSelectedShift ? [you, lead] : [],
      }
    })

    return {
      id: `week-${weekIndex + 1}`,
      label: `Week ${weekIndex + 1}`,
      rangeLabel: `${formatShortDate(days[0].isoDate)} - ${formatShortDate(
        days[days.length - 1].isoDate
      )}`,
      days,
    }
  })
}

function renderCalendar() {
  const weeks = buildWeeks('2026-03-22')

  return renderToStaticMarkup(
    createElement(TherapistShiftCalendar, {
      title: 'My Shifts',
      subtitle: 'Your personal view of the published Schedule Block.',
      periodLabel: 'Mar 22 - May 2, 2026',
      previousHref: '/therapist/schedule?start=2026-02-08',
      nextHref: '/therapist/schedule?start=2026-05-03',
      weeks,
      teammates: [you, lead],
      defaultShiftLabel: 'Day shift',
      scheduleContext: {
        rangeLabel: 'Mar 22 - May 2, 2026',
        cadenceLabel: 'Sunday-start, 6 weeks',
        shiftLabel: 'Day shift',
        stateLabel: 'Published schedule',
        permissionLabel: 'Read-only personal schedule',
      },
      summary: {
        shiftCount: 1,
        leadCount: 0,
        dayShiftCount: 1,
        nightShiftCount: 0,
        dayOffCount: 41,
        totalHours: 12,
      },
      backHref: '/dashboard/staff',
    })
  )
}

describe('TherapistShiftCalendar', () => {
  it('shows shared Schedule Block context and the therapist default shift', () => {
    const html = renderCalendar()

    expect(html).toContain('My Shifts')
    expect(html).toContain('Schedule Block')
    expect(html).toContain('Mar 22 - May 2, 2026')
    expect(html).toContain('Sunday-start, 6 weeks')
    expect(html).toContain('Default shift')
    expect(html).toContain('Day shift')
    expect(html).toContain('Published schedule')
    expect(html).toContain('Read-only personal schedule')
  })

  it('keeps the full six-week block visible, including non-working days', () => {
    const html = renderCalendar()

    expect(html).toContain('Week 6')
    expect(html).toContain('Sat 5/2')
    expect(html).toContain('Mon 3/23')
    expect(html).toContain('Day off')
    expect(html).toContain('41')
  })

  it('shows selected-day details with status, lead, and coworkers on the same shift', () => {
    const html = renderCalendar()

    expect(html).toContain('Selected day')
    expect(html).toContain('Sunday, March 22, 2026')
    expect(html).toContain('You work this day')
    expect(html).toContain('Scheduled')
    expect(html).toContain('Coworkers')
    expect(html).toContain('Morgan L.')
    expect(html).toContain('Lead')
  })
})
