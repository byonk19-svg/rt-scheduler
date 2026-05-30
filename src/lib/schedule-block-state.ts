export type ScheduleBlockState =
  | 'created'
  | 'shifts_assigned'
  | 'preliminary_sent'
  | 'published'
  | 'offline'
  | 'archived'

export type ScheduleBlockStateInput = {
  published: boolean | null | undefined
  status?: 'draft' | 'preliminary' | 'final' | 'offline' | 'archived' | null
  archivedAt?: string | null
  activePreliminarySnapshotId?: string | null
  shiftCount?: number | null
  hasPublishHistory?: boolean | null
}

export function resolveScheduleBlockState(input: ScheduleBlockStateInput): ScheduleBlockState {
  if (input.archivedAt) return 'archived'
  if (input.status === 'archived') return 'archived'
  if (input.status === 'final') return 'published'
  if (input.published) return 'published'
  if (input.status === 'offline') return 'offline'
  if (input.hasPublishHistory) return 'offline'
  if (input.status === 'preliminary') return 'preliminary_sent'
  if (input.activePreliminarySnapshotId) return 'preliminary_sent'
  if ((input.shiftCount ?? 0) > 0) return 'shifts_assigned'
  return 'created'
}

export function getScheduleBlockStateLabel(state: ScheduleBlockState): string {
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

export function canEditScheduleBlock(state: ScheduleBlockState): boolean {
  return state === 'created' || state === 'shifts_assigned' || state === 'preliminary_sent'
}

export function canPublishScheduleBlock(state: ScheduleBlockState): boolean {
  return state === 'shifts_assigned' || state === 'preliminary_sent' || state === 'offline'
}
