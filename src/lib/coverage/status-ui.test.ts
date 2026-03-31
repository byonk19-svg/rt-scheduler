import { describe, expect, it } from 'vitest'

import {
  COVERAGE_STATUS_OPTIONS,
  coverageStatusPillSurfaceClass,
  getCoverageStatusLabel,
  toCoverageAssignmentPayload,
  toCoverageUiStatus,
} from '@/lib/coverage/status-ui'

describe('coverage status ui', () => {
  it('includes a Call In option separate from Cancelled', () => {
    expect(COVERAGE_STATUS_OPTIONS.map((option) => option.value)).toContain('call_in')
    expect(getCoverageStatusLabel('call_in')).toBe('Call In')
  })

  it('maps call_in to assignment_status call_in and called_off shift status', () => {
    expect(toCoverageAssignmentPayload('call_in')).toEqual({
      assignment_status: 'call_in',
      status: 'called_off',
    })
  })

  it('maps assignment_status call_in to ui status call_in', () => {
    expect(toCoverageUiStatus('call_in', 'scheduled')).toBe('call_in')
  })

  it('exposes pill surface classes for non-active coverage states', () => {
    expect(coverageStatusPillSurfaceClass('active')).toBe('')
    expect(coverageStatusPillSurfaceClass('oncall')).toContain('info-border')
  })
})
