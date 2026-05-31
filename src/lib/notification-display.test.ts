import { describe, expect, it } from 'vitest'

import { getNotificationDisplayCopy } from '@/lib/notification-display'

describe('getNotificationDisplayCopy', () => {
  it('has display copy for every currently allowed notification event', () => {
    const allowedEvents = [
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
    ]

    for (const eventType of allowedEvents) {
      expect(
        getNotificationDisplayCopy(
          {
            event_type: eventType,
            title: `Raw ${eventType}`,
            message: 'Event details.',
          },
          'manager'
        ).title
      ).not.toBe(`Raw ${eventType}`)
    }
  })

  it('uses manager-facing coverage or trade copy for new request notifications', () => {
    expect(
      getNotificationDisplayCopy(
        {
          event_type: 'new_request',
          title: 'New swap request',
          message: 'A staff member posted a new swap request.',
        },
        'manager'
      )
    ).toEqual({
      title: 'New coverage or trade request',
      message: 'A staff member posted a request that needs manager review.',
    })
  })

  it('uses trade language for teammate swap notifications', () => {
    expect(
      getNotificationDisplayCopy({
        event_type: 'swap_request_received',
        title: 'Someone wants to swap with you',
        message: 'You have been tagged in a swap request. Check it out.',
      })
    ).toEqual({
      title: 'Trade request received',
      message: 'A teammate asked to trade shifts with you. Review the request.',
    })
  })

  it('keeps direct request lifecycle states explicit for therapists', () => {
    expect(
      getNotificationDisplayCopy(
        {
          event_type: 'direct_request_accepted',
          title: 'Direct request accepted',
          message: 'Your direct request was accepted and is waiting for manager approval.',
        },
        'therapist'
      )
    ).toEqual({
      title: 'Direct request accepted',
      message: 'Your teammate accepted the request. It still needs manager approval.',
    })
  })

  it('uses manager review language for accepted direct requests', () => {
    expect(
      getNotificationDisplayCopy(
        {
          event_type: 'direct_request_accepted',
          title: 'Direct request accepted',
          message: 'A direct request was accepted and is ready for manager review.',
        },
        'manager'
      )
    ).toEqual({
      title: 'Direct request ready for review',
      message: 'A teammate accepted a direct request. Review it for manager approval.',
    })
  })

  it('removes old swap approval wording from team request outcomes', () => {
    expect(
      getNotificationDisplayCopy({
        event_type: 'request_denied',
        title: 'Swap request denied',
        message: 'Your swap request was not approved. You can post a new one.',
      })
    ).toEqual({
      title: 'Request denied by manager',
      message: 'The manager denied this coverage or trade request.',
    })
  })

  it('normalizes old cycle-published rows to Schedule Block copy', () => {
    expect(
      getNotificationDisplayCopy({
        event_type: 'cycle_published',
        title: 'Cycle published',
        message: 'May block is now published.',
      })
    ).toEqual({
      title: 'Schedule Block published',
      message: 'May block is now published.',
    })
  })

  it('normalizes schedule lifecycle event titles while preserving specific shift details', () => {
    expect(
      getNotificationDisplayCopy({
        event_type: 'preliminary_sent',
        title: 'Preliminary schedule sent',
        message: 'May 3 - Jun 13 is ready to review in the preliminary schedule.',
      })
    ).toEqual({
      title: 'Preliminary schedule ready',
      message: 'May 3 - Jun 13 is ready to review in the preliminary schedule.',
    })

    expect(
      getNotificationDisplayCopy({
        event_type: 'preliminary_refreshed',
        title: 'Preliminary schedule refreshed',
        message: 'May 3 - Jun 13 is ready to review in the preliminary schedule.',
      })
    ).toEqual({
      title: 'Preliminary schedule refreshed',
      message: 'May 3 - Jun 13 is ready to review in the preliminary schedule.',
    })

    expect(
      getNotificationDisplayCopy({
        event_type: 'preliminary_schedule_changed',
        title: 'Preliminary schedule updated',
        message: 'Your preliminary schedule changed: you were added to a day shift on May 4.',
      })
    ).toEqual({
      title: 'Preliminary schedule changed',
      message: 'Your preliminary schedule changed: you were added to a day shift on May 4.',
    })

    expect(
      getNotificationDisplayCopy({
        event_type: 'published_schedule_changed',
        title: 'Published schedule updated',
        message: 'Your published schedule changed: your night shift on May 7 was removed.',
      })
    ).toEqual({
      title: 'Published schedule changed',
      message: 'Your published schedule changed: your night shift on May 7 was removed.',
    })
  })

  it('uses manager-facing preliminary request lifecycle copy', () => {
    expect(
      getNotificationDisplayCopy(
        {
          event_type: 'preliminary_request_submitted',
          title: 'Preliminary request submitted',
          message: 'A therapist sent a preliminary schedule request.',
        },
        'manager'
      )
    ).toEqual({
      title: 'Preliminary request submitted',
      message: 'A therapist sent a preliminary schedule request.',
    })

    expect(
      getNotificationDisplayCopy({
        event_type: 'preliminary_request_denied',
        title: 'Request denied',
        message: 'Your preliminary request was denied.',
      })
    ).toEqual({
      title: 'Preliminary request denied',
      message: 'Your preliminary request was denied.',
    })
  })

  it('normalizes availability and operational attention titles without hiding action details', () => {
    expect(
      getNotificationDisplayCopy({
        event_type: 'availability_ready',
        title: 'Availability is ready',
        message: 'May 3 - Jun 13 is ready for availability. Please submit by Apr 20.',
      })
    ).toEqual({
      title: 'Availability ready',
      message: 'May 3 - Jun 13 is ready for availability. Please submit by Apr 20.',
    })

    expect(
      getNotificationDisplayCopy({
        event_type: 'availability_due_date_changed',
        title: 'Availability due date changed',
        message: 'May 3 - Jun 13 availability is now due Apr 22.',
      })
    ).toEqual({
      title: 'Availability due date changed',
      message: 'May 3 - Jun 13 availability is now due Apr 22.',
    })

    expect(
      getNotificationDisplayCopy({
        event_type: 'operational_status_attention',
        title: 'Call-in coverage attention',
        message: 'Call-in help is needed for the night shift on May 6.',
      })
    ).toEqual({
      title: 'Coverage attention needed',
      message: 'Call-in help is needed for the night shift on May 6.',
    })
  })

  it('normalizes shift reminder titles without replacing the reminder detail', () => {
    expect(
      getNotificationDisplayCopy({
        event_type: 'shift_reminder',
        title: 'Shift reminder',
        message: 'You are scheduled tomorrow at 7:00 AM.',
      })
    ).toEqual({
      title: 'Upcoming shift reminder',
      message: 'You are scheduled tomorrow at 7:00 AM.',
    })
  })

  it('preserves unknown notification copy', () => {
    expect(
      getNotificationDisplayCopy({
        event_type: 'unknown_event',
        title: 'Custom alert',
        message: 'Custom message.',
      })
    ).toEqual({
      title: 'Custom alert',
      message: 'Custom message.',
    })
  })
})
