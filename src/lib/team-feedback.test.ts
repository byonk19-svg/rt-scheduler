import { describe, expect, it } from 'vitest'

import { getTeamFeedbackMessage, isTeamErrorCode, isTeamSuccessCode } from '@/lib/team-feedback'

describe('team feedback contract', () => {
  it('validates known success and error codes', () => {
    expect(isTeamSuccessCode('bulk_updated')).toBe(true)
    expect(isTeamSuccessCode('quota_exceeded')).toBe(false)
    expect(isTeamErrorCode('bulk_invalid_action')).toBe(true)
    expect(isTeamErrorCode('quota_exceeded')).toBe(false)
  })

  it('formats count-bearing team feedback from typed codes', () => {
    expect(getTeamFeedbackMessage({ success: 'bulk_updated', bulk_count: '3' })).toEqual({
      message: 'Bulk team update saved. (3 people)',
      variant: 'success',
    })
    expect(getTeamFeedbackMessage({ error: 'roster_bulk_invalid', bulk_line: '4' })).toEqual({
      message: 'Bulk import failed on line 4. Check name and column format.',
      variant: 'error',
    })
  })
})
