import type { NotificationDisplayRole } from '@/lib/notification-display'

export type NotificationLifecycleState = 'actionable' | 'terminal' | 'informational'

export type NotificationWorkflow = 'requests' | 'schedule' | 'preliminary' | 'availability'

export type NotificationLifecyclePolicy = {
  state: NotificationLifecycleState
  workflow: NotificationWorkflow
  routePolicy: string
  visibility: string
  actionExpectation: string
}

const REQUEST_TERMINAL_EVENTS = [
  'request_approved',
  'request_denied',
  'direct_request_declined',
  'direct_request_withdrawn',
  'direct_request_approved',
  'direct_request_denied',
] as const

export const NOTIFICATION_LIFECYCLE_MATRIX = {
  new_request: {
    state: 'actionable',
    workflow: 'requests',
    routePolicy: 'Managers review the request on Shift Board.',
    visibility: 'Manager-facing request queue.',
    actionExpectation: 'Manager decision may still be required.',
  },
  shift_post_claimed: {
    state: 'actionable',
    workflow: 'requests',
    routePolicy: 'Managers review responder activity on Shift Board.',
    visibility: 'Manager-facing request queue.',
    actionExpectation: 'Manager decision may still be required.',
  },
  direct_request_received: {
    state: 'actionable',
    workflow: 'requests',
    routePolicy: 'Recipient reviews the direct request in Trade & Coverage Requests.',
    visibility: 'Recipient request workspace.',
    actionExpectation: 'Recipient accept or decline may still be required.',
  },
  swap_request_received: {
    state: 'actionable',
    workflow: 'requests',
    routePolicy: 'Recipient reviews the trade request in Trade & Coverage Requests.',
    visibility: 'Recipient request workspace.',
    actionExpectation: 'Recipient accept or decline may still be required.',
  },
  direct_request_accepted: {
    state: 'actionable',
    workflow: 'requests',
    routePolicy: 'Managers review accepted direct requests on Shift Board.',
    visibility: 'Manager queue and participant request history.',
    actionExpectation: 'Manager decision may still be required.',
  },
  call_in_help_available: {
    state: 'actionable',
    workflow: 'requests',
    routePolicy: 'Managers and staff review open coverage requests in their request workspace.',
    visibility: 'Request workspaces.',
    actionExpectation: 'Coverage response may still be required.',
  },
  request_approved: {
    state: 'terminal',
    workflow: 'requests',
    routePolicy: 'Closed request notifications route to request history.',
    visibility: 'Request history.',
    actionExpectation: 'No further action is expected from this notification.',
  },
  request_denied: {
    state: 'terminal',
    workflow: 'requests',
    routePolicy: 'Closed request notifications route to request history.',
    visibility: 'Request history.',
    actionExpectation: 'No further action is expected from this notification.',
  },
  direct_request_declined: {
    state: 'terminal',
    workflow: 'requests',
    routePolicy: 'Closed direct-request notifications route to request history.',
    visibility: 'Participant request history.',
    actionExpectation: 'No further action is expected from this notification.',
  },
  direct_request_withdrawn: {
    state: 'terminal',
    workflow: 'requests',
    routePolicy: 'Withdrawn direct-request notifications route to request history.',
    visibility: 'Participant request history.',
    actionExpectation: 'No further action is expected from this notification.',
  },
  direct_request_approved: {
    state: 'terminal',
    workflow: 'requests',
    routePolicy: 'Closed direct-request notifications route to request history.',
    visibility: 'Participant request history.',
    actionExpectation: 'No further action is expected from this notification.',
  },
  direct_request_denied: {
    state: 'terminal',
    workflow: 'requests',
    routePolicy: 'Closed direct-request notifications route to request history.',
    visibility: 'Participant request history.',
    actionExpectation: 'No further action is expected from this notification.',
  },
  cycle_published: {
    state: 'informational',
    workflow: 'schedule',
    routePolicy: 'Schedule Block notifications route to the unified schedule.',
    visibility: 'Schedule view.',
    actionExpectation: 'Review the published schedule details.',
  },
  published_schedule_changed: {
    state: 'informational',
    workflow: 'schedule',
    routePolicy: 'Published schedule changes route to the unified schedule.',
    visibility: 'Schedule view.',
    actionExpectation: 'Review the changed schedule details.',
  },
  shift_reminder: {
    state: 'informational',
    workflow: 'schedule',
    routePolicy: 'Shift reminders route to the unified schedule.',
    visibility: 'Schedule view.',
    actionExpectation: 'Review the upcoming shift.',
  },
  operational_status_attention: {
    state: 'actionable',
    workflow: 'schedule',
    routePolicy: 'Operational attention routes to schedule review.',
    visibility: 'Schedule view.',
    actionExpectation: 'Manager or lead follow-up may be required.',
  },
  preliminary_sent: {
    state: 'informational',
    workflow: 'preliminary',
    routePolicy: 'Preliminary notifications route to preliminary schedule review.',
    visibility: 'Preliminary schedule view.',
    actionExpectation: 'Review the preliminary schedule.',
  },
  preliminary_refreshed: {
    state: 'informational',
    workflow: 'preliminary',
    routePolicy: 'Preliminary refresh notifications route to preliminary schedule review.',
    visibility: 'Preliminary schedule view.',
    actionExpectation: 'Review the refreshed preliminary schedule.',
  },
  preliminary_schedule_changed: {
    state: 'informational',
    workflow: 'preliminary',
    routePolicy: 'Preliminary change notifications route to the changed preliminary shift.',
    visibility: 'Preliminary schedule view.',
    actionExpectation: 'Review the changed preliminary schedule.',
  },
  preliminary_request_submitted: {
    state: 'actionable',
    workflow: 'preliminary',
    routePolicy: 'Submitted preliminary requests route managers to approvals.',
    visibility: 'Manager approval queue.',
    actionExpectation: 'Manager review may still be required.',
  },
  preliminary_request_approved: {
    state: 'terminal',
    workflow: 'preliminary',
    routePolicy: 'Closed preliminary request notifications route to preliminary review.',
    visibility: 'Preliminary schedule view.',
    actionExpectation: 'No further action is expected from this notification.',
  },
  preliminary_request_denied: {
    state: 'terminal',
    workflow: 'preliminary',
    routePolicy: 'Closed preliminary request notifications route to preliminary review.',
    visibility: 'Preliminary schedule view.',
    actionExpectation: 'No further action is expected from this notification.',
  },
  availability_ready: {
    state: 'actionable',
    workflow: 'availability',
    routePolicy: 'Availability notifications route to availability submission.',
    visibility: 'Availability workspace.',
    actionExpectation: 'Availability submission may still be required.',
  },
  availability_due_date_changed: {
    state: 'informational',
    workflow: 'availability',
    routePolicy: 'Availability due-date notifications route to availability submission.',
    visibility: 'Availability workspace.',
    actionExpectation: 'Review the updated due date.',
  },
} as const satisfies Record<string, NotificationLifecyclePolicy>

const NOTIFICATION_LIFECYCLE_POLICIES: Record<string, NotificationLifecyclePolicy> =
  NOTIFICATION_LIFECYCLE_MATRIX

export function getNotificationLifecyclePolicy(
  eventType: string
): NotificationLifecyclePolicy | null {
  return NOTIFICATION_LIFECYCLE_POLICIES[eventType] ?? null
}

export function isTerminalRequestNotification(eventType: string): boolean {
  return (REQUEST_TERMINAL_EVENTS as readonly string[]).includes(eventType)
}

export function getRequestNotificationBaseHref(
  eventType: string,
  role: NotificationDisplayRole
): string {
  if (role === 'manager') {
    return isTerminalRequestNotification(eventType) ? '/shift-board?tab=history' : '/shift-board'
  }

  return '/therapist/swaps'
}
