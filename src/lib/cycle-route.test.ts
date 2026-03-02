import { describe, expect, it } from 'vitest'

import { buildCycleRoute } from '@/lib/cycle-route'

describe('buildCycleRoute', () => {
  it('builds a schedule route with view and cycle params', () => {
    expect(buildCycleRoute('/schedule', 'cycle-123')).toBe('/schedule?view=week&cycle=cycle-123')
  })

  it('builds a coverage route with default week view when no cycle is provided', () => {
    expect(buildCycleRoute('/coverage', null)).toBe('/coverage?view=week')
  })
})
