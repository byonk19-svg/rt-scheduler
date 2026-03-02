import { describe, expect, it } from 'vitest'

import { getManagerAttentionLinks } from '@/lib/manager-workflow'

describe('getManagerAttentionLinks', () => {
  it('uses schedule publish route when no active cycle exists', () => {
    expect(getManagerAttentionLinks(null).publish).toBe('/schedule?view=week')
  })

  it('includes cycle param in publish route when active cycle exists', () => {
    expect(getManagerAttentionLinks('cycle-abc').publish).toBe(
      '/schedule?cycle=cycle-abc&view=week'
    )
  })
})
