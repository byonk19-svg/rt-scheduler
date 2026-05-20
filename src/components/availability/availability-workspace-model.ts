import { addDays, toIsoDate } from '@/lib/calendar-utils'
import { shiftOverridesToCycle, type SourceOverride } from '@/lib/copy-cycle-availability'

export type AvailabilityWorkspaceCycle = {
  id?: string
  start_date: string
  end_date: string
}

export type DayStatus = 'force_on' | 'force_off'
export type DayDisplayState = 'normal_work' | 'normal_off' | 'can_work' | 'cannot_work' | 'not_set'
export type StatusByDate = Record<string, DayStatus>
export type NotesByDate = Record<string, string>

export type AvailabilityWorkspaceRow = {
  cycleId: string
  date: string
  entryType: DayStatus
  reason?: string | null
  shiftType: SourceOverride['shift_type']
}

export type AvailabilityBaselineByDate = Record<
  string,
  { baselineStatus?: 'available' | 'off' | 'neutral' | string | null } | undefined
>

export type AvailabilityDraft = {
  statusByDate: StatusByDate
  notesByDate: NotesByDate
}

export function buildStatusMap(
  rows: readonly Pick<AvailabilityWorkspaceRow, 'date' | 'entryType'>[]
): StatusByDate {
  const next: StatusByDate = {}
  for (const row of rows) {
    next[row.date] = row.entryType === 'force_off' ? 'force_off' : 'force_on'
  }
  return next
}

export function buildNotesMap(
  rows: readonly Pick<AvailabilityWorkspaceRow, 'date' | 'reason'>[]
): NotesByDate {
  const next: NotesByDate = {}
  for (const row of rows) {
    if (row.reason?.trim()) next[row.date] = row.reason.trim()
  }
  return next
}

export function buildCycleDays(
  cycle: Pick<AvailabilityWorkspaceCycle, 'start_date' | 'end_date'> | null
): string[] {
  if (!cycle) return []
  const dayCount =
    Math.floor(
      (new Date(`${cycle.end_date}T00:00:00`).getTime() -
        new Date(`${cycle.start_date}T00:00:00`).getTime()) /
        (24 * 60 * 60 * 1000)
    ) + 1
  return Array.from({ length: Math.max(dayCount, 0) }, (_, index) =>
    toIsoDate(addDays(new Date(`${cycle.start_date}T00:00:00`), index))
  )
}

export function sortDateKeys(values: string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right))
}

export function buildRangeDates(
  cycleDays: readonly string[],
  rangeStart: string,
  rangeEnd: string
): string[] {
  if (!rangeStart || !rangeEnd) return []
  const ordered = [rangeStart, rangeEnd].sort((left, right) => left.localeCompare(right))
  return cycleDays.filter((date) => date >= ordered[0] && date <= ordered[1])
}

export function getDisplayStateLabel(state: DayDisplayState): string {
  switch (state) {
    case 'normal_work':
    case 'can_work':
      return 'Need to Work'
    case 'normal_off':
    case 'cannot_work':
      return 'Need Off'
    default:
      return 'Unmarked'
  }
}

export function getBaselineStatus(
  baselineByDate: AvailabilityBaselineByDate,
  date: string
): 'available' | 'off' | 'neutral' {
  const value = baselineByDate[date]?.baselineStatus
  return value === 'available' || value === 'off' ? value : 'neutral'
}

export function getDisplayState(
  date: string,
  statusByDate: StatusByDate,
  baselineByDate: AvailabilityBaselineByDate
): DayDisplayState {
  const overrideStatus = statusByDate[date] ?? null
  if (overrideStatus === 'force_on') return 'can_work'
  if (overrideStatus === 'force_off') return 'cannot_work'

  const baselineStatus = getBaselineStatus(baselineByDate, date)
  if (baselineStatus === 'available') return 'normal_work'
  if (baselineStatus === 'off') return 'normal_off'
  return 'not_set'
}

export function summarizeBaseline(
  cycleDays: readonly string[],
  baselineByDate: AvailabilityBaselineByDate
): { normalWork: number; normalOff: number; notSet: number } {
  return cycleDays.reduce(
    (totals, date) => {
      const baselineStatus = getBaselineStatus(baselineByDate, date)
      if (baselineStatus === 'available') totals.normalWork += 1
      else if (baselineStatus === 'off') totals.normalOff += 1
      else totals.notSet += 1
      return totals
    },
    { normalWork: 0, normalOff: 0, notSet: 0 }
  )
}

export function normalizeOverride(
  date: string,
  status: DayStatus | null,
  baselineByDate: AvailabilityBaselineByDate
): DayStatus | null {
  if (!status) return null
  const baselineStatus = getBaselineStatus(baselineByDate, date)
  if (status === 'force_on' && baselineStatus === 'available') return null
  if (status === 'force_off' && baselineStatus === 'off') return null
  return status
}

export function applyOverrideToDraft({
  statusByDate,
  notesByDate,
  date,
  status,
  baselineByDate,
}: {
  statusByDate: StatusByDate
  notesByDate: NotesByDate
  date: string
  status: DayStatus | null
  baselineByDate: AvailabilityBaselineByDate
}): AvailabilityDraft {
  const normalizedStatus = normalizeOverride(date, status, baselineByDate)
  const nextStatusByDate = { ...statusByDate }
  const nextNotesByDate = { ...notesByDate }

  if (!normalizedStatus) {
    delete nextStatusByDate[date]
    delete nextNotesByDate[date]
  } else {
    nextStatusByDate[date] = normalizedStatus
  }

  return { statusByDate: nextStatusByDate, notesByDate: nextNotesByDate }
}

export function applySelectionToDraft({
  statusByDate,
  notesByDate,
  dates,
  status,
  baselineByDate,
}: {
  statusByDate: StatusByDate
  notesByDate: NotesByDate
  dates: readonly string[]
  status: DayStatus | null
  baselineByDate: AvailabilityBaselineByDate
}): AvailabilityDraft {
  return dates.reduce<AvailabilityDraft>(
    (draft, date) =>
      applyOverrideToDraft({
        ...draft,
        date,
        status,
        baselineByDate,
      }),
    { statusByDate, notesByDate }
  )
}

export function clearAvailabilityDraft(): AvailabilityDraft {
  return { statusByDate: {}, notesByDate: {} }
}

export function updateDraftNote(notesByDate: NotesByDate, date: string, note: string): NotesByDate {
  return { ...notesByDate, [date]: note }
}

export function hasAvailabilityDraftChanges(
  initialStatusByDate: StatusByDate,
  draftStatusByDate: StatusByDate,
  initialNotesByDate: NotesByDate,
  draftNotesByDate: NotesByDate
): boolean {
  const allStatusDates = new Set([
    ...Object.keys(initialStatusByDate),
    ...Object.keys(draftStatusByDate),
  ])
  for (const date of allStatusDates) {
    if ((initialStatusByDate[date] ?? null) !== (draftStatusByDate[date] ?? null)) return true
  }

  const allNoteDates = new Set([
    ...Object.keys(initialNotesByDate),
    ...Object.keys(draftNotesByDate),
  ])
  for (const date of allNoteDates) {
    if ((initialNotesByDate[date] ?? '').trim() !== (draftNotesByDate[date] ?? '').trim()) {
      return true
    }
  }
  return false
}

export function buildAvailabilityDraftSummary({
  statusByDate,
  notesByDate,
}: {
  statusByDate: StatusByDate
  notesByDate: NotesByDate
}): { canWorkDates: string[]; cannotWorkDates: string[]; notesPayload: string } {
  const canWorkDates = sortDateKeys(
    Object.entries(statusByDate)
      .filter(([, status]) => status === 'force_on')
      .map(([date]) => date)
  )
  const cannotWorkDates = sortDateKeys(
    Object.entries(statusByDate)
      .filter(([, status]) => status === 'force_off')
      .map(([date]) => date)
  )

  const notesPayload = JSON.stringify(
    Object.fromEntries(
      Object.entries(notesByDate)
        .map(([date, note]) => [date, note.trim()])
        .filter(([date, note]) => note.length > 0 && Boolean(statusByDate[date]))
    )
  )

  return { canWorkDates, cannotWorkDates, notesPayload }
}

export function buildCopiedCycleDraft({
  cycles,
  availabilityRows,
  selectedCycleId,
  baselineByDate,
}: {
  cycles: readonly (AvailabilityWorkspaceCycle & { id: string })[]
  availabilityRows: readonly AvailabilityWorkspaceRow[]
  selectedCycleId: string
  baselineByDate: AvailabilityBaselineByDate
}): AvailabilityDraft | null {
  const cycleIndex = cycles.findIndex((cycle) => cycle.id === selectedCycleId)
  const selectedCycle = cycles[cycleIndex] ?? null
  if (cycleIndex <= 0 || !selectedCycle) return null

  const previousCycle = cycles[cycleIndex - 1]
  if (!previousCycle) return null

  const previousRows = availabilityRows.filter((row) => row.cycleId === previousCycle.id)
  const copiedRows = shiftOverridesToCycle({
    sourceOverrides: previousRows.map((row) => ({
      date: row.date,
      override_type: row.entryType === 'force_off' ? 'force_off' : 'force_on',
      shift_type: row.shiftType,
      note: row.reason ?? null,
    })),
    sourceCycleStart: previousCycle.start_date,
    sourceCycleEnd: previousCycle.end_date,
    targetCycleStart: selectedCycle.start_date,
    targetCycleEnd: selectedCycle.end_date,
    existingTargetDates: new Set(),
  })

  return copiedRows.reduce<AvailabilityDraft>((draft, row) => {
    const nextDraft = applyOverrideToDraft({
      statusByDate: draft.statusByDate,
      notesByDate: draft.notesByDate,
      date: row.date,
      status: row.override_type,
      baselineByDate,
    })

    if (nextDraft.statusByDate[row.date] && row.note?.trim()) {
      nextDraft.notesByDate[row.date] = row.note.trim()
    }
    return nextDraft
  }, clearAvailabilityDraft())
}
