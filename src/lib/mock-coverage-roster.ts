export type RosterKind = 'core' | 'prn'
export type ShiftType = 'day' | 'night'
export type RosterShiftStatus = 'scheduled' | 'on_call' | 'cancelled' | 'left_early' | 'call_in'

/** Display value for a roster cell. Empty string = unassigned/blank. */
export type RosterCellValue = '' | '1' | 'OFF' | 'OC' | 'CX' | 'LE' | 'CI'

export type Staff = {
  id: string
  name: string
  roleLabel: 'Therapist'
  rosterKind: RosterKind
}

export type RosterDay = {
  isoDate: string
  dayLabel: string
  dayNumber: number
  isWeekend: boolean
}

export type RosterWeek = {
  id: string
  label: string
  startDate: string
  days: RosterDay[]
}

export type Assignment = {
  id: string
  staffId: string
  isoDate: string
  shiftType: ShiftType
  status: 'assigned'
  assignmentStatus: RosterShiftStatus | null
}

export type AssignmentStore = Record<string, Assignment>

/** Manager-approved availability outcome for mock roster cells (matches /coverage override semantics). */
export type AvailabilityApprovalKind = 'approved_off' | 'approved_work'

export type AvailabilityApprovalStore = Partial<Record<string, AvailabilityApprovalKind>>

export const DEMO_CYCLE = {
  startDate: '2026-05-03',
  endDate: '2026-06-13',
  shortLabel: 'May 3 – Jun 13, 2026',
} as const

export const DEMO_STAFF: Staff[] = [
  { id: 'adrienne-solt', name: 'Adrienne Solt', roleLabel: 'Therapist', rosterKind: 'core' },
  {
    id: 'barbara-cummings',
    name: 'Barbara Cummings',
    roleLabel: 'Therapist',
    rosterKind: 'core',
  },
  { id: 'brianna-yonkin', name: 'Brianna Yonkin', roleLabel: 'Therapist', rosterKind: 'core' },
  { id: 'kim-suarez', name: 'Kim Suarez', roleLabel: 'Therapist', rosterKind: 'core' },
  {
    id: 'aleyce-lariviere',
    name: 'Aleyce Lariviere',
    roleLabel: 'Therapist',
    rosterKind: 'core',
  },
  { id: 'layne-wilson', name: 'Layne Wilson', roleLabel: 'Therapist', rosterKind: 'core' },
  { id: 'lynn-snow', name: 'Lynn Snow', roleLabel: 'Therapist', rosterKind: 'core' },
  { id: 'tannie-brooks', name: 'Tannie Brooks', roleLabel: 'Therapist', rosterKind: 'core' },
  { id: 'irene-yanez', name: 'Irene Yanez', roleLabel: 'Therapist', rosterKind: 'prn' },
  { id: 'lisa-miller', name: 'Lisa Miller', roleLabel: 'Therapist', rosterKind: 'prn' },
] as const satisfies Staff[]

const UTC_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'short',
  day: 'numeric',
})

function formatWeekRange(startIso: string, endIso: string): string {
  const start = UTC_DATE_FORMATTER.format(parseIsoDate(startIso))
  const end = UTC_DATE_FORMATTER.format(parseIsoDate(endIso))
  return `${start} – ${end}`
}

const LONG_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const

function parseIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1, 12))
}

function addUtcDays(isoDate: string, daysToAdd: number): string {
  const parsed = parseIsoDate(isoDate)
  parsed.setUTCDate(parsed.getUTCDate() + daysToAdd)
  return parsed.toISOString().slice(0, 10)
}

export function formatLongDate(isoDate: string): string {
  return LONG_DATE_FORMATTER.format(parseIsoDate(isoDate))
}

export function buildRosterWeeks(startDate: string, endDate: string): RosterWeek[] {
  const weeks: RosterWeek[] = []
  let cursor = startDate
  let weekIndex = 0

  while (cursor <= endDate) {
    const days: RosterDay[] = []

    for (let offset = 0; offset < 7 && cursor <= endDate; offset += 1) {
      const parsed = parseIsoDate(cursor)
      const dow = parsed.getUTCDay()
      days.push({
        isoDate: cursor,
        dayLabel: WEEKDAY_LABELS[dow] ?? '-',
        dayNumber: parsed.getUTCDate(),
        isWeekend: dow === 0 || dow === 6,
      })
      cursor = addUtcDays(cursor, 1)
    }

    const startOfWeek = days[0]?.isoDate ?? startDate
    const endOfWeek = days[days.length - 1]?.isoDate ?? startOfWeek
    weeks.push({
      id: `week-${weekIndex + 1}`,
      label: formatWeekRange(startOfWeek, endOfWeek),
      startDate: startOfWeek,
      days,
    })
    weekIndex += 1
  }

  return weeks
}

export function splitStaffByRoster(staff: readonly Staff[]): { core: Staff[]; prn: Staff[] } {
  return {
    core: staff.filter((member) => member.rosterKind === 'core'),
    prn: staff.filter((member) => member.rosterKind === 'prn'),
  }
}

export function createAssignmentKey(
  staffId: string,
  isoDate: string,
  shiftType: ShiftType
): string {
  return `${shiftType}:${isoDate}:${staffId}`
}

export function createEmptyAssignments(): AssignmentStore {
  return {}
}

export function createEmptyAvailabilityApprovals(): AvailabilityApprovalStore {
  return {}
}

export function setAvailabilityApproval(
  store: AvailabilityApprovalStore,
  input: {
    staffId: string
    isoDate: string
    shiftType: ShiftType
    kind: AvailabilityApprovalKind
  }
): AvailabilityApprovalStore {
  const key = createAssignmentKey(input.staffId, input.isoDate, input.shiftType)
  return { ...store, [key]: input.kind }
}

export function clearAvailabilityApproval(
  store: AvailabilityApprovalStore,
  input: Pick<Assignment, 'staffId' | 'isoDate' | 'shiftType'>
): AvailabilityApprovalStore {
  const key = createAssignmentKey(input.staffId, input.isoDate, input.shiftType)
  const next = { ...store }
  delete next[key]
  return next
}

export function getAvailabilityApproval(
  store: AvailabilityApprovalStore,
  staffId: string,
  isoDate: string,
  shiftType: ShiftType
): AvailabilityApprovalKind | null {
  return store[createAssignmentKey(staffId, isoDate, shiftType)] ?? null
}

export function assignShift(
  store: AssignmentStore,
  input: Pick<Assignment, 'staffId' | 'isoDate' | 'shiftType'>
): AssignmentStore {
  const key = createAssignmentKey(input.staffId, input.isoDate, input.shiftType)

  return {
    ...store,
    [key]: {
      id: key,
      staffId: input.staffId,
      isoDate: input.isoDate,
      shiftType: input.shiftType,
      status: 'assigned',
      assignmentStatus: null,
    },
  }
}

export function unassignShift(
  store: AssignmentStore,
  input: Pick<Assignment, 'staffId' | 'isoDate' | 'shiftType'>
): AssignmentStore {
  const key = createAssignmentKey(input.staffId, input.isoDate, input.shiftType)
  const nextStore = { ...store }
  delete nextStore[key]
  return nextStore
}

export function getAssignmentsForShift(store: AssignmentStore, shiftType: ShiftType): Assignment[] {
  return Object.values(store).filter((assignment) => assignment.shiftType === shiftType)
}

export function hasAvailabilityApprovalsForShift(
  store: AvailabilityApprovalStore,
  shiftType: ShiftType
): boolean {
  const prefix = `${shiftType}:`
  return Object.keys(store).some((key) => store[key] != null && key.startsWith(prefix))
}

export function getAssignment(
  store: AssignmentStore,
  staffId: string,
  isoDate: string,
  shiftType: ShiftType
): Assignment | null {
  return store[createAssignmentKey(staffId, isoDate, shiftType)] ?? null
}

/** @deprecated Use RosterCellValue */
export type MockRosterCellSymbol = '+' | '1' | 'x'

const STATUS_CODE_MAP: Record<RosterShiftStatus, RosterCellValue> = {
  scheduled: '1',
  on_call: 'OC',
  cancelled: 'CX',
  left_early: 'LE',
  call_in: 'CI',
}

export function resolveMockRosterCellDisplay(
  assignment: Assignment | null,
  approval: AvailabilityApprovalKind | null
): { value: RosterCellValue; countsTowardDayTally: boolean } {
  if (approval === 'approved_off') {
    return { value: 'OFF', countsTowardDayTally: false }
  }
  if (assignment != null) {
    const code = assignment.assignmentStatus
      ? (STATUS_CODE_MAP[assignment.assignmentStatus] ?? '1')
      : '1'
    return { value: code, countsTowardDayTally: code !== 'CX' }
  }
  if (approval === 'approved_work') {
    return { value: '1', countsTowardDayTally: true }
  }
  return { value: '', countsTowardDayTally: false }
}
