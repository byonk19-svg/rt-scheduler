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
        todayKey: '2026-03-22',
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
        regularShiftType: 'night',
        submitTherapistAvailabilityGridAction: async () => {},
      })
    )

    expect(html).toContain('Future Availability')
    expect(html).toContain('Starting point for this Schedule Block')
    expect(html).toContain('We used your normal schedule to fill this Schedule Block.')
    expect(html).toContain('Changes here stay in this Schedule Block only.')
    expect(html).toContain('Works Mon, Tue, Thu, Fri. Every other weekend starting May 2, 2026.')
    expect(html).toContain('Submit availability')
    expect(html).toContain('Save progress keeps this as a draft.')
    expect(html).toContain('Submit availability sends this Schedule Block to managers.')
    expect(html).toContain('id="therapist-availability-workspace"')
    expect(html).toContain('Not submitted')
    expect(html).toContain('Schedule Block:')
    expect(html).toContain('Quick edit')
    expect(html).toContain('Select one day or several days, then choose a state.')
    expect(html).toContain('Select a day to make a change.')
    expect(html).toContain('Current starting point')
    expect(html).toContain('Review before submitting')
    expect(html).toContain('Schedule Block')
    expect(html).toContain('Regular shift')
    expect(html).toContain('Night shift')
    expect(html).toContain('Need Off')
    expect(html).toContain('Mar 24 (Vacation)')
    expect(html).toContain('Need to Work')
    expect(html).toContain('Legend')
    expect(html).toContain('Selected day')
    expect(html).toContain('Starting point')
    expect(html).toContain('This Schedule Block changes')
    expect(html).toContain('Need to Work')
    expect(html).toContain('Need Off')
    expect(html).toContain('Normally working')
    expect(html).toContain('Normally off')
    expect(html).toContain('Clear')
    expect(html).toContain('Unmarked')
    expect(html).not.toContain('Normal work')
    expect(html).not.toContain('Normal off')
    expect(html).not.toContain('This Schedule Block: can&#x27;t work')
    expect(html).not.toContain('This Schedule Block: can work')
    expect(html).not.toContain('Use normal schedule')
    expect(html).toContain('Click a day to review it and make a change.')
    expect(html).toContain('Mar')
    expect(html).toContain('Apr')
    expect(html).not.toContain('Request to Work')
    expect(html).not.toContain('Can work')
    expect(html).not.toContain('Can&#x27;t work')
    expect(html).toContain('Clear block changes')
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
        todayKey: '2026-04-19',
        hasSavedRecurringPattern: false,
        recurringPatternSummary: 'No normal schedule saved yet.',
        generatedBaselineByCycleId: { 'cycle-1': {} },
        submissionsByCycleId: {},
        submitTherapistAvailabilityGridAction: async () => {},
      })
    )

    expect(html).toContain('You marked Need Off on dates that already have a scheduled shift.')
    expect(html).toContain('Mon Apr 20')
    expect(html).toContain('Review in Schedule')
  })

  it('explains when no Schedule Block is open for therapist availability', () => {
    const html = renderToStaticMarkup(
      createElement(TherapistAvailabilityWorkspace, {
        cycles: [],
        availabilityRows: [],
        conflicts: [],
        initialCycleId: '',
        todayKey: '2026-04-19',
        hasSavedRecurringPattern: false,
        recurringPatternSummary: 'No normal schedule saved yet.',
        generatedBaselineByCycleId: {},
        submissionsByCycleId: {},
        submitTherapistAvailabilityGridAction: async () => {},
      })
    )

    expect(html).toContain('No upcoming Schedule Block is open for availability yet.')
    expect(html).toContain('Check back after your manager opens the next Schedule Block.')
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
        todayKey: '2026-04-24',
        hasSavedRecurringPattern: false,
        recurringPatternSummary: 'No normal schedule saved yet.',
        generatedBaselineByCycleId: { 'cycle-1': {} },
        submissionsByCycleId: {},
        submitTherapistAvailabilityGridAction: async () => {},
      })
    )

    expect(html).toContain('This Schedule Block starts blank.')
    expect(html).toContain('Add days you Need to Work or Need Off.')
    expect(html).toContain('Unmarked')
    expect(html).not.toContain('Not set')
    expect(html).not.toContain('Normal off day')
    expect(html).not.toContain('Request to Work')
  })

  it('disables locked local draft controls that would create unsavable changes', () => {
    const html = renderToStaticMarkup(
      createElement(TherapistAvailabilityWorkspace, {
        cycles: [
          {
            id: 'cycle-1',
            label: 'Apr 2026',
            start_date: '2026-04-24',
            end_date: '2026-05-07',
            published: false,
          },
        ],
        availabilityRows: [],
        conflicts: [],
        initialCycleId: 'cycle-1',
        todayKey: '2026-04-24',
        hasSavedRecurringPattern: false,
        recurringPatternSummary: 'No normal schedule saved yet.',
        generatedBaselineByCycleId: { 'cycle-1': {} },
        submissionsByCycleId: {},
        availabilityLocked: true,
        availabilityLockedReason: 'manager_closed',
        submitTherapistAvailabilityGridAction: async () => {},
      })
    )

    expect(html).toContain(
      'Availability is locked, so Schedule Block availability changes are disabled.'
    )
    expect(html).toMatch(/id="range-start"[\s\S]*?disabled=""/)
    expect(html).toMatch(/id="range-end"[\s\S]*?disabled=""/)
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Use previous Schedule Block<\/button>/)
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Clear block changes<\/button>/)
    expect(html).toContain('aria-describedby="locked-availability-draft-controls"')
  })

  it('keeps range, copy, and clear draft controls available when availability is unlocked', () => {
    const html = renderToStaticMarkup(
      createElement(TherapistAvailabilityWorkspace, {
        cycles: [
          {
            id: 'cycle-1',
            label: 'Apr 2026',
            start_date: '2026-04-24',
            end_date: '2026-05-07',
            published: false,
          },
        ],
        availabilityRows: [],
        conflicts: [],
        initialCycleId: 'cycle-1',
        todayKey: '2026-04-24',
        hasSavedRecurringPattern: false,
        recurringPatternSummary: 'No normal schedule saved yet.',
        generatedBaselineByCycleId: { 'cycle-1': {} },
        submissionsByCycleId: {},
        submitTherapistAvailabilityGridAction: async () => {},
      })
    )

    expect(html).not.toContain(
      'Availability is locked, so Schedule Block availability changes are disabled.'
    )
    expect(html).not.toMatch(/id="range-start"[\s\S]*?disabled=""/)
    expect(html).not.toMatch(/id="range-end"[\s\S]*?disabled=""/)
    expect(html).toContain('Use previous Schedule Block')
    expect(html).toContain('Clear block changes')
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Use previous Schedule Block<\/button>/)
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Clear block changes<\/button>/)
    expect(html).not.toContain('locked-availability-draft-controls')
  })

  it('explains submitted blank-state cycles without implying missing work', () => {
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
        todayKey: '2026-05-03',
        hasSavedRecurringPattern: false,
        recurringPatternSummary: 'No normal schedule saved yet.',
        generatedBaselineByCycleId: { 'cycle-1': {} },
        submissionsByCycleId: {
          'cycle-1': {
            submittedAt: '2026-05-01T12:00:00.000Z',
            lastEditedAt: '2026-05-01T12:00:00.000Z',
          },
        },
        submitTherapistAvailabilityGridAction: async () => {},
      })
    )

    expect(html).toContain('Submitted')
    expect(html).toContain(
      'Submitted with no day-level changes. This Schedule Block is currently blank unless you add dates.'
    )
    expect(html).toContain('You already submitted this Schedule Block with a blank response.')
    expect(html).toContain('No exceptions selected for this Schedule Block.')
    expect(html).toContain('Submitted availability')
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
        todayKey: '2026-05-03',
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
    expect(html).toContain('This Schedule Block starts blank.')
    expect(html).toContain('Add days you Need to Work or Need Off.')
    expect(html).toContain('Set recurring pattern')
    expect(html).not.toContain('Edit recurring pattern')
    expect(html).not.toContain('We used your normal schedule to fill this cycle.')
    expect(html).not.toContain('We used your normal schedule to fill this Schedule Block.')
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
    expect(src).not.toContain('This Schedule Block:')
    expect(src).not.toContain('Can work')
    expect(src).not.toContain("can't work")
    expect(src).not.toContain("can or can't work")
    expect(src).toContain('Need to Work')
    expect(src).toContain('Need Off')
    expect(src).toContain(
      'Submitted with no Schedule Block changes. Your normal schedule is your current response.'
    )
    expect(src).toContain(
      'You already submitted this Schedule Block without adding changes for this Schedule Block.'
    )
    expect(src).toContain(
      'Submitted with no day-level changes. This Schedule Block is currently blank unless you add dates.'
    )
    expect(src).toContain("displayState === 'can_work' || displayState === 'cannot_work'")
    expect(src).toContain('{showStatusLabel ? (')
    expect(src).toContain('Notes are only saved for days you change for this Schedule Block.')
    expect(src).toContain('Review before submitting')
    expect(src).toContain('formatReviewDateWithNote')
    expect(src).toContain('No exceptions selected for this Schedule Block.')
    expect(src).toContain('Edit several days')
    expect(src).toContain('rounded-[0.95rem] border border-border/60 bg-background px-3.5 py-2.5')
    expect(src).toContain('xl:border-l xl:border-t-0')
    expect(src).toContain('xl:grid-cols-[minmax(0,1fr)_19rem]')
    expect(src).toContain('flex flex-col gap-3 xl:self-start')
    expect(src).toContain('order-1 rounded-[1.1rem]')
    expect(src).toContain('xl:order-3')
    expect(src).toContain('ring-primary/35')
    expect(src).toContain('value="draft"')
    expect(src).toContain('variant="ghost"')
    expect(src).toContain('value="submit"')
    expect(src).toContain('pendingText="Submitting..."')
    expect(src).toContain('Submit availability sends this Schedule Block to managers.')
    expect(src).toContain('todayKey: string')
    expect(src).not.toContain('const todayKey = toIsoDate(new Date())')
    expect(src).toContain('function dayOfMonthFromIsoDate(isoDate: string): number')
    expect(src).toContain('const dayNum = dayOfMonthFromIsoDate(date)')
    expect(src).not.toContain('new Date(`${date}T00:00:00`).getDate()')
    expect(src).toContain('function copyPreviousCycleOverrides()')
    expect(src).toContain('function clearOverrides()')
    expect(src).toContain('if (availabilityLocked) return')
    expect(src).toContain('disabled={availabilityLocked}')
    expect(src).toContain('locked-availability-draft-controls')
  })
})
