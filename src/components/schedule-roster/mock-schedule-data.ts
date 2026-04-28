import type { ShiftType } from '@/lib/mock-coverage-roster'

export type ScheduleCode = '' | '1' | 'OFF' | 'PTO' | 'OC' | 'CX' | 'CI' | 'LE' | 'N' | '*'

export type ScheduleDay = {
  isoDate: string
  dowLabel: string
  dayNumber: number
  weekIndex: number
  isWeekend: boolean
  isWeekStart: boolean
}

export type ScheduleWeek = {
  id: string
  label: string
  startIso: string
  endIso: string
  days: ScheduleDay[]
}

export type ScheduleRow = {
  id: string
  name: string
  section: 'core' | 'prn'
  codes: ScheduleCode[]
}

export type ScheduleSidebarItem = {
  id: string
  title: string
  subtitle: string
  meta: string
  badge?: string
}

export type ScheduleWarningItem = {
  id: string
  title: string
  detail: string
}

export type ScheduleSummaryStat = {
  label: string
  value: string
}

export type ScheduleDataset = {
  shift: ShiftType
  title: string
  cycleLabel: string
  weeks: ScheduleWeek[]
  coreRows: ScheduleRow[]
  prnRows: ScheduleRow[]
  coreCounts: number[]
  prnCounts: number[]
  openShifts: ScheduleSidebarItem[]
  pendingRequests: ScheduleSidebarItem[]
  warnings: ScheduleWarningItem[]
  summary: ScheduleSummaryStat[]
}

const START_ISO = '2026-03-22'
const END_ISO = '2026-05-02'
const DOW_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const
const WORKING_CODES = new Set<ScheduleCode>(['1', 'OC', 'CI', 'LE', 'N'])

const DATE_LABEL_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'short',
  day: 'numeric',
})

function parseIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year ?? 2026, (month ?? 1) - 1, day ?? 1, 12))
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addUtcDays(isoDate: string, daysToAdd: number): string {
  const date = parseIsoDate(isoDate)
  date.setUTCDate(date.getUTCDate() + daysToAdd)
  return toIsoDate(date)
}

function formatWeekLabel(startIso: string, endIso: string): string {
  return `${DATE_LABEL_FORMATTER.format(parseIsoDate(startIso))} – ${DATE_LABEL_FORMATTER.format(parseIsoDate(endIso))}`
}

function buildWeeks(): ScheduleWeek[] {
  const weeks: ScheduleWeek[] = []
  let cursor = START_ISO
  let weekIndex = 0

  while (cursor <= END_ISO) {
    const days: ScheduleDay[] = []

    for (let offset = 0; offset < 7 && cursor <= END_ISO; offset += 1) {
      const date = parseIsoDate(cursor)
      const dayOfWeek = date.getUTCDay()
      days.push({
        isoDate: cursor,
        dowLabel: DOW_LABELS[dayOfWeek] ?? '-',
        dayNumber: date.getUTCDate(),
        weekIndex,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isWeekStart: offset === 0,
      })
      cursor = addUtcDays(cursor, 1)
    }

    const startIso = days[0]?.isoDate ?? START_ISO
    const endIso = days[days.length - 1]?.isoDate ?? END_ISO
    weeks.push({
      id: `week-${weekIndex + 1}`,
      label: formatWeekLabel(startIso, endIso),
      startIso,
      endIso,
      days,
    })
    weekIndex += 1
  }

  return weeks
}

const WEEKS = buildWeeks()
const DAYS = WEEKS.flatMap((week) => week.days)

function buildWeeklyRow(args: {
  id: string
  name: string
  section: 'core' | 'prn'
  workDays: number[]
  defaultCode?: ScheduleCode
  overrides?: Record<number, ScheduleCode>
}): ScheduleRow {
  const overrides = args.overrides ?? {}
  const codes = DAYS.map((day, index) => {
    if (overrides[index] !== undefined) return overrides[index]!
    return args.workDays.includes(parseIsoDate(day.isoDate).getUTCDay())
      ? (args.defaultCode ?? '1')
      : ''
  })

  return {
    id: args.id,
    name: args.name,
    section: args.section,
    codes,
  }
}

function countWorkingCodes(rows: readonly ScheduleRow[]): number[] {
  return DAYS.map((_, dayIndex) =>
    rows.reduce((total, row) => total + (WORKING_CODES.has(row.codes[dayIndex] ?? '') ? 1 : 0), 0)
  )
}

const DAY_CORE_ROWS: ScheduleRow[] = [
  buildWeeklyRow({
    id: 'adrienne',
    name: 'Adrienne',
    section: 'core',
    workDays: [0, 3, 4, 5, 6],
    overrides: { 2: '*', 7: 'PTO', 33: 'PTO' },
  }),
  buildWeeklyRow({
    id: 'kim',
    name: 'Kim',
    section: 'core',
    workDays: [0, 1, 2, 4, 6],
    overrides: { 2: '*', 8: 'OFF', 17: '*', 34: '*', 40: 'PTO' },
  }),
  buildWeeklyRow({
    id: 'brianna',
    name: 'Brianna',
    section: 'core',
    workDays: [1, 3, 5, 6],
    overrides: { 12: 'PTO', 22: 'PTO', 29: 'CX' },
  }),
  buildWeeklyRow({
    id: 'barbara',
    name: 'Barbara',
    section: 'core',
    workDays: [1, 2, 3, 4],
    overrides: { 0: 'OFF', 5: 'OC', 7: 'N', 14: 'N', 18: 'PTO' },
  }),
  buildWeeklyRow({
    id: 'layne',
    name: 'Layne',
    section: 'core',
    workDays: [0, 2, 3, 5],
    overrides: { 4: '*', 17: '' },
  }),
  buildWeeklyRow({
    id: 'tannie',
    name: 'Tannie',
    section: 'core',
    workDays: [1, 2, 4, 5],
    overrides: { 3: '*', 12: '', 25: 'LE' },
  }),
  buildWeeklyRow({
    id: 'aleyce',
    name: 'Aleyce',
    section: 'core',
    workDays: [0, 2, 4],
    overrides: { 1: '', 9: '', 24: '', 35: '' },
  }),
  buildWeeklyRow({
    id: 'lynn',
    name: 'Lynn',
    section: 'core',
    workDays: [1, 3, 4],
    overrides: { 5: '', 31: '*' },
  }),
  buildWeeklyRow({
    id: 'sarah-w',
    name: 'Sarah W',
    section: 'core',
    workDays: [],
    overrides: {
      0: 'OFF',
      4: 'OFF',
      8: 'OFF',
      10: 'OFF',
      12: 'OFF',
      16: 'OFF',
      19: 'OFF',
      23: 'OFF',
      27: 'OFF',
      29: 'OFF',
      31: 'OFF',
      36: 'OFF',
      37: 'OFF',
      41: 'OFF',
    },
  }),
]

const DAY_PRN_ROWS: ScheduleRow[] = [
  buildWeeklyRow({
    id: 'lisa-m',
    name: 'Lisa M',
    section: 'prn',
    workDays: [1, 4],
    overrides: { 33: '*', 37: '1' },
  }),
  buildWeeklyRow({
    id: 'irene',
    name: 'Irene',
    section: 'prn',
    workDays: [0, 1, 3, 5],
    overrides: { 10: '*', 24: '', 40: '' },
  }),
]

const NIGHT_CORE_ROWS: ScheduleRow[] = [
  buildWeeklyRow({
    id: 'barbara-night',
    name: 'Barbara',
    section: 'core',
    workDays: [0, 2, 4, 5],
    defaultCode: 'N',
    overrides: { 6: 'OFF', 18: 'PTO', 27: 'CI' },
  }),
  buildWeeklyRow({
    id: 'kim-night',
    name: 'Kim',
    section: 'core',
    workDays: [1, 3, 5, 6],
    defaultCode: 'N',
    overrides: { 10: '*', 22: 'OC', 39: 'LE' },
  }),
  buildWeeklyRow({
    id: 'lynn-night',
    name: 'Lynn',
    section: 'core',
    workDays: [0, 1, 4],
    defaultCode: 'N',
    overrides: { 14: 'PTO', 29: 'CX' },
  }),
  buildWeeklyRow({
    id: 'layne-night',
    name: 'Layne',
    section: 'core',
    workDays: [2, 4, 6],
    defaultCode: 'N',
    overrides: { 7: 'OFF', 16: '*', 34: 'CI' },
  }),
  buildWeeklyRow({
    id: 'tannie-night',
    name: 'Tannie',
    section: 'core',
    workDays: [1, 3, 6],
    defaultCode: 'N',
    overrides: { 12: 'OFF', 25: 'PTO' },
  }),
]

const NIGHT_PRN_ROWS: ScheduleRow[] = [
  buildWeeklyRow({
    id: 'irene-night',
    name: 'Irene',
    section: 'prn',
    workDays: [2, 5],
    defaultCode: 'N',
    overrides: { 11: '*', 30: 'LE' },
  }),
  buildWeeklyRow({
    id: 'lisa-night',
    name: 'Lisa M',
    section: 'prn',
    workDays: [0, 3],
    defaultCode: 'N',
    overrides: { 17: 'CI', 38: '*' },
  }),
]

function buildSummary(
  rows: readonly ScheduleRow[],
  warnings: number,
  openShifts: number
): ScheduleSummaryStat[] {
  const allCodes = rows.flatMap((row) => row.codes)
  const totalShifts = allCodes.filter((code) => WORKING_CODES.has(code)).length
  const ptoDays = allCodes.filter((code) => code === 'PTO').length
  const onCallDays = allCodes.filter((code) => code === 'OC').length

  return [
    { label: 'Total Shifts', value: String(totalShifts) },
    { label: 'Open Shifts', value: String(openShifts) },
    { label: 'PTO Days', value: String(ptoDays) },
    { label: 'Coverage Warnings', value: String(warnings) },
    { label: 'On Call Days', value: String(onCallDays) },
  ]
}

const DAY_OPEN_SHIFTS: ScheduleSidebarItem[] = [
  {
    id: 'day-open-1',
    title: 'Tue, Apr 7',
    subtitle: 'Day Shift · ICU',
    meta: 'Assign',
    badge: '1 needed',
  },
  {
    id: 'day-open-2',
    title: 'Sun, Apr 26',
    subtitle: 'Day Shift · PEDS',
    meta: 'Assign',
    badge: '1 needed',
  },
]

const NIGHT_OPEN_SHIFTS: ScheduleSidebarItem[] = [
  {
    id: 'night-open-1',
    title: 'Fri, Apr 10',
    subtitle: 'Night Shift · ICU',
    meta: 'Assign',
    badge: '1 needed',
  },
  {
    id: 'night-open-2',
    title: 'Wed, Apr 29',
    subtitle: 'Night Shift · NICU',
    meta: 'Assign',
    badge: '2 needed',
  },
]

const DAY_PENDING_REQUESTS: ScheduleSidebarItem[] = [
  { id: 'day-request-1', title: 'Brianna', subtitle: 'PTO · Apr 10', meta: 'Approve' },
  { id: 'day-request-2', title: 'Layne', subtitle: 'PTO · Apr 24', meta: 'Approve' },
  { id: 'day-request-3', title: 'Kim', subtitle: 'Swap · Apr 6', meta: 'Review' },
]

const NIGHT_PENDING_REQUESTS: ScheduleSidebarItem[] = [
  { id: 'night-request-1', title: 'Barbara', subtitle: 'PTO · Apr 18', meta: 'Approve' },
  { id: 'night-request-2', title: 'Lynn', subtitle: 'OC swap · Apr 20', meta: 'Review' },
]

const DAY_WARNINGS: ScheduleWarningItem[] = [
  { id: 'day-warning-1', title: 'Tue, Apr 7', detail: 'ICU has only 2 scheduled · 1 more needed' },
  {
    id: 'day-warning-2',
    title: 'Sun, Apr 26',
    detail: 'PEDS has only 2 scheduled · 1 more needed',
  },
]

const NIGHT_WARNINGS: ScheduleWarningItem[] = [
  {
    id: 'night-warning-1',
    title: 'Fri, Apr 10',
    detail: 'ICU night coverage is short one therapist',
  },
  {
    id: 'night-warning-2',
    title: 'Wed, Apr 29',
    detail: 'NICU night coverage needs backup coverage',
  },
]

const DAY_DATASET: ScheduleDataset = {
  shift: 'day',
  title: 'Respiratory Therapy Day Shift',
  cycleLabel: 'March 22, 2026 – May 2, 2026 (6 Weeks)',
  weeks: WEEKS,
  coreRows: DAY_CORE_ROWS,
  prnRows: DAY_PRN_ROWS,
  coreCounts: countWorkingCodes(DAY_CORE_ROWS),
  prnCounts: countWorkingCodes(DAY_PRN_ROWS),
  openShifts: DAY_OPEN_SHIFTS,
  pendingRequests: DAY_PENDING_REQUESTS,
  warnings: DAY_WARNINGS,
  summary: buildSummary(
    [...DAY_CORE_ROWS, ...DAY_PRN_ROWS],
    DAY_WARNINGS.length,
    DAY_OPEN_SHIFTS.length
  ),
}

const NIGHT_DATASET: ScheduleDataset = {
  shift: 'night',
  title: 'Respiratory Therapy Night Shift',
  cycleLabel: 'March 22, 2026 – May 2, 2026 (6 Weeks)',
  weeks: WEEKS,
  coreRows: NIGHT_CORE_ROWS,
  prnRows: NIGHT_PRN_ROWS,
  coreCounts: countWorkingCodes(NIGHT_CORE_ROWS),
  prnCounts: countWorkingCodes(NIGHT_PRN_ROWS),
  openShifts: NIGHT_OPEN_SHIFTS,
  pendingRequests: NIGHT_PENDING_REQUESTS,
  warnings: NIGHT_WARNINGS,
  summary: buildSummary(
    [...NIGHT_CORE_ROWS, ...NIGHT_PRN_ROWS],
    NIGHT_WARNINGS.length,
    NIGHT_OPEN_SHIFTS.length
  ),
}

export const SCHEDULE_LEGEND: Array<{ code: Exclude<ScheduleCode, ''>; label: string }> = [
  { code: '1', label: 'Working' },
  { code: 'OFF', label: 'Off' },
  { code: 'PTO', label: 'PTO' },
  { code: 'OC', label: 'On Call' },
  { code: 'CX', label: 'Cancelled' },
  { code: 'N', label: 'Night' },
  { code: 'LE', label: 'Left Early' },
  { code: 'CI', label: 'Call In' },
  { code: '*', label: 'Notes' },
]

export function getMockScheduleDataset(shift: ShiftType): ScheduleDataset {
  return shift === 'night' ? NIGHT_DATASET : DAY_DATASET
}
