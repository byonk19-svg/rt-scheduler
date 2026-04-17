import { describe, expect, it } from 'vitest'

import * as TeamWorkspaceModule from '@/components/team/team-workspace'

describe('team-workspace module exports', () => {
  it('provides a default TeamWorkspace export', () => {
    expect(typeof TeamWorkspaceModule.default).toBe('function')
  })
})
