import { addDays, toIsoDate } from '@/lib/calendar-utils'

export type TemplateShiftData = {
  user_id: string
  shift_type: 'day' | 'night'
  role: 'staff' | 'lead'
  day_of_cycle: number
}

type SerializableShiftRow = {
  user_id: string
  date: string
  shift_type: 'day' | 'night'
  role: 'staff' | 'lead'
}

export type ShiftInsertRow = {
  user_id: string
  date: string
  shift_type: 'day' | 'night'
  status: 'scheduled'
  role: 'staff' | 'lead'
}

function dateDiffInDays(fromDate: string, toDate: string): number {
  const start = new Date(`${fromDate}T12:00:00`)
  const end = new Date(`${toDate}T12:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
}

export function serializeCycleShifts(
  shifts: SerializableShiftRow[],
  cycleStartDate: string
): TemplateShiftData[] {
  return shifts.map((shift) => ({
    user_id: shift.user_id,
    shift_type: shift.shift_type,
    role: shift.role,
    day_of_cycle: dateDiffInDays(cycleStartDate, shift.date),
  }))
}

export function applyTemplateToCycle(
  templateData: TemplateShiftData[],
  newCycleStartDate: string,
  activeProfileIds: Set<string>
): ShiftInsertRow[] {
  const rows: ShiftInsertRow[] = []

  for (const row of templateData) {
    if (!activeProfileIds.has(row.user_id)) {
      console.warn('[cycle-template] Skipping inactive or missing profile:', row.user_id)
      continue
    }

    rows.push({
      user_id: row.user_id,
      date: toIsoDate(addDays(new Date(`${newCycleStartDate}T00:00:00`), row.day_of_cycle)),
      shift_type: row.shift_type,
      status: 'scheduled',
      role: row.role,
    })
  }

  return rows
}
