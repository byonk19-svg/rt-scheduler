import { describe, expect, it } from 'vitest'

import { MANAGER_WORKFLOW_LINKS } from '@/lib/workflow-links'

describe('MANAGER_WORKFLOW_LINKS', () => {
  it('routes publish to Coverage', () => {
    expect(MANAGER_WORKFLOW_LINKS.publish).toBe('/coverage?view=week')
  })

  it('exports the canonical lottery workflow destination', () => {
    expect(MANAGER_WORKFLOW_LINKS.lottery).toBe('/lottery')
  })
})
