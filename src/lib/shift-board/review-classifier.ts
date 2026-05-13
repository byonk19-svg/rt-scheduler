export type ShiftPostReviewDecision = 'approve' | 'deny'

export type ShiftPostReviewInput = {
  actorId: string
  requestId: string
  decision: ShiftPostReviewDecision
  selectedInterestId?: string | null
  swapPartnerId?: string | null
  override?: boolean
  overrideReason?: string | null
}

export type ShiftPostReviewClassification = {
  rpcName: 'app_review_shift_post'
  rpcParams: {
    p_actor_id: string
    p_post_id: string
    p_decision: ShiftPostReviewDecision
    p_selected_interest_id: string | null
    p_swap_partner_id: string | null
    p_manager_override: boolean
    p_override_reason: string | null
  }
}

function normalizeOptionalId(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : null
}

export function buildShiftPostReviewRpcCall(
  input: ShiftPostReviewInput
): ShiftPostReviewClassification {
  const selectedInterestId = normalizeOptionalId(input.selectedInterestId)
  const swapPartnerId = normalizeOptionalId(input.swapPartnerId)
  const overrideReason = normalizeOptionalId(input.overrideReason)

  return {
    rpcName: 'app_review_shift_post',
    rpcParams: {
      p_actor_id: input.actorId,
      p_post_id: input.requestId,
      p_decision: input.decision,
      p_selected_interest_id: selectedInterestId,
      p_swap_partner_id: swapPartnerId,
      p_manager_override: input.override === true,
      p_override_reason: overrideReason,
    },
  }
}
