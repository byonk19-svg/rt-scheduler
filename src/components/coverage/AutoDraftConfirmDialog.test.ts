import { describe, expect, it } from 'vitest'

import { shouldAllowSubmit } from './AutoDraftConfirmDialog'

describe('AutoDraftConfirmDialog guard logic', () => {
  it('allows submit when cycleId present and not published', () => {
    expect(shouldAllowSubmit('cycle-abc', false)).toBe(true)
  })

  it('blocks submit when no cycleId', () => {
    expect(shouldAllowSubmit('', false)).toBe(false)
  })

  it('blocks submit when cycle is published', () => {
    expect(shouldAllowSubmit('cycle-abc', true)).toBe(false)
  })
})
