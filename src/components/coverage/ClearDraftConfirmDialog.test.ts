import { describe, expect, it } from 'vitest'

import { canClearDraft } from './ClearDraftConfirmDialog'

describe('ClearDraftConfirmDialog guard logic', () => {
  it('allows reset when cycleId is present and cycle is draft', () => {
    expect(canClearDraft('cycle-1', false)).toBe(true)
  })

  it('blocks reset when no cycleId is present', () => {
    expect(canClearDraft('', false)).toBe(false)
  })

  it('blocks reset for published cycles', () => {
    expect(canClearDraft('cycle-1', true)).toBe(false)
  })
})
