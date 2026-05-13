import { describe, expect, it } from 'vitest'

import { buildShiftPostReviewRpcCall } from '@/lib/shift-board/review-classifier'

describe('buildShiftPostReviewRpcCall', () => {
  it('normalizes denied request RPC parameters', () => {
    const result = buildShiftPostReviewRpcCall({
      actorId: 'manager-1',
      requestId: 'post-1',
      decision: 'deny',
      selectedInterestId: 'interest-1',
      swapPartnerId: 'therapist-2',
      override: true,
      overrideReason: 'Not needed',
    })

    expect(result.rpcParams).toEqual({
      p_actor_id: 'manager-1',
      p_post_id: 'post-1',
      p_decision: 'deny',
      p_selected_interest_id: 'interest-1',
      p_swap_partner_id: 'therapist-2',
      p_manager_override: true,
      p_override_reason: 'Not needed',
    })
  })

  it('normalizes selected pickup interest approval parameters', () => {
    const result = buildShiftPostReviewRpcCall({
      actorId: 'manager-1',
      requestId: 'post-1',
      decision: 'approve',
      selectedInterestId: 'interest-2',
    })

    expect(result.rpcParams.p_selected_interest_id).toBe('interest-2')
    expect(result.rpcParams.p_swap_partner_id).toBe(null)
  })

  it('normalizes selected swap partner approval parameters', () => {
    const result = buildShiftPostReviewRpcCall({
      actorId: 'manager-1',
      requestId: 'post-1',
      decision: 'approve',
      swapPartnerId: 'therapist-2',
    })

    expect(result.rpcParams.p_selected_interest_id).toBe(null)
    expect(result.rpcParams.p_swap_partner_id).toBe('therapist-2')
  })

  it('normalizes direct accepted request parameters without optional IDs', () => {
    const result = buildShiftPostReviewRpcCall({
      actorId: 'manager-1',
      requestId: 'post-1',
      decision: 'approve',
      selectedInterestId: ' ',
      swapPartnerId: '',
      overrideReason: ' ',
    })

    expect(result.rpcParams.p_selected_interest_id).toBe(null)
    expect(result.rpcParams.p_swap_partner_id).toBe(null)
    expect(result.rpcParams.p_override_reason).toBe(null)
  })
})
