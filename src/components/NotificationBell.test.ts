import { describe, expect, it } from 'vitest'

import { resolveNotificationHref } from '@/components/NotificationBell'

describe('resolveNotificationHref', () => {
  it('routes therapist shift notifications to the therapist schedule page', () => {
    expect(
      resolveNotificationHref(
        {
          id: 'n1',
          event_type: 'shift_reminder',
          title: 'Shift reminder',
          message: 'You have a shift tomorrow.',
          target_type: 'shift',
          target_id: 'shift-1',
          created_at: '2026-04-24T12:00:00.000Z',
          read_at: null,
        },
        'therapist'
      )
    ).toBe('/therapist/schedule')
  })

  it('deep-links preliminary shift notifications to the affected shift', () => {
    expect(
      resolveNotificationHref(
        {
          id: 'n1b',
          event_type: 'preliminary_schedule_changed',
          title: 'Preliminary update',
          message: 'Your slot changed.',
          target_type: 'shift',
          target_id: 'shift-99',
          created_at: '2026-04-24T12:00:00.000Z',
          read_at: null,
        },
        'therapist'
      )
    ).toBe('/preliminary?shift=shift-99')
  })

  it('routes therapist request notifications to the therapist swaps page', () => {
    expect(
      resolveNotificationHref(
        {
          id: 'n2',
          event_type: 'shift_post_claimed',
          title: 'Request update',
          message: 'Your post has activity.',
          target_type: 'shift_post',
          target_id: 'post-1',
          created_at: '2026-04-24T12:00:00.000Z',
          read_at: null,
        },
        'lead'
      )
    ).toBe('/therapist/swaps')
  })

  it('routes call-in help alerts to the therapist swaps workflow', () => {
    expect(
      resolveNotificationHref(
        {
          id: 'n2b',
          event_type: 'call_in_help_available',
          title: 'Call-in help needed',
          message: 'A published shift needs coverage.',
          target_type: 'shift',
          target_id: 'shift-2',
          created_at: '2026-04-24T12:00:00.000Z',
          read_at: null,
        },
        'therapist'
      )
    ).toBe('/therapist/swaps')
  })

  it('keeps manager notifications on manager workflow routes', () => {
    expect(
      resolveNotificationHref(
        {
          id: 'n3',
          event_type: 'preliminary_request_submitted',
          title: 'Preliminary request',
          message: 'A therapist responded.',
          target_type: 'shift_post',
          target_id: 'post-2',
          created_at: '2026-04-24T12:00:00.000Z',
          read_at: null,
        },
        'manager'
      )
    ).toBe('/approvals')
  })
})
