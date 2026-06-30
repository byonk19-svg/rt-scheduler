import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'

import {
  EmptyState,
  FilterButtonGroup,
  FilterPill,
  getRequestActionModel,
  ManagerRequestCard,
  resolveShiftBoardTab,
  WaitingPreviewPanel,
  type ShiftBoardRequest,
} from '@/components/shift-board/ShiftBoardClientPage'

function request(overrides: Partial<ShiftBoardRequest>): ShiftBoardRequest {
  return {
    id: 'request-1',
    type: 'pickup',
    visibility: 'team',
    recipientResponse: null,
    requestKind: 'standard',
    poster: 'Julie C.',
    postedById: 'julie',
    avatar: 'JC',
    shift: 'Sun, May 10 - Night',
    shiftDate: '2026-05-10',
    shiftCycleId: 'cycle-1',
    shiftId: 'shift-1',
    swapShift: null,
    swapShiftDate: null,
    swapShiftId: null,
    swapShiftType: null,
    swapShiftRole: null,
    message: 'Needs coverage.',
    status: 'pending',
    posted: '7 hours ago',
    postedAt: '2026-05-10T12:00:00.000Z',
    swapWithName: null,
    swapWithId: null,
    claimedById: null,
    pendingInterestCount: 0,
    hasMyInterest: false,
    myInterestId: null,
    myInterestStatus: null,
    interestCandidates: [],
    shiftType: 'night',
    shiftRole: 'staff',
    overrideReason: null,
    ...overrides,
  }
}

function renderManagerCard(overrides: Partial<ShiftBoardRequest>): string {
  const req = request(overrides)

  return renderToStaticMarkup(
    createElement(ManagerRequestCard, {
      req,
      canReview: true,
      onPickupInterest: () => undefined,
      saving: false,
      interactiveEnabled: true,
      therapists: [
        { id: 'julie', full_name: 'Julie C.' },
        { id: 'aleyce', full_name: 'Aleyce' },
        { id: 'layne', full_name: 'Layne', is_lead_eligible: true },
      ],
      scheduledOnDate: new Map<string, 'day' | 'night'>([
        ['staff-1', 'night'],
        ['staff-2', 'night'],
        ['aleyce', 'day'],
        ['layne', 'day'],
      ]),
      scheduledOnSwapDate: new Map<string, 'day' | 'night'>([
        ['layne', 'day'],
        ['staff-3', 'day'],
        ['staff-4', 'day'],
      ]),
      shiftRole: 'staff',
      swapPartnerId: req.swapWithId ?? '',
      onSwapPartnerChange: () => undefined,
      selectedPickupInterestId: null,
      onSelectPickupInterest: () => undefined,
      overrideReason: '',
      onOverrideReasonChange: () => undefined,
      onForceApprove: () => undefined,
      onAction: () => undefined,
      onViewShift: () => undefined,
    })
  )
}

describe('manager Shift Board action model', () => {
  it('accepts notification tab links for terminal request history', () => {
    expect(resolveShiftBoardTab('history')).toBe('history')
    expect(resolveShiftBoardTab('open-shifts')).toBe('open-shifts')
    expect(resolveShiftBoardTab('unknown')).toBe('needs-action')
    expect(resolveShiftBoardTab(null)).toBe('needs-action')
  })

  it('announces selected state for request filter button groups', () => {
    const html = renderToStaticMarkup(
      createElement(FilterButtonGroup, {
        label: 'Request type',
        value: 'pickup',
        options: [
          ['all', 'All Types'],
          ['swap', 'Trade'],
          ['pickup', 'Coverage'],
        ],
        onChange: () => undefined,
      })
    )

    expect(html).toContain('role="group"')
    expect(html).toContain('aria-label="Request type"')
    expect(html).toMatch(/aria-pressed="false"[^>]*>All Types/)
    expect(html).toMatch(/aria-pressed="false"[^>]*>Trade/)
    expect(html).toMatch(/aria-pressed="true"[^>]*>Coverage/)
  })

  it('announces selected state for scope filter pills', () => {
    const activeHtml = renderToStaticMarkup(
      createElement(FilterPill, {
        label: 'My Requests',
        active: true,
        onClick: () => undefined,
      })
    )
    const inactiveHtml = renderToStaticMarkup(
      createElement(FilterPill, {
        label: 'All Posts',
        active: false,
        onClick: () => undefined,
      })
    )

    expect(activeHtml).toMatch(/aria-pressed="true"[^>]*>My Requests/)
    expect(inactiveHtml).toMatch(/aria-pressed="false"[^>]*>All Posts/)
  })

  it('labels the staff scope filter pill group', () => {
    const source = readFileSync('src/components/shift-board/ShiftBoardClientPage.tsx', 'utf8')

    expect(source).toContain('role="group" aria-label="Post scope"')
  })

  it('does not approve a direct swap waiting on teammate response', () => {
    const model = getRequestActionModel({
      req: request({ type: 'swap', visibility: 'direct', recipientResponse: 'pending' }),
      canReview: true,
      hasSwapPartner: true,
      hasBackupResponder: false,
    })

    expect(model).toEqual({
      primary: 'View request',
      secondary: ['Cancel request'],
      showsApprove: false,
    })
  })

  it('approves the selected responder for a pickup with responders', () => {
    const model = getRequestActionModel({
      req: request({ pendingInterestCount: 3 }),
      canReview: true,
      hasSwapPartner: false,
      hasBackupResponder: true,
    })

    expect(model.primary).toBe('Approve coverage request')
    expect(model.secondary).toContain('Change responder')
    expect(model.showsApprove).toBe(true)
  })

  it('does not approve a pickup with zero responders', () => {
    const model = getRequestActionModel({
      req: request({ pendingInterestCount: 0 }),
      canReview: true,
      hasSwapPartner: false,
      hasBackupResponder: false,
    })

    expect(model.primary).toBe('View coverage request')
    expect(model.secondary).toContain('Add coverage manually')
    expect(model.showsApprove).toBe(false)
  })

  it('approves a direct pickup after the teammate accepts', () => {
    const model = getRequestActionModel({
      req: request({
        visibility: 'direct',
        recipientResponse: 'accepted',
        claimedById: 'off-day-partner',
        swapWithId: 'off-day-partner',
      }),
      canReview: true,
      hasSwapPartner: false,
      hasBackupResponder: false,
    })

    expect(model.primary).toBe('Approve coverage request')
    expect(model.secondary).toContain('View shift')
    expect(model.showsApprove).toBe(true)
  })

  it('shows Choose partner for an open trade request without a selected partner', () => {
    const model = getRequestActionModel({
      req: request({ type: 'swap', visibility: 'team', swapWithId: null }),
      canReview: true,
      hasSwapPartner: false,
      hasBackupResponder: false,
    })

    expect(model.primary).toBe('Choose partner')
    expect(model.showsApprove).toBe(false)
  })

  it('approves a ready trade request with a selected partner', () => {
    const model = getRequestActionModel({
      req: request({ type: 'swap', visibility: 'team', swapWithId: 'layne' }),
      canReview: true,
      hasSwapPartner: true,
      hasBackupResponder: false,
    })

    expect(model.primary).toBe('Approve trade request')
    expect(model.secondary).toContain('View shifts')
    expect(model.showsApprove).toBe(true)
  })

  it('renders responder queue inside the pickup card and approves the selected responder', () => {
    const html = renderManagerCard({
      requestKind: 'call_in',
      message: 'Seeded pickup queue with primary and backup claimants',
      pendingInterestCount: 3,
      interestCandidates: [
        {
          id: 'interest-1',
          therapistId: 'audbriana',
          therapistName: 'Audbriana',
          createdAt: '2026-05-10T13:00:00.000Z',
          status: 'selected',
        },
        {
          id: 'interest-2',
          therapistId: 'gayle',
          therapistName: 'Gayle',
          createdAt: '2026-05-10T14:00:00.000Z',
          status: 'pending',
        },
      ],
    })

    expect(html).toContain('Responder queue')
    expect(html).toContain('First responder')
    expect(html).not.toContain('Selected replacement')
    expect(html).toContain('backup responder')
    expect(html).toContain('Approve coverage request')
    expect(html).not.toContain('Selected responder:')
    expect(html).toContain(
      'Ready because Audbriana can pick up the shift and coverage remains safe.'
    )
    expect(html).toContain('Audbriana will be added to Sun, May 10 - Night.')
    expect(html).toContain('The original call-in remains on the schedule.')
    expect(html).toContain('scheduled / target')
    expect(html).toContain('No coverage risk')
    expect(html).toContain('First responder')
    expect(html).toContain('Request history')
    expect(html).toContain('Decision summary')
    expect(html).toContain('scroll-mt-24')
    expect(html).not.toContain('First response:')
    expect(html).not.toMatch(/claimant|seeded|test user|demo therapist/i)
  })

  it('renders direct accepted pickup as ready for manager approval', () => {
    const html = renderManagerCard({
      type: 'pickup',
      visibility: 'direct',
      recipientResponse: 'accepted',
      claimedById: 'off-day-partner',
      swapWithId: 'off-day-partner',
      swapWithName: 'Off Day Partner',
      pendingInterestCount: 0,
    })

    expect(html).toContain('Ready for decision')
    expect(html).toContain('Off Day Partner will be added to Sun, May 10 - Night.')
    expect(html).toContain(
      'Ready because Off Day Partner can pick up the shift and coverage remains safe.'
    )
    expect(html).toContain('Approve coverage request')
    expect(html).not.toContain('View coverage request')
  })

  it('keeps long responder and requester names readable inside the card', () => {
    const html = renderManagerCard({
      poster: 'Julie Catherine Montgomery',
      pendingInterestCount: 1,
      interestCandidates: [
        {
          id: 'interest-1',
          therapistId: 'audbriana',
          therapistName: 'Audbriana Montgomery-Santiago',
          createdAt: '2026-05-10T13:00:00.000Z',
          status: 'selected',
        },
      ],
    })

    expect(html).toContain('Requested by Julie Catherine Montgomery')
    expect(html).toContain('Audbriana Montgomery-Santiago')
    expect(html).toContain('break-words')
    expect(html).not.toContain('truncate')
  })

  it('renders ready trade impact and approve request without old queue language', () => {
    const html = renderManagerCard({
      type: 'swap',
      visibility: 'team',
      poster: 'Aleyce',
      shift: 'Tue, May 19 - Day',
      shiftType: 'day',
      swapWithId: 'layne',
      swapWithName: 'Layne',
      swapShift: 'Thu, May 21 - Day',
      swapShiftDate: '2026-05-21',
      swapShiftId: 'shift-2',
      swapShiftType: 'day',
      swapShiftRole: 'staff',
    })

    expect(html).toContain('Schedule Impact')
    expect(html).toContain('Tue, May 19 - Day')
    expect(html).toContain('Thu, May 21 - Day')
    expect(html).toContain('Before: Aleyce on')
    expect(html).toContain('After: Layne on')
    expect(html).toContain(
      'Aleyce and Layne trade assigned shifts; staffing count does not change.'
    )
    expect(html).toContain('Staffing unchanged')
    expect(html).toContain('No coverage risk')
    expect(html).toContain('Approve trade request')
    expect(html).toContain('Ready because staffing remains safe after the exchange.')
  })

  it('renders waiting direct trades without approve copy', () => {
    const html = renderManagerCard({
      type: 'swap',
      visibility: 'direct',
      recipientResponse: 'pending',
      swapWithId: 'layne',
      swapWithName: 'Layne',
    })

    expect(html).toContain('Waiting on teammate')
    expect(html).toContain('Impact pending teammate response')
    expect(html).toContain('Manager approval will be available after Layne responds.')
    expect(html).toContain('Approval unlocks after Layne responds.')
    expect(html).toContain('View request')
    expect(html).not.toContain('Approve trade request')
  })

  it('renders a useful Needs Action empty state with next queue links', () => {
    const html = renderToStaticMarkup(
      createElement(EmptyState, {
        activeTab: 'needs-action',
        openPostCount: 5,
        waitingCount: 2,
        onClear: () => undefined,
        onViewOpenShifts: () => undefined,
        onViewWaiting: () => undefined,
      })
    )

    expect(html).toContain('No manager decisions right now')
    expect(html).toContain('Open coverage requests - 5')
    expect(html).toContain('Waiting - 2')
    expect(html).toContain('Review posts that still need a responder.')
    expect(html).toContain('Check requests blocked by teammate response.')
  })

  it('renders open trade requests without a selected partner as Choose partner only', () => {
    const html = renderManagerCard({
      type: 'swap',
      visibility: 'team',
      swapWithId: null,
      swapWithName: null,
    })

    expect(html).toContain('Needs trade partner')
    expect(html).toContain('Choose partner')
    expect(html).toContain('Choose the teammate before manager approval is available.')
    expect(html).not.toContain('Approve trade request')
  })

  it('renders a compact waiting preview outside the Needs Action queue', () => {
    const html = renderToStaticMarkup(
      createElement(WaitingPreviewPanel, {
        requests: [
          request({
            type: 'swap',
            visibility: 'direct',
            recipientResponse: 'pending',
            swapWithName: 'Layne',
            shift: 'Wed, May 20 - Day',
          }),
        ],
        onViewWaiting: () => undefined,
      })
    )

    expect(html).toContain('Waiting nearby')
    expect(html).toContain('blocked by teammate response')
    expect(html).toContain('Wed, May 20 - Day')
    expect(html).toContain('Layne has not responded')
    expect(html).toContain('View Waiting')
    expect(html).not.toContain('Approve trade request')
  })
})
