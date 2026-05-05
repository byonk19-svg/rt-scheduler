import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { RequestsHistoryView } from '@/components/requests/RequestsHistoryView'
import type { OpenRequest } from '@/components/requests/request-page-model'

function makeRequest(overrides: Partial<OpenRequest> = {}): OpenRequest {
  return {
    id: 'request-1',
    createdAt: '2026-05-04T15:00:00.000Z',
    recipientRespondedAt: '2026-05-04T16:00:00.000Z',
    type: 'swap',
    visibility: 'direct',
    involvement: 'posted',
    sourcePostId: 'request-1',
    recipientResponse: 'accepted',
    requestKind: 'standard',
    shift: 'Mon, May 12 - Day',
    status: 'pending',
    stageLabel: 'Awaiting manager review',
    stageDetail: 'Teammate accepted. Manager approval is still required.',
    swapWith: 'Barbara C.',
    posted: '1 hour ago',
    message: 'Can you swap with me?',
    ...overrides,
  }
}

describe('RequestsHistoryView', () => {
  it('shows a request timeline when a request is deep-linked', () => {
    const html = renderToStaticMarkup(
      createElement(RequestsHistoryView, {
        approvedCount: 0,
        error: null,
        loading: false,
        pendingCount: 1,
        requests: [makeRequest()],
        selectedRequestId: 'request-1',
        totalRequests: 1,
        onNewRequest: () => undefined,
        onRespondDirectRequest: async () => undefined,
        onWithdrawInterest: async () => undefined,
        onWithdrawRequest: async () => undefined,
      })
    )

    expect(html).toContain('Current stage')
    expect(html).toContain('Timeline')
    expect(html).toContain('Request created')
    expect(html).toContain('Teammate accepted')
    expect(html).toContain('Awaiting manager review')
  })
})
