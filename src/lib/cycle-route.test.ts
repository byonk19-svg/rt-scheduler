import { describe, expect, it } from 'vitest'

import { buildCycleRoute } from '@/lib/cycle-route'

describe('buildCycleRoute', () => {
  it('builds a schedule route with cycle params', () => {
    expect(buildCycleRoute('/schedule', 'cycle-123')).toBe('/schedule?cycle=cycle-123')
  })

  it('builds the schedule route when no cycle is provided', () => {
    expect(buildCycleRoute('/schedule', null)).toBe('/schedule')
  })
})
