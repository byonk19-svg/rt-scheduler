import { describe, expect, it } from 'vitest'

import {
  resolveNextPickupQueueCandidate,
  resolvePickupApprovalCandidate,
} from '@/lib/pickup-interest-selection'

describe('resolvePickupApprovalCandidate', () => {
  const request = {
    id: 'post-1',
    claimedById: null,
    interestCandidates: [
      {
        id: 'interest-1',
        therapistId: 'ther-1',
        therapistName: 'Alice',
        createdAt: '2026-04-24T08:00:00.000Z',
        status: 'selected' as const,
      },
      {
        id: 'interest-2',
        therapistId: 'ther-2',
        therapistName: 'Bob',
        createdAt: '2026-04-24T09:00:00.000Z',
        status: 'pending' as const,
      },
    ],
  }

  it('falls back to the oldest interest when no explicit selection is provided', () => {
    const candidate = resolvePickupApprovalCandidate(request, null)
    expect(candidate?.interestId).toBe('interest-1')
    expect(candidate?.therapistId).toBe('ther-1')
    expect(candidate?.status).toBe('selected')
  })

  it('uses the explicit selected interest when present', () => {
    const candidate = resolvePickupApprovalCandidate(request, 'interest-2')
    expect(candidate?.interestId).toBe('interest-2')
    expect(candidate?.therapistId).toBe('ther-2')
    expect(candidate?.status).toBe('pending')
  })

  it('prefers the selected primary claimant before falling back to time order', () => {
    const candidate = resolvePickupApprovalCandidate(request, null)
    expect(candidate?.interestId).toBe('interest-1')
  })

  it('promotes the next backup when the selected claimant is removed', () => {
    const candidate = resolveNextPickupQueueCandidate(request.interestCandidates, 'interest-1')
    expect(candidate?.interestId).toBe('interest-2')
    expect(candidate?.therapistId).toBe('ther-2')
    expect(candidate?.status).toBe('pending')
  })

  it('keeps the current selected claimant when a backup is removed', () => {
    const candidate = resolveNextPickupQueueCandidate(request.interestCandidates, 'interest-2')
    expect(candidate?.interestId).toBe('interest-1')
    expect(candidate?.therapistId).toBe('ther-1')
    expect(candidate?.status).toBe('selected')
  })

  it('breaks equal-timestamp ties by interest id when promoting the next backup', () => {
    const candidate = resolveNextPickupQueueCandidate(
      [
        {
          id: 'interest-c',
          therapistId: 'ther-3',
          therapistName: 'Casey',
          createdAt: '2026-04-24T08:00:00.000Z',
          status: 'selected' as const,
        },
        {
          id: 'interest-b',
          therapistId: 'ther-2',
          therapistName: 'Blair',
          createdAt: '2026-04-24T09:00:00.000Z',
          status: 'pending' as const,
        },
        {
          id: 'interest-a',
          therapistId: 'ther-1',
          therapistName: 'Alex',
          createdAt: '2026-04-24T09:00:00.000Z',
          status: 'pending' as const,
        },
      ],
      'interest-c'
    )

    expect(candidate?.interestId).toBe('interest-a')
    expect(candidate?.therapistId).toBe('ther-1')
  })
})
