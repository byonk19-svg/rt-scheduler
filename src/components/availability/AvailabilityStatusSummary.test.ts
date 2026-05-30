import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AvailabilityStatusSummary } from '@/components/availability/AvailabilityStatusSummary'

describe('AvailabilityStatusSummary', () => {
  it('renders the queue-first roster with table-like columns and manager actions', () => {
    const html = renderToStaticMarkup(
      createElement(AvailabilityStatusSummary, {
        submittedRows: [
          {
            therapistId: 'submitted-1',
            therapistName: 'Adrienne S.',
            overridesCount: 2,
            lastUpdatedAt: '2026-03-15T12:00:00.000Z',
            shiftType: 'day',
            employmentType: 'full_time',
          },
          {
            therapistId: 'submitted-2',
            therapistName: 'Barbara C.',
            overridesCount: 1,
            lastUpdatedAt: '2026-03-14T12:00:00.000Z',
            shiftType: 'day',
            employmentType: 'part_time',
          },
          {
            therapistId: 'submitted-3',
            therapistName: 'Kim S.',
            overridesCount: 3,
            lastUpdatedAt: '2026-03-13T12:00:00.000Z',
            shiftType: 'night',
            employmentType: 'full_time',
          },
          {
            therapistId: 'submitted-4',
            therapistName: 'Rosa V.',
            overridesCount: 0,
            lastUpdatedAt: '2026-03-12T12:00:00.000Z',
            shiftType: 'day',
            employmentType: 'prn',
          },
        ],
        missingRows: [
          {
            therapistId: 'missing-1',
            therapistName: 'Layne P.',
            overridesCount: 0,
            lastUpdatedAt: null,
            shiftType: 'day',
            employmentType: 'full_time',
          },
          {
            therapistId: 'missing-2',
            therapistName: 'Tannie L.',
            overridesCount: 0,
            lastUpdatedAt: null,
            shiftType: 'night',
            employmentType: 'prn',
          },
        ],
        initialFilter: 'submitted_with_exceptions',
      })
    )

    expect(html).toContain('Availability queue')
    expect(html).toContain('Needs submission')
    expect(html).toContain('Submitted with requests')
    expect(html).toContain('Submitted no requests')
    expect(html).toContain('All therapists')
    expect(html).toContain('Therapist')
    expect(html).toContain('Status / requests / activity')
    expect(html).toContain('Adrienne S.')
    expect(html).toContain('Barbara C.')
    expect(html).toContain('Part-time')
    expect(html).not.toContain('Rosa V.')
    expect(html).toContain('Review')
    expect(html).not.toContain('Enter manually')
  })

  it('renders a load-more queue instead of forcing an inner scroll region', () => {
    const html = renderToStaticMarkup(
      createElement(AvailabilityStatusSummary, {
        submittedRows: Array.from({ length: 30 }, (_, i) => ({
          therapistId: `t-${i}`,
          therapistName: `Therapist ${i}`,
          overridesCount: 1,
          lastUpdatedAt: '2026-03-01T12:00:00.000Z',
        })),
        missingRows: [],
        embedded: true,
        initialFilter: 'all',
      })
    )

    expect(html).toContain('Load more')
    expect(html).not.toContain('overflow-y-auto')
  })

  it('renders the send-reminders button with the full Schedule Block scope', () => {
    const html = renderToStaticMarkup(
      createElement(AvailabilityStatusSummary, {
        submittedRows: [],
        missingRows: [
          {
            therapistId: 'missing-1',
            therapistName: 'Layne P.',
            overridesCount: 0,
            lastUpdatedAt: null,
            shiftType: 'day',
            employmentType: 'full_time',
          },
        ],
        cycleId: 'cycle-abc',
        onSendReminders: async () => ({ sent: 1, skipped: 0, failed: 0 }),
      })
    )

    expect(html).toContain('data-testid="send-reminders-trigger"')
    expect(html).toContain('Remind missing submissions across shifts (1)')
    expect(html).toContain('Requests: 0')
  })

  it('uses the unfiltered missing count for reminder copy when the queue is filtered', () => {
    const html = renderToStaticMarkup(
      createElement(AvailabilityStatusSummary, {
        submittedRows: [],
        missingRows: [
          {
            therapistId: 'visible-missing-1',
            therapistName: 'Layne P.',
            overridesCount: 0,
            lastUpdatedAt: null,
            shiftType: 'day',
            employmentType: 'full_time',
          },
        ],
        reminderMissingCount: 4,
        cycleId: 'cycle-abc',
        onSendReminders: async () => ({ sent: 4, skipped: 0, failed: 0 }),
      })
    )

    expect(html).toContain('Remind missing submissions across shifts (4)')
    expect(html).not.toContain('Remind missing submissions across shifts (1)')
  })

  it('still shows the reminder action when filters hide all missing rows', () => {
    const html = renderToStaticMarkup(
      createElement(AvailabilityStatusSummary, {
        submittedRows: [],
        missingRows: [],
        reminderMissingCount: 2,
        cycleId: 'cycle-abc',
        onSendReminders: async () => ({ sent: 2, skipped: 0, failed: 0 }),
      })
    )

    expect(html).toContain('Remind missing submissions across shifts (2)')
    expect(html).toContain('No therapists match the current work queue view.')
  })

  it('keeps the reminder dialog copy explicit about filtered queue scope', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/availability/AvailabilityStatusSummary.tsx'),
      'utf8'
    )

    expect(source).toContain('all missing submissions for the Schedule')
    expect(source).toContain('even if the queue is filtered')
  })

  it('does not render the send-reminders button when the full reminder scope is empty', () => {
    const html = renderToStaticMarkup(
      createElement(AvailabilityStatusSummary, {
        submittedRows: [
          {
            therapistId: 'submitted-1',
            therapistName: 'Adrienne S.',
            overridesCount: 1,
            lastUpdatedAt: '2026-03-15T12:00:00.000Z',
          },
        ],
        missingRows: [],
        reminderMissingCount: 0,
        cycleId: 'cycle-abc',
        onSendReminders: async () => ({ sent: 0, skipped: 0, failed: 0 }),
      })
    )

    expect(html).not.toContain('Send reminders')
  })

  it('highlights the selected planner therapist row', () => {
    const html = renderToStaticMarkup(
      createElement(AvailabilityStatusSummary, {
        submittedRows: [
          {
            therapistId: 'submitted-1',
            therapistName: 'Adrienne S.',
            overridesCount: 2,
            lastUpdatedAt: '2026-03-15T12:00:00.000Z',
          },
        ],
        missingRows: [
          {
            therapistId: 'missing-1',
            therapistName: 'Layne P.',
            overridesCount: 0,
            lastUpdatedAt: null,
          },
        ],
        selectedTherapistId: 'missing-1',
      })
    )

    expect(html).toContain('aria-current="true"')
  })

  it('labels manager-entered availability separately from therapist-submitted requests', () => {
    const html = renderToStaticMarkup(
      createElement(AvailabilityStatusSummary, {
        submittedRows: [
          {
            therapistId: 'manager-entered-1',
            therapistName: 'Rosa V.',
            overridesCount: 0,
            managerEnteredCount: 2,
            lastUpdatedAt: '2026-03-16T12:00:00.000Z',
            shiftType: 'day',
            employmentType: 'full_time',
          },
        ],
        missingRows: [],
        initialFilter: 'submitted_with_exceptions',
      })
    )

    expect(html).toContain('Manager-entered')
    expect(html).toContain('Requests: 2')
    expect(html).toContain('data-roster-filter="submitted_no_exceptions"')
  })
})
