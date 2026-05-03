import { describe, expect, it } from 'vitest'

import {
  buildLotteryRecommendation,
  type LotteryCandidate,
  type LotteryRequest,
} from '@/lib/lottery/recommendation'

function fullTime(
  overrides: Partial<LotteryCandidate> & Pick<LotteryCandidate, 'id' | 'name' | 'fixedOrder'>
): LotteryCandidate {
  return {
    id: overrides.id,
    name: overrides.name,
    employmentType: 'full_time',
    fixedOrder: overrides.fixedOrder,
    lastLotteriedDate: overrides.lastLotteriedDate ?? null,
  }
}

function prn(
  overrides: Partial<LotteryCandidate> & Pick<LotteryCandidate, 'id' | 'name'>
): LotteryCandidate {
  return {
    id: overrides.id,
    name: overrides.name,
    employmentType: 'prn',
    fixedOrder: overrides.fixedOrder ?? null,
    lastLotteriedDate: overrides.lastLotteriedDate ?? null,
  }
}

function request(
  therapistId: string,
  requestedAt: string,
  therapistName = therapistId
): LotteryRequest {
  return {
    therapistId,
    therapistName,
    requestedAt,
  }
}

describe('buildLotteryRecommendation', () => {
  it('returns on call for the first volunteer when one reduction is needed', () => {
    const result = buildLotteryRecommendation({
      keepToWork: 3,
      scheduled: [
        fullTime({ id: 'ashley', name: 'Ashley', fixedOrder: 1, lastLotteriedDate: '2026-04-01' }),
        fullTime({ id: 'taylor', name: 'Taylor', fixedOrder: 2, lastLotteriedDate: '2026-03-20' }),
        fullTime({ id: 'jordan', name: 'Jordan', fixedOrder: 3, lastLotteriedDate: null }),
        fullTime({ id: 'casey', name: 'Casey', fixedOrder: 4, lastLotteriedDate: '2026-02-10' }),
      ],
      requests: [
        request('ashley', '2026-04-21T08:00:00.000Z', 'Ashley'),
        request('taylor', '2026-04-21T08:05:00.000Z', 'Taylor'),
      ],
    })

    expect(result.actions).toEqual([
      { therapistId: 'ashley', therapistName: 'Ashley', status: 'on_call' },
    ])
    expect(result.reductionsNeeded).toBe(1)
    expect(result.prnInvolved).toBe(false)
  })

  it('uses the first two volunteers for two reductions and assigns cancelled then on call', () => {
    const result = buildLotteryRecommendation({
      keepToWork: 2,
      scheduled: [
        fullTime({ id: 'ashley', name: 'Ashley', fixedOrder: 1, lastLotteriedDate: '2026-04-01' }),
        fullTime({ id: 'taylor', name: 'Taylor', fixedOrder: 2, lastLotteriedDate: '2026-03-20' }),
        fullTime({ id: 'jordan', name: 'Jordan', fixedOrder: 3, lastLotteriedDate: null }),
        fullTime({ id: 'casey', name: 'Casey', fixedOrder: 4, lastLotteriedDate: '2026-02-10' }),
      ],
      requests: [
        request('ashley', '2026-04-21T08:00:00.000Z', 'Ashley'),
        request('taylor', '2026-04-21T08:05:00.000Z', 'Taylor'),
      ],
    })

    expect(result.actions).toEqual([
      { therapistId: 'ashley', therapistName: 'Ashley', status: 'cancelled' },
      { therapistId: 'taylor', therapistName: 'Taylor', status: 'on_call' },
    ])
  })

  it('uses blank last-lotteried dates as oldest and ties by fixed order when there are no volunteers', () => {
    const result = buildLotteryRecommendation({
      keepToWork: 3,
      scheduled: [
        fullTime({ id: 'ashley', name: 'Ashley', fixedOrder: 2, lastLotteriedDate: '2026-04-01' }),
        fullTime({ id: 'taylor', name: 'Taylor', fixedOrder: 1, lastLotteriedDate: null }),
        fullTime({ id: 'jordan', name: 'Jordan', fixedOrder: 3, lastLotteriedDate: null }),
        fullTime({ id: 'casey', name: 'Casey', fixedOrder: 4, lastLotteriedDate: '2026-02-10' }),
      ],
      requests: [],
    })

    expect(result.actions).toEqual([
      { therapistId: 'taylor', therapistName: 'Taylor', status: 'on_call' },
    ])
  })

  it('reduces PRN first when there are no volunteers and a PRN is scheduled', () => {
    const result = buildLotteryRecommendation({
      keepToWork: 3,
      scheduled: [
        prn({ id: 'prn-1', name: 'Robin' }),
        fullTime({ id: 'ashley', name: 'Ashley', fixedOrder: 1, lastLotteriedDate: '2026-04-01' }),
        fullTime({ id: 'taylor', name: 'Taylor', fixedOrder: 2, lastLotteriedDate: '2026-03-20' }),
        fullTime({ id: 'jordan', name: 'Jordan', fixedOrder: 3, lastLotteriedDate: null }),
      ],
      requests: [],
    })

    expect(result.actions).toEqual([
      { therapistId: 'prn-1', therapistName: 'Robin', status: 'on_call' },
    ])
    expect(result.prnInvolved).toBe(true)
  })

  it('uses PRN cancelled plus full-time on call when two reductions are needed with no volunteers', () => {
    const result = buildLotteryRecommendation({
      keepToWork: 3,
      scheduled: [
        prn({ id: 'prn-1', name: 'Robin' }),
        fullTime({ id: 'ashley', name: 'Ashley', fixedOrder: 1, lastLotteriedDate: '2026-04-01' }),
        fullTime({ id: 'taylor', name: 'Taylor', fixedOrder: 2, lastLotteriedDate: '2026-03-20' }),
        fullTime({ id: 'jordan', name: 'Jordan', fixedOrder: 3, lastLotteriedDate: null }),
        fullTime({ id: 'casey', name: 'Casey', fixedOrder: 4, lastLotteriedDate: '2026-02-10' }),
      ],
      requests: [],
    })

    expect(result.actions).toEqual([
      { therapistId: 'prn-1', therapistName: 'Robin', status: 'cancelled' },
      { therapistId: 'jordan', therapistName: 'Jordan', status: 'on_call' },
    ])
  })

  it('puts PRN ahead of the volunteer when a volunteer exists but two reductions are needed', () => {
    const result = buildLotteryRecommendation({
      keepToWork: 2,
      scheduled: [
        prn({ id: 'prn-1', name: 'Robin' }),
        fullTime({ id: 'ashley', name: 'Ashley', fixedOrder: 1, lastLotteriedDate: '2026-04-01' }),
        fullTime({ id: 'taylor', name: 'Taylor', fixedOrder: 2, lastLotteriedDate: '2026-03-20' }),
        fullTime({ id: 'jordan', name: 'Jordan', fixedOrder: 3, lastLotteriedDate: null }),
      ],
      requests: [request('ashley', '2026-04-21T08:00:00.000Z', 'Ashley')],
    })

    expect(result.actions).toEqual([
      { therapistId: 'prn-1', therapistName: 'Robin', status: 'cancelled' },
      { therapistId: 'ashley', therapistName: 'Ashley', status: 'on_call' },
    ])
  })

  it('returns no actions when keep-to-work matches the scheduled headcount', () => {
    const result = buildLotteryRecommendation({
      keepToWork: 2,
      scheduled: [
        fullTime({ id: 'ashley', name: 'Ashley', fixedOrder: 1 }),
        fullTime({ id: 'taylor', name: 'Taylor', fixedOrder: 2 }),
      ],
      requests: [],
    })

    expect(result.actions).toEqual([])
    expect(result.reductionsNeeded).toBe(0)
  })

  it('throws when keep-to-work is outside the valid range', () => {
    expect(() =>
      buildLotteryRecommendation({
        keepToWork: 5,
        scheduled: [
          fullTime({ id: 'ashley', name: 'Ashley', fixedOrder: 1 }),
          fullTime({ id: 'taylor', name: 'Taylor', fixedOrder: 2 }),
        ],
        requests: [],
      })
    ).toThrow(/keep-to-work/i)
  })
})
