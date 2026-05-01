import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) =>
    createElement('a', { href, ...props }, children),
}))

import { TherapistAvailabilityWorkspace } from '@/components/availability/TherapistAvailabilityWorkspace'

describe('TherapistAvailabilityWorkspace', () => {
  it('renders therapist-only controls with compact quick-edit and consistent state language', () => {
    const html = renderToStaticMarkup(
      createElement(TherapistAvailabilityWorkspace, {
        cycles: [
          {
            id: 'cycle-1',
            label: 'Apr 2026',
            start_date: '2026-03-22',
            end_date: '2026-05-02',
            published: false,
          },
        ],
        availabilityRows: [
          {
            id: 'entry-1',
            therapistId: 'therapist-1',
            cycleId: 'cycle-1',
            date: '2026-03-24',
            reason: 'Vacation',
            createdAt: '2026-03-02T08:00:00.000Z',
            updatedAt: '2026-03-02T08:00:00.000Z',
            requestedBy: 'Barbara C.',
            cycleLabel: 'Apr 2026 (2026-03-22 to 2026-05-02)',
            entryType: 'force_off',
            shiftType: 'both',
            canDelete: true,
          },
        ],
        conflicts: [],
        initialCycleId: 'cycle-1',
        hasSavedRecurringPattern: true,
        recurringPatternSummary:
          'Works Mon, Tue, Thu, Fri. Every other weekend starting May 2, 2026.',
        generatedBaselineByCycleId: {
          'cycle-1': {
            '2026-03-22': {
              baselineStatus: 'off',
              baselineSource: 'recurring_pattern',
              reason: 'blocked_outside_works_dow_hard',
            },
            '2026-03-23': {
              baselineStatus: 'available',
              baselineSource: 'recurring_pattern',
              reason: 'allowed',
            },
            '2026-03-24': {
              baselineStatus: 'available',
              baselineSource: 'recurring_pattern',
              reason: 'allowed',
            },
          },
        },
        submissionsByCycleId: {},
        submitTherapistAvailabilityGridAction: async () => {},
      })
    )

    expect(html).toContain('Future Availability')
    expect(html).toContain('Starting point for this cycle')
    expect(html).toContain('We used your normal schedule to fill this cycle.')
    expect(html).toContain('Changes here stay in this cycle only.')
    expect(html).toContain('Works Mon, Tue, Thu, Fri. Every other weekend starting May 2, 2026.')
    expect(html).toContain('Submit availability')
    expect(html).toContain('id="therapist-availability-workspace"')
    expect(html).toContain('Not submitted')
    expect(html).toContain('Cycle:')
    expect(html).toContain('Quick edit')
    expect(html).toContain('Select one day or several days, then choose a state.')
    expect(html).toContain('Select a day to make a change.')
    expect(html).toContain('Summary')
    expect(html).toContain('Legend')
    expect(html).toContain('Selected day')
    expect(html).toContain('Starting point')
    expect(html).toContain('This cycle changes')
    expect(html).toContain('Can work')
    expect(html).toContain('Can&#x27;t work')
    expect(html).toContain('Clear')
    expect(html).toContain('Unmarked')
    expect(html).not.toContain('Normal work')
    expect(html).not.toContain('Normal off')
    expect(html).not.toContain('This cycle: can&#x27;t work')
    expect(html).not.toContain('This cycle: can work')
    expect(html).not.toContain('Use normal schedule')
    expect(html).toContain('Click a day to review it and make a change.')
    expect(html).toContain('Mar')
    expect(html).toContain('Apr')
    expect(html).not.toContain('Request to Work')
    expect(html).not.toContain('Need Off')
    expect(html).toContain('Clear cycle changes')
    expect(html).toContain('Edit several days')
    expect(html).toContain('Week 1')
    expect(html).not.toContain('Must work')
    expect(html).not.toContain('Unavailable')
  })

  it('renders the scheduled conflict warning banner when conflicts are present', () => {
    const html = renderToStaticMarkup(
      createElement(TherapistAvailabilityWorkspace, {
        cycles: [
          {
            id: 'cycle-1',
            label: 'Apr 2026',
            start_date: '2026-04-19',
            end_date: '2026-04-25',
            published: false,
          },
        ],
        availabilityRows: [],
        conflicts: [{ date: '2026-04-20', shiftType: 'day' }],
        initialCycleId: 'cycle-1',
        hasSavedRecurringPattern: false,
        recurringPatternSummary: 'No normal schedule saved yet.',
        generatedBaselineByCycleId: { 'cycle-1': {} },
        submissionsByCycleId: {},
        submitTherapistAvailabilityGridAction: async () => {},
      })
    )

    expect(html).toContain('You marked Need Off on dates that already have a scheduled shift.')
    expect(html).toContain('Mon Apr 20')
    expect(html).toContain('Review in Coverage')
  })

  it('uses neutral manual-state language when no normal schedule exists', () => {
    const html = renderToStaticMarkup(
      createElement(TherapistAvailabilityWorkspace, {
        cycles: [
          {
            id: 'cycle-1',
            label: 'Apr 2026',
            start_date: '2026-04-24',
            end_date: '2026-05-07',
            published: true,
          },
        ],
        availabilityRows: [],
        conflicts: [],
        initialCycleId: 'cycle-1',
        hasSavedRecurringPattern: false,
        recurringPatternSummary: 'No normal schedule saved yet.',
        generatedBaselineByCycleId: { 'cycle-1': {} },
        submissionsByCycleId: {},
        submitTherapistAvailabilityGridAction: async () => {},
      })
    )

    expect(html).toContain('This cycle starts blank.')
    expect(html).toContain('Add the days you can or can&#x27;t work.')
    expect(html).toContain('Unmarked')
    expect(html).not.toContain('Not set')
    expect(html).not.toContain('Normal off day')
    expect(html).not.toContain('Request to Work')
  })

  it('keeps blank-start copy when onboarding only saved never-work blocks', () => {
    const html = renderToStaticMarkup(
      createElement(TherapistAvailabilityWorkspace, {
        cycles: [
          {
            id: 'cycle-1',
            label: 'May 2026',
            start_date: '2026-05-03',
            end_date: '2026-05-09',
            published: false,
          },
        ],
        availabilityRows: [],
        conflicts: [],
        initialCycleId: 'cycle-1',
        hasSavedRecurringPattern: false,
        recurringPatternSummary: 'No normal schedule saved yet.',
        generatedBaselineByCycleId: {
          'cycle-1': {
            '2026-05-04': {
              baselineStatus: 'off',
              baselineSource: 'recurring_pattern',
              reason: 'blocked_offs_dow',
            },
          },
        },
        submissionsByCycleId: {},
        submitTherapistAvailabilityGridAction: async () => {},
      })
    )

    expect(html).toContain('No normal schedule saved yet.')
    expect(html).toContain('This cycle starts blank.')
    expect(html).toContain('Add the days you can or can&#x27;t work.')
    expect(html).toContain('Set recurring pattern')
    expect(html).not.toContain('Edit recurring pattern')
    expect(html).not.toContain('We used your normal schedule to fill this cycle.')
  })

  it('keeps neutral grid cells unlabeled and documents note persistence (source)', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/components/availability/TherapistAvailabilityWorkspace.tsx'),
      'utf8'
    )
    expect(src).not.toContain('Not set')
    expect(src).not.toContain('Normal work')
    expect(src).not.toContain('Normal off')
    expect(src).not.toContain('Use normal schedule')
    expect(src).not.toContain('This cycle:')
    expect(src).toContain("displayState === 'can_work' || displayState === 'cannot_work'")
    expect(src).toContain('{showStatusLabel ? (')
    expect(src).toContain('Notes are only saved for days you change for this cycle.')
    expect(src).toContain('Edit several days')
    expect(src).toContain('rounded-[0.95rem] border border-border/60 bg-background px-3.5 py-2.5')
    expect(src).toContain('xl:border-l xl:border-t-0')
    expect(src).toContain('xl:grid-cols-[minmax(0,1fr)_19rem]')
    expect(src).toContain('ring-primary/35')
  })
})
