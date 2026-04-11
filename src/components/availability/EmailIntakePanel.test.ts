import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { EmailIntakePanel } from '@/components/availability/EmailIntakePanel'

const baseRow = {
  id: 'intake-1',
  fromEmail: 'employee@example.com',
  fromName: 'Employee Example',
  subject: 'Need off Mar 24',
  receivedAt: '2026-03-20T12:00:00Z',
  parseStatus: 'parsed' as const,
  parseSummary: 'Found one day off request',
  matchedTherapistId: 'therapist-1',
  matchedTherapistName: 'Adrienne Solt',
  matchedCycleId: 'cycle-1',
  matchedCycleLabel: 'Critique Cycle (2026-03-17 to 2026-04-27)',
  parsedRequests: [{ date: '2026-03-24', override_type: 'force_off' as const }],
  attachments: [],
}

describe('EmailIntakePanel', () => {
  it('renders Apply dates only when therapist and cycle are both matched', () => {
    const html = renderToStaticMarkup(
      createElement(EmailIntakePanel, {
        rows: [baseRow],
        applyEmailAvailabilityImportAction: async () => {},
        createManualEmailIntakeAction: async () => {},
        updateEmailIntakeTherapistAction: async () => {},
        therapistOptions: [{ id: 'therapist-1', fullName: 'Adrienne Solt' }],
        cycleOptions: [{ id: 'cycle-1', label: 'Critique Cycle (2026-03-17 to 2026-04-27)' }],
      })
    )

    expect(html).toContain('Apply dates')
    expect(html).not.toContain('Save matches')
  })

  it('requires a cycle match before exposing Apply dates', () => {
    const html = renderToStaticMarkup(
      createElement(EmailIntakePanel, {
        rows: [{ ...baseRow, matchedCycleId: null, matchedCycleLabel: null }],
        applyEmailAvailabilityImportAction: async () => {},
        createManualEmailIntakeAction: async () => {},
        updateEmailIntakeTherapistAction: async () => {},
        therapistOptions: [{ id: 'therapist-1', fullName: 'Adrienne Solt' }],
        cycleOptions: [{ id: 'cycle-1', label: 'Critique Cycle (2026-03-17 to 2026-04-27)' }],
      })
    )

    expect(html).not.toContain('Apply dates')
    expect(html).toContain('Match schedule block')
    expect(html).toContain('Save matches')
    expect(html).toContain('Select schedule block')
  })
})
