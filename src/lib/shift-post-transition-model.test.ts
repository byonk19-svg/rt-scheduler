import { describe, expect, it } from 'vitest'

import {
  SHIFT_POST_COMMAND_MODEL,
  isShiftPostCommand,
  shiftPostCommandRequiresManager,
} from '@/lib/shift-post-transition-model'

describe('shift post transition model', () => {
  it('recognizes the supported command set', () => {
    expect(Object.keys(SHIFT_POST_COMMAND_MODEL).sort()).toEqual([
      'create_request',
      'deny_claimant',
      'express_interest',
      'respond_direct_request',
      'review_request',
      'withdraw_interest',
      'withdraw_request',
    ])
    expect(isShiftPostCommand('review_request')).toBe(true)
    expect(isShiftPostCommand('unknown_action')).toBe(false)
  })

  it('keeps manager-only commands explicit', () => {
    expect(shiftPostCommandRequiresManager('review_request')).toBe(true)
    expect(shiftPostCommandRequiresManager('deny_claimant')).toBe(true)
    expect(shiftPostCommandRequiresManager('create_request')).toBe(false)
    expect(shiftPostCommandRequiresManager('express_interest')).toBe(false)
  })
})
