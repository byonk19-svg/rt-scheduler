import { describe, expect, it } from 'vitest'

import { MANAGER_WORKFLOW_LINKS } from '@/lib/workflow-links'

describe('MANAGER_WORKFLOW_LINKS', () => {
  it('routes publish to the schedule workspace', () => {
    expect(MANAGER_WORKFLOW_LINKS.publish).toBe('/schedule?view=week')
  })
})
