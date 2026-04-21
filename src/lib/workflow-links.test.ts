import { describe, expect, it } from 'vitest'

import { MANAGER_WORKFLOW_LINKS } from '@/lib/workflow-links'

describe('MANAGER_WORKFLOW_LINKS', () => {
  it('exposes a canonical manager schedule home route', () => {
    expect(MANAGER_WORKFLOW_LINKS.scheduleHome).toBe('/dashboard/manager/schedule')
  })

  it('routes publish to the finalization surface', () => {
    expect(MANAGER_WORKFLOW_LINKS.publish).toBe('/publish')
  })

  it('exposes delivery history as a separate manager workflow link', () => {
    expect(MANAGER_WORKFLOW_LINKS.publishHistory).toBe('/publish/history')
  })
})
