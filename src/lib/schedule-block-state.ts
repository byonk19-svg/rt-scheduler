export type ScheduleBlockStatus = 'draft' | 'preliminary' | 'final' | 'offline' | 'archived'

export type ScheduleBlockState =
  | 'created'
  | 'shifts_assigned'
  | 'preliminary_sent'
  | 'published'
  | 'offline'
  | 'archived'

export type ScheduleBlockStateInput = {
  published?: boolean | null
  status?: ScheduleBlockStatus | string | null
  archived_at?: string | null
  archivedAt?: string | null
  activePreliminarySnapshotId?: string | null
  hasActivePreliminarySnapshot?: boolean | null
  shiftCount?: number | null
  hasPublishHistory?: boolean | null
}

export function resolveScheduleBlockState(input: ScheduleBlockStateInput): ScheduleBlockState {
  if (input.archived_at || input.archivedAt || input.status === 'archived') return 'archived'
  if (input.status === 'offline') return 'offline'
  if (input.status === 'final' || input.published) return 'published'
  if (input.hasPublishHistory) return 'offline'
  if (
    input.status === 'preliminary' ||
    input.activePreliminarySnapshotId ||
    input.hasActivePreliminarySnapshot
  ) {
    return 'preliminary_sent'
  }
  if ((input.shiftCount ?? 0) > 0) return 'shifts_assigned'
  return 'created'
}

function getScheduleBlockStateLabel(state: ScheduleBlockState): string {
  switch (state) {
    case 'created':
    case 'shifts_assigned':
      return 'Draft'
    case 'preliminary_sent':
      return 'Preliminary'
    case 'published':
      return 'Published'
    case 'offline':
      return 'Offline'
    case 'archived':
      return 'Archived'
  }
}

export function getScheduleBlockLifecycleLabel(input: ScheduleBlockStateInput): string {
  return getScheduleBlockStateLabel(resolveScheduleBlockState(input))
}

export function isReadOnlyScheduleBlock(input: ScheduleBlockStateInput): boolean {
  const state = resolveScheduleBlockState(input)
  return state === 'offline' || state === 'archived'
}

export function isArchivedScheduleBlock(input: ScheduleBlockStateInput): boolean {
  return resolveScheduleBlockState(input) === 'archived'
}

export function isPublishedScheduleBlock(input: ScheduleBlockStateInput): boolean {
  return resolveScheduleBlockState(input) === 'published'
}

export function isPreliminaryScheduleBlock(input: ScheduleBlockStateInput): boolean {
  return resolveScheduleBlockState(input) === 'preliminary_sent'
}

export function canEditScheduleBlock(state: ScheduleBlockState): boolean {
  return state === 'created' || state === 'shifts_assigned' || state === 'preliminary_sent'
}

export function canPublishScheduleBlock(state: ScheduleBlockState): boolean {
  return state === 'shifts_assigned' || state === 'preliminary_sent' || state === 'offline'
}
