import type { NotificationDisplayRole } from '@/lib/notification-display'

export type NotificationLifecycleState = 'actionable' | 'terminal' | 'informational'

export type NotificationWorkflow = 'requests' | 'schedule' | 'preliminary' | 'availability'

export type NotificationLifecyclePolicy = {
  state: NotificationLifecycleState
  workflow: NotificationWorkflow
  owner: string
  recipientPolicy: string
  routePolicy: string
  visibility: string
  actionExpectation: string
  duplicateGuard: string
  reversalPolicy: string
  auditPolicy: string
}

export const REQUEST_TERMINAL_EVENTS = [
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
    owner: 'Shift Board database trigger.',
    recipientPolicy: 'Notify same-site managers who can review Shift Board requests.',
    routePolicy: 'Managers review the request on Shift Board.',
    visibility: 'Manager-facing request queue.',
    actionExpectation: 'Manager decision may still be required.',
    duplicateGuard: 'One row per trigger event; repeat request edits should use later events.',
    reversalPolicy: 'Resolved requests move follow-up notifications to terminal request events.',
    auditPolicy: 'Manager approval or denial writes request audit entries.',
  },
  shift_post_claimed: {
    state: 'actionable',
    workflow: 'requests',
    owner: 'Shift Board interest trigger.',
    recipientPolicy: 'Notify same-site managers when a teammate offers to cover.',
    routePolicy: 'Managers review responder activity on Shift Board.',
    visibility: 'Manager-facing request queue.',
    actionExpectation: 'Manager decision may still be required.',
    duplicateGuard: 'Responder interest state prevents duplicate active claims for one request.',
    reversalPolicy: 'Withdrawn or declined interest leaves manager work to request history.',
    auditPolicy: 'Manager selection or denial writes request audit entries.',
  },
  direct_request_received: {
    state: 'actionable',
    workflow: 'requests',
    owner: 'Direct request database trigger.',
    recipientPolicy: 'Notify only the selected recipient for the direct request.',
    routePolicy: 'Recipient reviews the direct request in Trade & Coverage Requests.',
    visibility: 'Recipient request workspace.',
    actionExpectation: 'Recipient accept or decline may still be required.',
    duplicateGuard: 'One active direct recipient per request.',
    reversalPolicy: 'Recipient decline or requester withdrawal produces terminal direct events.',
    auditPolicy: 'Recipient response is captured by request state; manager resolution is audited.',
  },
  swap_request_received: {
    state: 'actionable',
    workflow: 'requests',
    owner: 'Direct swap database trigger.',
    recipientPolicy: 'Notify only the named swap partner.',
    routePolicy: 'Recipient reviews the trade request in Trade & Coverage Requests.',
    visibility: 'Recipient request workspace.',
    actionExpectation: 'Recipient accept or decline may still be required.',
    duplicateGuard: 'One active named recipient per direct swap request.',
    reversalPolicy: 'Recipient decline or requester withdrawal produces terminal direct events.',
    auditPolicy: 'Recipient response is captured by request state; manager resolution is audited.',
  },
  direct_request_accepted: {
    state: 'actionable',
    workflow: 'requests',
    owner: 'Direct request response trigger.',
    recipientPolicy: 'Notify same-site managers and request participants as applicable.',
    routePolicy: 'Managers review accepted direct requests on Shift Board.',
    visibility: 'Manager queue and participant request history.',
    actionExpectation: 'Manager decision may still be required.',
    duplicateGuard: 'Recipient response can move from pending to accepted once.',
    reversalPolicy: 'Manager approval or denial produces terminal direct events.',
    auditPolicy: 'Manager resolution writes request audit entries.',
  },
  call_in_help_available: {
    state: 'actionable',
    workflow: 'requests',
    owner: 'Assignment status API.',
    recipientPolicy: 'Notify eligible same-site staff and operational reviewers for call-in help.',
    routePolicy: 'Managers and staff review open coverage requests in their request workspace.',
    visibility: 'Request workspaces.',
    actionExpectation: 'Coverage response may still be required.',
    duplicateGuard: 'Call-in help state is tied to the affected shift status transition.',
    reversalPolicy: 'Clearing the call-in status closes the active help expectation.',
    auditPolicy: 'Assignment status changes write schedule audit entries.',
  },
  request_approved: {
    state: 'terminal',
    workflow: 'requests',
    owner: 'Shift Board review trigger.',
    recipientPolicy: 'Notify requester and selected responder after manager approval.',
    routePolicy: 'Closed request notifications route to request history.',
    visibility: 'Request history.',
    actionExpectation: 'No further action is expected from this notification.',
    duplicateGuard: 'A request can enter approved once.',
    reversalPolicy: 'Approved request state is terminal; later schedule edits use schedule events.',
    auditPolicy:
      'Approval writes request audit entries and schedule mutation audit where applicable.',
  },
  request_denied: {
    state: 'terminal',
    workflow: 'requests',
    owner: 'Shift Board review trigger.',
    recipientPolicy: 'Notify requester and active responders after manager denial.',
    routePolicy: 'Closed request notifications route to request history.',
    visibility: 'Request history.',
    actionExpectation: 'No further action is expected from this notification.',
    duplicateGuard: 'A request can enter denied once.',
    reversalPolicy: 'Denied request state is terminal; staff must create a new request.',
    auditPolicy: 'Denial writes request audit entries.',
  },
  direct_request_declined: {
    state: 'terminal',
    workflow: 'requests',
    owner: 'Direct request response trigger.',
    recipientPolicy: 'Notify requester that the direct recipient declined.',
    routePolicy: 'Closed direct-request notifications route to request history.',
    visibility: 'Participant request history.',
    actionExpectation: 'No further action is expected from this notification.',
    duplicateGuard: 'Recipient response can move from pending to declined once.',
    reversalPolicy: 'Declined direct request cannot be manager-approved.',
    auditPolicy: 'Response is captured by request state; no manager audit entry is required.',
  },
  direct_request_withdrawn: {
    state: 'terminal',
    workflow: 'requests',
    owner: 'Direct request withdrawal trigger.',
    recipientPolicy: 'Notify direct recipient and managers who may have seen the active request.',
    routePolicy: 'Withdrawn direct-request notifications route to request history.',
    visibility: 'Participant request history.',
    actionExpectation: 'No further action is expected from this notification.',
    duplicateGuard: 'A request can enter withdrawn once.',
    reversalPolicy: 'Withdrawn request is closed; staff must create a new request.',
    auditPolicy:
      'Withdrawal state preserves request history; manager approval audit is not written.',
  },
  direct_request_approved: {
    state: 'terminal',
    workflow: 'requests',
    owner: 'Shift Board review trigger.',
    recipientPolicy: 'Notify requester and accepted direct recipient after manager approval.',
    routePolicy: 'Closed direct-request notifications route to request history.',
    visibility: 'Participant request history.',
    actionExpectation: 'No further action is expected from this notification.',
    duplicateGuard: 'A direct request can enter approved once.',
    reversalPolicy: 'Approved direct request state is terminal; later edits use schedule events.',
    auditPolicy:
      'Approval writes request audit entries and schedule mutation audit where applicable.',
  },
  direct_request_denied: {
    state: 'terminal',
    workflow: 'requests',
    owner: 'Shift Board review trigger.',
    recipientPolicy: 'Notify requester and accepted direct recipient after manager denial.',
    routePolicy: 'Closed direct-request notifications route to request history.',
    visibility: 'Participant request history.',
    actionExpectation: 'No further action is expected from this notification.',
    duplicateGuard: 'A direct request can enter denied once.',
    reversalPolicy: 'Denied direct request state is terminal; staff must create a new request.',
    auditPolicy: 'Denial writes request audit entries.',
  },
  cycle_published: {
    state: 'informational',
    workflow: 'schedule',
    owner: 'Final publish server action.',
    recipientPolicy: 'Notify active, unarchived same-site therapists and leads.',
    routePolicy: 'Schedule Block notifications route to the unified schedule.',
    visibility: 'Schedule view.',
    actionExpectation: 'Review the published schedule details.',
    duplicateGuard: 'Database unique index dedupes user, event, target type, and target id.',
    reversalPolicy:
      'Taking the block offline hides staff live views; republish emits a new publish event.',
    auditPolicy: 'Final publish writes a cycle_published audit entry.',
  },
  published_schedule_changed: {
    state: 'informational',
    workflow: 'schedule',
    owner: 'Published schedule mutation paths.',
    recipientPolicy: 'Notify affected staff when final assignments or operational status change.',
    routePolicy: 'Published schedule changes route to the unified schedule.',
    visibility: 'Schedule view.',
    actionExpectation: 'Review the changed schedule details.',
    duplicateGuard: 'No broad dedupe; each distinct schedule mutation is meaningful.',
    reversalPolicy: 'Follow-up schedule changes send their own changed-schedule notification.',
    auditPolicy: 'Published schedule mutations write schedule audit entries.',
  },
  shift_reminder: {
    state: 'informational',
    workflow: 'schedule',
    owner: 'Shift reminder cron.',
    recipientPolicy: 'Notify the staff member assigned to the upcoming shift.',
    routePolicy: 'Shift reminders route to the unified schedule.',
    visibility: 'Schedule view.',
    actionExpectation: 'Review the upcoming shift.',
    duplicateGuard:
      'shift_reminder_outbox and notification unique index prevent duplicate reminders.',
    reversalPolicy: 'If the assignment changes, later schedule notifications carry the correction.',
    auditPolicy: 'No audit entry; reminder delivery is operational messaging only.',
  },
  operational_status_attention: {
    state: 'actionable',
    workflow: 'schedule',
    owner: 'Assignment status API.',
    recipientPolicy: 'Notify same-site managers and leads when operational follow-up is needed.',
    routePolicy: 'Operational attention routes to schedule review.',
    visibility: 'Schedule view.',
    actionExpectation: 'Manager or lead follow-up may be required.',
    duplicateGuard: 'Status transition writes one attention event for the changed shift.',
    reversalPolicy:
      'Clearing or changing the status creates the next authoritative schedule state.',
    auditPolicy: 'Assignment status changes write schedule audit entries.',
  },
  preliminary_sent: {
    state: 'informational',
    workflow: 'preliminary',
    owner: 'Preliminary send server action.',
    recipientPolicy: 'Notify active, unarchived same-site therapists and leads.',
    routePolicy: 'Preliminary notifications route to preliminary schedule review.',
    visibility: 'Preliminary schedule view.',
    actionExpectation: 'Review the preliminary schedule.',
    duplicateGuard: 'First send uses preliminary_sent; later sends use preliminary_refreshed.',
    reversalPolicy: 'Final publish supersedes preliminary notifications.',
    auditPolicy: 'Preliminary send writes a preliminary_schedule_sent audit entry.',
  },
  preliminary_refreshed: {
    state: 'informational',
    workflow: 'preliminary',
    owner: 'Preliminary refresh server action.',
    recipientPolicy: 'Notify active, unarchived same-site therapists and leads.',
    routePolicy: 'Preliminary refresh notifications route to preliminary schedule review.',
    visibility: 'Preliminary schedule view.',
    actionExpectation: 'Review the refreshed preliminary schedule.',
    duplicateGuard: 'Each manager refresh is a distinct informational event.',
    reversalPolicy: 'Final publish supersedes preliminary refresh notifications.',
    auditPolicy: 'Preliminary refresh writes a preliminary_schedule_refreshed audit entry.',
  },
  preliminary_schedule_changed: {
    state: 'informational',
    workflow: 'preliminary',
    owner: 'Preliminary schedule mutation paths.',
    recipientPolicy: 'Notify affected staff when their preliminary assignment changes.',
    routePolicy: 'Preliminary change notifications route to the changed preliminary shift.',
    visibility: 'Preliminary schedule view.',
    actionExpectation: 'Review the changed preliminary schedule.',
    duplicateGuard: 'No broad dedupe; each distinct preliminary change is meaningful.',
    reversalPolicy: 'Later preliminary changes or final publish become the authoritative state.',
    auditPolicy:
      'Preliminary schedule mutations write request or schedule audit entries where applicable.',
  },
  preliminary_request_submitted: {
    state: 'actionable',
    workflow: 'preliminary',
    owner: 'Preliminary request server action.',
    recipientPolicy: 'Notify managers who can approve preliminary requests.',
    routePolicy: 'Submitted preliminary requests route managers to approvals.',
    visibility: 'Manager approval queue.',
    actionExpectation: 'Manager review may still be required.',
    duplicateGuard: 'One active preliminary request row per submitted change.',
    reversalPolicy: 'Manager approval or denial produces terminal preliminary request events.',
    auditPolicy: 'Manager approval or denial writes request audit entries.',
  },
  preliminary_request_approved: {
    state: 'terminal',
    workflow: 'preliminary',
    owner: 'Preliminary approval server action.',
    recipientPolicy: 'Notify the requester after manager approval.',
    routePolicy: 'Closed preliminary request notifications route to preliminary review.',
    visibility: 'Preliminary schedule view.',
    actionExpectation: 'No further action is expected from this notification.',
    duplicateGuard: 'A preliminary request can enter approved once.',
    reversalPolicy: 'Approved preliminary request state is terminal for that request.',
    auditPolicy: 'Approval writes request audit entries.',
  },
  preliminary_request_denied: {
    state: 'terminal',
    workflow: 'preliminary',
    owner: 'Preliminary approval server action.',
    recipientPolicy: 'Notify the requester after manager denial.',
    routePolicy: 'Closed preliminary request notifications route to preliminary review.',
    visibility: 'Preliminary schedule view.',
    actionExpectation: 'No further action is expected from this notification.',
    duplicateGuard: 'A preliminary request can enter denied once.',
    reversalPolicy: 'Denied preliminary request state is terminal for that request.',
    auditPolicy: 'Denial writes request audit entries.',
  },
  availability_ready: {
    state: 'actionable',
    workflow: 'availability',
    owner: 'Schedule Block Planning server action.',
    recipientPolicy:
      'Notify active, unarchived same-site therapists and leads when availability opens.',
    routePolicy: 'Availability notifications route to availability submission.',
    visibility: 'Availability workspace.',
    actionExpectation: 'Availability submission may still be required.',
    duplicateGuard: 'Sent only when a block first becomes therapist-visible for availability.',
    reversalPolicy: 'Closing or changing the due date uses availability window or due-date policy.',
    auditPolicy: 'Opening availability writes a planning visibility audit entry.',
  },
  availability_due_date_changed: {
    state: 'informational',
    workflow: 'availability',
    owner: 'Schedule Block Planning server action.',
    recipientPolicy:
      'Notify active, unarchived same-site therapists and leads when a visible due date changes.',
    routePolicy: 'Availability due-date notifications route to availability submission.',
    visibility: 'Availability workspace.',
    actionExpectation: 'Review the updated due date.',
    duplicateGuard: 'Each visible due-date change is a distinct informational event.',
    reversalPolicy: 'Later due-date changes supersede earlier due-date notifications.',
    auditPolicy:
      'Due-date changes write planning audit entries; target date changes without visibility are audit-only.',
  },
} as const satisfies Record<string, NotificationLifecyclePolicy>

export type NotificationEventType = keyof typeof NOTIFICATION_LIFECYCLE_MATRIX

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
