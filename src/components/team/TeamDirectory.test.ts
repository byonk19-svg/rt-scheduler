import { describe, expect, it } from 'vitest'

import { TEAM_LEAD_ROLE_LABEL, TEAM_QUICK_EDIT_DIALOG_CLASS } from '@/components/team/TeamDirectory'

describe('TEAM_QUICK_EDIT_DIALOG_CLASS', () => {
  it('keeps the quick edit modal scrollable within the viewport', () => {
    expect(TEAM_QUICK_EDIT_DIALOG_CLASS).toContain('max-h-[calc(100vh-2rem)]')
    expect(TEAM_QUICK_EDIT_DIALOG_CLASS).toContain('overflow-y-auto')
  })

  it('uses the lead therapist label on the team surface', () => {
    expect(TEAM_LEAD_ROLE_LABEL).toBe('Lead Therapist')
  })
})
