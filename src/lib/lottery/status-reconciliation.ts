import type { AssignmentStatus } from '@/lib/shift-types'

export type LotteryStatusReconciliation = {
  invalidatePreviousHistory: boolean
  createHistoryEntry: boolean
  suppressActiveRequest: boolean
  restoreSuppressedRequest: boolean
}

type DeriveLotteryStatusReconciliationArgs = {
  previousStatus: AssignmentStatus
  nextStatus: AssignmentStatus
  hasActiveRequest: boolean
  hasSuppressedStatusRequest: boolean
}

export function isLotteryAffectingStatus(status: AssignmentStatus): boolean {
  return status === 'on_call' || status === 'cancelled'
}

export function deriveLotteryStatusReconciliation({
  previousStatus,
  nextStatus,
  hasActiveRequest,
  hasSuppressedStatusRequest,
}: DeriveLotteryStatusReconciliationArgs): LotteryStatusReconciliation {
  const previousAffectsLottery = isLotteryAffectingStatus(previousStatus)
  const nextAffectsLottery = isLotteryAffectingStatus(nextStatus)

  return {
    invalidatePreviousHistory: previousAffectsLottery && previousStatus !== nextStatus,
    createHistoryEntry: nextAffectsLottery && previousStatus !== nextStatus,
    suppressActiveRequest: nextAffectsLottery && hasActiveRequest,
    restoreSuppressedRequest:
      previousAffectsLottery && !nextAffectsLottery && hasSuppressedStatusRequest,
  }
}
