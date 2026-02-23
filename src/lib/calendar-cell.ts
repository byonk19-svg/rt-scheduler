import type { ShiftRole, ShiftStatus } from '@/app/schedule/types'

type CalendarCellShift = {
  id: string
  full_name: string
  shift_type: 'day' | 'night'
  role: ShiftRole
  status: ShiftStatus
}

type CalendarCellSummary = {
  leadName: string | null
  missingLead: boolean
  coverageCount: number
  visibleShifts: CalendarCellShift[]
  hiddenCount: number
}

function countsTowardCoverage(status: ShiftStatus): boolean {
  return status === 'scheduled' || status === 'on_call'
}

export function summarizeCalendarCell(
  shifts: CalendarCellShift[],
  maxVisible = 3
): CalendarCellSummary {
  const sorted = shifts.slice().sort((a, b) => {
    if (a.role !== b.role) return a.role === 'lead' ? -1 : 1
    return a.full_name.localeCompare(b.full_name)
  })

  const lead = sorted.find((shift) => shift.role === 'lead') ?? null
  const coverageCount = sorted.filter((shift) => countsTowardCoverage(shift.status)).length
  const visibleShifts = sorted.slice(0, maxVisible)
  const hiddenCount = Math.max(sorted.length - maxVisible, 0)

  return {
    leadName: lead?.full_name ?? null,
    missingLead: !lead,
    coverageCount,
    visibleShifts,
    hiddenCount,
  }
}
