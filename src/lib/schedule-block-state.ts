export type ScheduleBlockState =
  | 'created'
  | 'shifts_assigned'
  | 'preliminary_sent'
  | 'published'
  | 'unpublished'
  | 'archived'

export type ScheduleBlockStateInput = {
  published: boolean | null | undefined
  archivedAt?: string | null
  activePreliminarySnapshotId?: string | null
  shiftCount?: number | null
  hasPublishHistory?: boolean | null
}

export function resolveScheduleBlockState(input: ScheduleBlockStateInput): ScheduleBlockState {
  if (input.archivedAt) return 'archived'
  if (input.published) return 'published'
  if (input.hasPublishHistory) return 'unpublished'
  if (input.activePreliminarySnapshotId) return 'preliminary_sent'
  if ((input.shiftCount ?? 0) > 0) return 'shifts_assigned'
  return 'created'
}

export function canEditScheduleBlock(state: ScheduleBlockState): boolean {
  return state === 'created' || state === 'shifts_assigned' || state === 'preliminary_sent'
}

export function canPublishScheduleBlock(state: ScheduleBlockState): boolean {
  return state === 'shifts_assigned' || state === 'preliminary_sent' || state === 'unpublished'
}
