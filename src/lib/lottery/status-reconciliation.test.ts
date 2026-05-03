import { describe, expect, it } from 'vitest'

import {
  deriveLotteryStatusReconciliation,
  isLotteryAffectingStatus,
} from '@/lib/lottery/status-reconciliation'

describe('isLotteryAffectingStatus', () => {
  it('only treats on-call and cancelled as lottery-affecting', () => {
    expect(isLotteryAffectingStatus('scheduled')).toBe(false)
    expect(isLotteryAffectingStatus('call_in')).toBe(false)
    expect(isLotteryAffectingStatus('left_early')).toBe(false)
    expect(isLotteryAffectingStatus('on_call')).toBe(true)
    expect(isLotteryAffectingStatus('cancelled')).toBe(true)
  })
})

describe('deriveLotteryStatusReconciliation', () => {
  it('suppresses an active request and records a history entry when a counted status is applied', () => {
    const result = deriveLotteryStatusReconciliation({
      previousStatus: 'scheduled',
      nextStatus: 'cancelled',
      hasActiveRequest: true,
      hasSuppressedStatusRequest: false,
    })

    expect(result.invalidatePreviousHistory).toBe(false)
    expect(result.createHistoryEntry).toBe(true)
    expect(result.suppressActiveRequest).toBe(true)
    expect(result.restoreSuppressedRequest).toBe(false)
  })

  it('restores a previously suppressed request when a counted status is undone', () => {
    const result = deriveLotteryStatusReconciliation({
      previousStatus: 'on_call',
      nextStatus: 'scheduled',
      hasActiveRequest: false,
      hasSuppressedStatusRequest: true,
    })

    expect(result.invalidatePreviousHistory).toBe(true)
    expect(result.createHistoryEntry).toBe(false)
    expect(result.suppressActiveRequest).toBe(false)
    expect(result.restoreSuppressedRequest).toBe(true)
  })

  it('invalidates the previous counted history and creates a new entry when switching between counted statuses', () => {
    const result = deriveLotteryStatusReconciliation({
      previousStatus: 'cancelled',
      nextStatus: 'on_call',
      hasActiveRequest: false,
      hasSuppressedStatusRequest: false,
    })

    expect(result.invalidatePreviousHistory).toBe(true)
    expect(result.createHistoryEntry).toBe(true)
    expect(result.restoreSuppressedRequest).toBe(false)
  })

  it('does not restore anything when a counted status is changed to another non-counting status', () => {
    const result = deriveLotteryStatusReconciliation({
      previousStatus: 'cancelled',
      nextStatus: 'call_in',
      hasActiveRequest: false,
      hasSuppressedStatusRequest: false,
    })

    expect(result.invalidatePreviousHistory).toBe(true)
    expect(result.createHistoryEntry).toBe(false)
    expect(result.restoreSuppressedRequest).toBe(false)
  })
})
