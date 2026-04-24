import { describe, expect, it } from 'vitest'

import { buildCallInAlertMessage, shouldCreateCallInAlert } from '@/lib/call-in-alerts'

describe('call-in alerts', () => {
  it('only creates an alert when a published shift is marked call_in', () => {
    expect(shouldCreateCallInAlert({ published: true, nextStatus: 'call_in' })).toBe(true)
    expect(shouldCreateCallInAlert({ published: false, nextStatus: 'call_in' })).toBe(false)
    expect(shouldCreateCallInAlert({ published: true, nextStatus: 'cancelled' })).toBe(false)
  })

  it('builds a team-facing call-in help message', () => {
    expect(buildCallInAlertMessage({ date: '2026-05-01', shiftType: 'night' })).toContain(
      'Call-in help needed'
    )
    expect(buildCallInAlertMessage({ date: '2026-05-01', shiftType: 'night' })).toContain('Night')
  })
})
