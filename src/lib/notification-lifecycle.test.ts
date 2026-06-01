import { describe, expect, it } from 'vitest'

import {
  NOTIFICATION_LIFECYCLE_MATRIX,
  getNotificationLifecyclePolicy,
  getRequestNotificationBaseHref,
  isTerminalRequestNotification,
} from '@/lib/notification-lifecycle'

const ALLOWED_NOTIFICATION_EVENTS = [
  'new_request',
  'request_approved',
  'request_denied',
  'swap_request_received',
  'direct_request_received',
  'direct_request_accepted',
  'direct_request_declined',
  'direct_request_withdrawn',
  'direct_request_approved',
  'direct_request_denied',
  'shift_post_claimed',
  'call_in_help_available',
  'operational_status_attention',
  'cycle_published',
  'published_schedule_changed',
  'preliminary_sent',
  'preliminary_refreshed',
  'preliminary_request_submitted',
  'preliminary_request_approved',
  'preliminary_request_denied',
  'preliminary_schedule_changed',
  'availability_ready',
  'availability_due_date_changed',
  'shift_reminder',
] as const

describe('notification lifecycle matrix', () => {
  it('defines policy for every allowed notification event', () => {
    for (const eventType of ALLOWED_NOTIFICATION_EVENTS) {
      expect(getNotificationLifecyclePolicy(eventType), eventType).not.toBeNull()
    }
  })

  it('separates active request work from terminal request history', () => {
    expect(NOTIFICATION_LIFECYCLE_MATRIX.direct_request_received.state).toBe('actionable')
    expect(NOTIFICATION_LIFECYCLE_MATRIX.direct_request_accepted.state).toBe('actionable')
    expect(NOTIFICATION_LIFECYCLE_MATRIX.shift_post_claimed.state).toBe('actionable')

    for (const eventType of [
      'request_approved',
      'request_denied',
      'direct_request_declined',
      'direct_request_withdrawn',
      'direct_request_approved',
      'direct_request_denied',
    ]) {
      expect(isTerminalRequestNotification(eventType), eventType).toBe(true)
      expect(getNotificationLifecyclePolicy(eventType)?.actionExpectation).toBe(
        'No further action is expected from this notification.'
      )
    }
  })

  it('routes manager request notifications to active or history surfaces by lifecycle', () => {
    expect(getRequestNotificationBaseHref('direct_request_accepted', 'manager')).toBe(
      '/shift-board'
    )
    expect(getRequestNotificationBaseHref('direct_request_denied', 'manager')).toBe(
      '/shift-board?tab=history'
    )
    expect(getRequestNotificationBaseHref('request_approved', 'therapist')).toBe('/therapist/swaps')
  })
})
