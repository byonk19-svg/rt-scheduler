export type ScheduleBlockLifecycleState = 'draft' | 'preliminary' | 'final' | 'offline' | 'archived'

export type ScheduleBlockLifecycleTransition = 'take_offline' | 'republish' | 'archive'

export type ScheduleBlockLifecycleRule = {
  from: readonly ScheduleBlockLifecycleState[]
  to: ScheduleBlockLifecycleState
  visibility: string
  requestPolicy: string
  notificationPolicy: string
  reversal: string
  mutationPolicy: string
}

export const OFFLINE_SHIFT_BOARD_CLOSURE_REASON =
  'Schedule block was taken offline. Submit a new request after it is republished.'

export const SCHEDULE_BLOCK_LIFECYCLE_MATRIX = {
  take_offline: {
    from: ['final'],
    to: 'offline',
    visibility:
      'Managers keep the Schedule Block in publish history and schedule review; staff no longer receive live published schedule visibility.',
    requestPolicy:
      'Close pending Shift Board posts tied to the Schedule Block shifts and decline pending or selected responder interests.',
    notificationPolicy:
      'Do not send a new publish notification; write the closure reason onto affected requests so the state explains itself.',
    reversal:
      'Republish is allowed only through final publish validation and only if no other live block covers the same date range.',
    mutationPolicy: 'The Schedule Block is read-only outside lifecycle actions until republished.',
  },
  republish: {
    from: ['offline'],
    to: 'final',
    visibility:
      'Staff regain published schedule visibility after final publish validation succeeds.',
    requestPolicy:
      'Existing closed requests stay closed; new requests must be created after republish.',
    notificationPolicy: 'Publish notification behavior follows the final publish path.',
    reversal: 'The block can be taken offline again from the live final state.',
    mutationPolicy: 'Final schedule mutation rules apply after republish.',
  },
  archive: {
    from: ['draft', 'preliminary', 'offline'],
    to: 'archived',
    visibility: 'Archived blocks leave active manager and staff planning surfaces.',
    requestPolicy:
      'Live blocks must be taken offline before archive; archived blocks do not reopen requests.',
    notificationPolicy: 'Archive does not send schedule publish notifications.',
    reversal: 'Archive is treated as a terminal administrative state.',
    mutationPolicy: 'Archived Schedule Blocks are read-only.',
  },
} as const satisfies Record<ScheduleBlockLifecycleTransition, ScheduleBlockLifecycleRule>

export function canTakeScheduleBlockOffline(input: {
  published: boolean | null | undefined
  status: ScheduleBlockLifecycleState | null | undefined
}): boolean {
  return input.published === true && input.status === 'final'
}
