export type NotificationDisplayRole = 'manager' | 'therapist' | 'lead' | null

export type NotificationDisplayItem = {
  event_type: string
  title?: string | null
  message?: string | null
}

export type NotificationDisplayCopy = {
  title: string
  message: string
}

type RoleSpecificNotificationDisplayCopy = Partial<
  Record<Exclude<NotificationDisplayRole, null>, NotificationDisplayCopy>
>

type NotificationDisplayRule = NotificationDisplayCopy | RoleSpecificNotificationDisplayCopy

const REQUEST_COPY_BY_EVENT: Record<string, NotificationDisplayRule> = {
  new_request: {
    title: 'New coverage or trade request',
    message: 'A staff member posted a request that needs manager review.',
  },
  swap_request_received: {
    title: 'Trade request received',
    message: 'A teammate asked to trade shifts with you. Review the request.',
  },
  direct_request_received: {
    title: 'Direct request received',
    message: 'A teammate sent you a direct request. Review it before manager approval.',
  },
  direct_request_accepted: {
    manager: {
      title: 'Direct request ready for review',
      message: 'A teammate accepted a direct request. Review it for manager approval.',
    },
    therapist: {
      title: 'Direct request accepted',
      message: 'Your teammate accepted the request. It still needs manager approval.',
    },
    lead: {
      title: 'Direct request accepted',
      message: 'Your teammate accepted the request. It still needs manager approval.',
    },
  },
  direct_request_declined: {
    manager: {
      title: 'Direct request declined',
      message: 'A teammate declined a direct request before manager review.',
    },
    therapist: {
      title: 'Direct request declined',
      message: 'Your teammate declined the request.',
    },
    lead: {
      title: 'Direct request declined',
      message: 'Your teammate declined the request.',
    },
  },
  direct_request_withdrawn: {
    manager: {
      title: 'Direct request withdrawn',
      message: 'The requester withdrew the direct request before manager approval.',
    },
    therapist: {
      title: 'Direct request withdrawn',
      message: 'The requester withdrew the direct request before manager approval.',
    },
    lead: {
      title: 'Direct request withdrawn',
      message: 'The requester withdrew the direct request before manager approval.',
    },
  },
  direct_request_approved: {
    title: 'Direct request approved by manager',
    message: 'The manager approved this direct request.',
  },
  direct_request_denied: {
    title: 'Direct request denied by manager',
    message: 'The manager denied this direct request.',
  },
  request_approved: {
    title: 'Request approved by manager',
    message: 'The manager approved this coverage or trade request.',
  },
  request_denied: {
    title: 'Request denied by manager',
    message: 'The manager denied this coverage or trade request.',
  },
  shift_post_claimed: {
    title: 'Coverage request has a responder',
    message: 'A teammate volunteered to cover this shift. Review the request.',
  },
  call_in_help_available: {
    title: 'Open coverage request available',
    message: 'A published shift needs coverage.',
  },
}

function getFallbackTitle(item: NotificationDisplayItem): string {
  return item.title?.trim() || 'Notification'
}

function getFallbackMessage(item: NotificationDisplayItem): string {
  return item.message?.trim() || ''
}

function isNotificationDisplayCopy(rule: NotificationDisplayRule): rule is NotificationDisplayCopy {
  return 'title' in rule
}

function resolveRequestCopy(
  item: NotificationDisplayItem,
  role: NotificationDisplayRole
): NotificationDisplayCopy | null {
  const eventCopy = REQUEST_COPY_BY_EVENT[item.event_type]
  if (!eventCopy) return null
  if (isNotificationDisplayCopy(eventCopy)) return eventCopy
  if (role && eventCopy[role]) return eventCopy[role]
  return eventCopy.manager ?? eventCopy.therapist ?? eventCopy.lead ?? null
}

export function getNotificationDisplayCopy(
  item: NotificationDisplayItem,
  role: NotificationDisplayRole = null
): NotificationDisplayCopy {
  const requestCopy = resolveRequestCopy(item, role)
  if (requestCopy) return requestCopy

  if (item.event_type === 'cycle_published') {
    return {
      title: 'Schedule Block published',
      message: getFallbackMessage(item),
    }
  }

  return {
    title: getFallbackTitle(item),
    message: getFallbackMessage(item),
  }
}
