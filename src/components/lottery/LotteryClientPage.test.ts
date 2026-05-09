import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import LotteryClientPage from '@/components/lottery/LotteryClientPage'
import type { LotteryPageSnapshot } from '@/lib/lottery/service'

function buildSnapshot(overrides: Partial<LotteryPageSnapshot> = {}): LotteryPageSnapshot {
  const snapshot: LotteryPageSnapshot = {
    actor: {
      userId: 'manager-1',
      role: 'manager',
      canManageList: true,
      canApply: true,
      shiftType: 'day',
    },
    selectedDate: '2026-05-08',
    selectedShift: 'day',
    availableDates: ['2026-05-08'],
    keepToWork: 2,
    workingScheduledCount: 3,
    eligibleReductionCount: 2,
    protectedScheduledCount: 1,
    scheduledStaff: [
      {
        shiftId: 'shift-lead',
        therapistId: 'lead-1',
        therapistName: 'Morgan Lead',
        employmentType: 'full_time',
        role: 'lead',
        isReductionCandidate: true,
        hasRequest: false,
      },
      {
        shiftId: 'shift-core',
        therapistId: 'staff-1',
        therapistName: 'Alex Core',
        employmentType: 'full_time',
        role: 'staff',
        isReductionCandidate: true,
        hasRequest: true,
      },
      {
        shiftId: 'shift-prn',
        therapistId: 'staff-2',
        therapistName: 'Jamie PRN',
        employmentType: 'prn',
        role: 'staff',
        isReductionCandidate: false,
        hasRequest: false,
      },
    ],
    requestList: [
      {
        id: 'request-1',
        therapistId: 'staff-1',
        therapistName: 'Alex Core',
        requestedAt: '2026-05-08T12:00:00.000Z',
      },
    ],
    myRequests: [],
    lotteryList: [
      {
        id: 'entry-1',
        therapistId: 'staff-1',
        therapistName: 'Alex Core',
        fixedOrder: 1,
        lastLotteriedDate: null,
      },
    ],
    missingListEntries: [],
    requestableTherapists: [],
    recommendationCandidates: [
      {
        therapistId: 'staff-1',
        therapistName: 'Alex Core',
        employmentType: 'full_time',
      },
    ],
    canCurrentUserRequest: false,
    currentUserHasRequest: false,
    recommendation: {
      state: 'stale',
      keepToWork: 2,
      scheduledCount: 3,
      reductionsNeeded: 1,
      actions: [{ therapistId: 'staff-1', therapistName: 'Alex Core', status: 'on_call' }],
      explanation: ['One scheduled therapist should move to on call.'],
      contextSignature: 'ctx-1',
      latestAppliedAt: '2026-05-08T13:00:00.000Z',
      latestAppliedBy: 'Manager One',
      overrideApplied: false,
    },
    recommendationError: null,
    latestAppliedDecision: {
      keepToWork: 2,
      appliedAt: '2026-05-08T13:00:00.000Z',
      appliedBy: 'Manager One',
      actions: [{ therapistId: 'staff-1', therapistName: 'Alex Core', status: 'on_call' }],
      overrideApplied: false,
      contextSignature: 'ctx-1',
    },
  }

  return { ...snapshot, ...overrides }
}

function renderPage(snapshot = buildSnapshot()): string {
  return renderToStaticMarkup(createElement(LotteryClientPage, { initialSnapshot: snapshot }))
}

describe('LotteryClientPage', () => {
  it('shows live decision context before the recommendation', () => {
    const html = renderPage()

    expect(html).toContain('Lottery Decision Center')
    expect(html).toContain('Decision context')
    expect(html.indexOf('Decision context')).toBeLessThan(html.indexOf('Recommendation'))
    expect(html).toContain('Morgan Lead')
    expect(html).toContain('Core staff')
    expect(html).toContain('Alex Core')
    expect(html).toContain('PRN staff')
    expect(html).toContain('Jamie PRN')
    expect(html).toContain('Volunteer')
    expect(html).toContain('Latest applied decision')
    expect(html).toContain('Keep working: 2')
    expect(html).toContain('Recommended result')
    expect(html).toContain('Why this result')
    expect(html).toContain('Alex Core: On Call')
  })

  it('keeps therapist views transparent without apply controls', () => {
    const html = renderPage(
      buildSnapshot({
        actor: {
          userId: 'staff-1',
          role: 'therapist',
          canManageList: false,
          canApply: false,
          shiftType: 'day',
        },
      })
    )

    expect(html).toContain('Lottery List')
    expect(html).toContain('Your Lottery order')
    expect(html).toContain('You are position 1 of 1 for day shift.')
    expect(html).toContain('Alex Core')
    expect(html).toContain('You')
    expect(html).toContain('Outdated')
    expect(html).toContain(
      'The live schedule, requests, or keep-working count no longer matches the latest applied decision.'
    )
    expect(html).not.toContain('Apply result')
    expect(html).not.toContain('Manager override')
    expect(html).not.toContain('Add on behalf of a therapist')
  })
})
