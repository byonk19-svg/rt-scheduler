import { describe, expect, it } from 'vitest'

import { getManagerAttentionLinks } from '@/lib/manager-workflow'

describe('getManagerAttentionLinks', () => {
  it('uses coverage publish route when no active cycle exists', () => {
    expect(getManagerAttentionLinks(null).publish).toBe('/coverage?view=week')
  })

  it('includes cycle param in coverage publish route when active cycle exists', () => {
    expect(getManagerAttentionLinks('cycle-abc').publish).toBe(
      '/coverage?cycle=cycle-abc&view=week'
    )
  })
})
