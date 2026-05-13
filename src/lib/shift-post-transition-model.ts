export type ShiftPostCommand =
  | 'create_request'
  | 'respond_direct_request'
  | 'withdraw_request'
  | 'withdraw_interest'
  | 'express_interest'
  | 'review_request'
  | 'deny_claimant'

export type ShiftPostCommandActor = 'requester_or_recipient' | 'manager'

export const SHIFT_POST_COMMAND_MODEL = {
  create_request: {
    actor: 'requester_or_recipient',
    entryState: 'owned working scheduled shift on a published schedule',
    exitState: 'pending shift post',
  },
  respond_direct_request: {
    actor: 'requester_or_recipient',
    entryState: 'pending direct request with pending recipient response',
    exitState: 'accepted request awaiting manager review or denied direct request',
  },
  withdraw_request: {
    actor: 'requester_or_recipient',
    entryState: 'requester-owned pending request',
    exitState: 'withdrawn request',
  },
  withdraw_interest: {
    actor: 'requester_or_recipient',
    entryState: 'actor-owned pending interest',
    exitState: 'withdrawn interest',
  },
  express_interest: {
    actor: 'requester_or_recipient',
    entryState: 'open pending team pickup request',
    exitState: 'pending pickup interest',
  },
  review_request: {
    actor: 'manager',
    entryState: 'pending request ready for manager decision',
    exitState: 'approved or denied request',
  },
  deny_claimant: {
    actor: 'manager',
    entryState: 'pending pickup interest on a pending pickup request',
    exitState: 'denied pickup interest',
  },
} as const satisfies Record<
  ShiftPostCommand,
  { actor: ShiftPostCommandActor; entryState: string; exitState: string }
>

export function isShiftPostCommand(value: unknown): value is ShiftPostCommand {
  return typeof value === 'string' && value in SHIFT_POST_COMMAND_MODEL
}

export function shiftPostCommandRequiresManager(action: ShiftPostCommand): boolean {
  return SHIFT_POST_COMMAND_MODEL[action].actor === 'manager'
}
