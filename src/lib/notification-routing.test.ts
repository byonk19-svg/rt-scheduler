import { describe, expect, it } from 'vitest'

import { resolveNotificationHref } from '@/lib/notification-routing'

describe('resolveNotificationHref', () => {
  it('keeps manager and staff request notifications on their owned workflow routes', () => {
    const item = {
      event_type: 'direct_request_approved',
      target_type: 'shift_post' as const,
      target_id: 'post-1',
    }

    expect(resolveNotificationHref(item, 'manager')).toBe('/requests')
    expect(resolveNotificationHref(item, 'therapist')).toBe('/therapist/swaps')
    expect(resolveNotificationHref(item, 'lead')).toBe('/therapist/swaps')
  })

  it('deep-links preliminary shift notifications when a shift target is present', () => {
    expect(
      resolveNotificationHref(
        {
          event_type: 'preliminary_schedule_changed',
          target_type: 'shift',
          target_id: 'shift-99',
        },
        'manager'
      )
    ).toBe('/preliminary?shift=shift-99')
  })

  it('uses the caller fallback for unrecognized notification events', () => {
    const item = {
      event_type: 'unknown_event',
      target_type: 'system' as const,
      target_id: null,
    }

    expect(resolveNotificationHref(item, 'manager', '/schedule')).toBe('/schedule')
    expect(resolveNotificationHref(item, 'manager')).toBeNull()
  })
})
