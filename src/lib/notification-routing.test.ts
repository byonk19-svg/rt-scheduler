import { describe, expect, it } from 'vitest'

import { resolveNotificationHref } from '@/lib/notification-routing'

describe('resolveNotificationHref', () => {
  it('keeps manager and staff request notifications on their owned workflow routes', () => {
    const item = {
      event_type: 'direct_request_approved',
      target_type: 'shift_post' as const,
      target_id: 'post-1',
    }

    expect(resolveNotificationHref(item, 'manager')).toBe('/shift-board?tab=history')
    expect(resolveNotificationHref(item, 'therapist')).toBe('/therapist/swaps?requestId=post-1')
    expect(resolveNotificationHref(item, 'lead')).toBe('/therapist/swaps?requestId=post-1')
  })

  it('keeps active request notifications out of history routes', () => {
    expect(
      resolveNotificationHref(
        {
          event_type: 'direct_request_accepted',
          target_type: 'shift_post',
          target_id: 'post-2',
        },
        'manager'
      )
    ).toBe('/shift-board')

    expect(
      resolveNotificationHref(
        {
          event_type: 'direct_request_received',
          target_type: 'shift_post',
          target_id: 'post-3',
        },
        'therapist'
      )
    ).toBe('/therapist/swaps?requestId=post-3')
  })

  it('routes call-in alerts to open coverage request surfaces', () => {
    const item = {
      event_type: 'call_in_help_available',
      target_type: 'shift' as const,
      target_id: 'shift-1',
    }

    expect(resolveNotificationHref(item, 'manager')).toBe('/shift-board?tab=open-shifts')
    expect(resolveNotificationHref(item, 'therapist')).toBe('/therapist/swaps')
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
