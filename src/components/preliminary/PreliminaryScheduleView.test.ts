import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { PreliminaryScheduleView } from '@/components/preliminary/PreliminaryScheduleView'
import type { PreliminaryHistoryItem, PreliminaryShiftCard } from '@/lib/preliminary-schedule/types'

function makeCard(overrides: Partial<PreliminaryShiftCard> = {}): PreliminaryShiftCard {
  return {
    shiftId: 'shift-1',
    shiftDate: '2026-03-22',
    shiftType: 'day',
    shiftRole: 'staff',
    assignedUserId: 'therapist-1',
    assignedName: 'Barbara C.',
    state: 'tentative_assignment',
    reservedById: null,
    requestId: null,
    canClaim: false,
    canRequestChange: false,
    ...overrides,
  }
}

function makeHistory(overrides: Partial<PreliminaryHistoryItem> = {}): PreliminaryHistoryItem {
  return {
    id: 'request-1',
    requestId: 'request-1',
    shiftId: 'shift-1',
    shiftDate: '2026-03-22',
    shiftType: 'day',
    requestType: 'request_change',
    status: 'pending',
    note: 'Need to swap this one',
    createdAt: '2026-03-19T10:00:00.000Z',
    ...overrides,
  }
}

describe('PreliminaryScheduleView', () => {
  it('renders tentative assignments, open slots, pending claims, and request history', () => {
    const html = renderToStaticMarkup(
      createElement(PreliminaryScheduleView, {
        snapshotId: 'snapshot-1',
        cycleLabel: 'April schedule',
        snapshotSentAt: '2026-03-19T10:00:00.000Z',
        currentUserId: 'therapist-1',
        cards: [
          makeCard({
            shiftId: 'assigned-shift',
            canRequestChange: true,
          }),
          makeCard({
            shiftId: 'open-shift',
            assignedUserId: null,
            assignedName: null,
            state: 'open',
            canClaim: true,
          }),
          makeCard({
            shiftId: 'pending-claim-shift',
            assignedUserId: null,
            assignedName: null,
            state: 'pending_claim',
            reservedById: 'therapist-2',
          }),
          makeCard({
            shiftId: 'next-week-shift',
            shiftDate: '2026-03-30',
            assignedUserId: null,
            assignedName: null,
            state: 'open',
            canClaim: true,
          }),
        ],
        historyItems: [
          makeHistory(),
          makeHistory({
            id: 'request-2',
            requestId: 'request-2',
            requestType: 'claim_open_shift',
            status: 'approved',
            note: 'Can cover this PRN shift',
          }),
        ],
        claimAction: async () => {},
        requestChangeAction: async () => {},
        cancelAction: async () => {},
      })
    )

    expect(html).toContain('Preliminary Schedule')
    expect(html).toContain('Request change')
    expect(html).toContain('Claim shift')
    expect(html).toContain('Pending claim')
    expect(html).toContain('Week of Mar 22')
    expect(html).toContain('Week of Mar 29')
    expect(html).toContain('Request history')
    expect(html).toContain('Can cover this PRN shift')
  })
})
