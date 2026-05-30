import { describe, expect, it } from 'vitest'

import { getNotificationDisplayCopy } from '@/lib/notification-display'

describe('getNotificationDisplayCopy', () => {
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
