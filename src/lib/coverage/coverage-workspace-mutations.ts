import type { CoverageMutationError } from '@/lib/coverage/mutations'
import { toUiStatus, type DayItem, type ShiftItem, type UiStatus } from '@/lib/coverage/selectors'
import { getCoverageStatusLabel } from '@/lib/coverage/status-ui'
import type { AssignmentStatus, ShiftStatus } from '@/lib/shift-types'

type AssignedCoverageShiftRow = {
  id: string
  user_id: string
  status: ShiftStatus
  assignment_status: AssignmentStatus | null
}

export function getCoverageAssignErrorMessage(
  error: CoverageMutationError,
  therapistName?: string | null
): string {
  if (error?.code === '23505') {
    return `${therapistName ?? 'This therapist'} is already assigned on this day.`
  }

  return error?.message ?? 'Could not assign therapist. Please try again.'
}

export function toCoverageShiftItem(
  row: AssignedCoverageShiftRow,
  therapistName?: string | null
): ShiftItem {
  return {
    id: row.id,
    userId: row.user_id,
    name: therapistName ?? 'Unknown',
    status: toUiStatus(row.assignment_status, row.status),
    log: [],
  }
}

export function applyCoverageAssignedShift(
  days: DayItem[],
  dayId: string,
  nextShift: ShiftItem,
  role: 'lead' | 'staff'
): DayItem[] {
  return days.map((day) => {
    if (day.id !== dayId) return day

    if (role === 'lead') {
      return {
        ...day,
        leadShift: nextShift,
        dayStatus: 'published',
      }
    }

    return {
      ...day,
      staffShifts: [...day.staffShifts, nextShift].sort((a, b) => a.name.localeCompare(b.name)),
    }
  })
}

export function removeCoverageShiftFromDays(
  days: DayItem[],
  dayId: string,
  shiftId: string,
  isLead: boolean
): DayItem[] {
  return days.map((day) => {
    if (day.id !== dayId) return day
    if (isLead) {
      return { ...day, leadShift: null }
    }

    return {
      ...day,
      staffShifts: day.staffShifts.filter((shift) => shift.id !== shiftId),
    }
  })
}

export function updateCoverageShiftStatusInDays({
  days,
  dayId,
  shiftId,
  isLead,
  nextStatus,
  previousStatus,
  changeTime,
  mode,
}: {
  days: DayItem[]
  dayId: string
  shiftId: string
  isLead: boolean
  nextStatus: UiStatus
  previousStatus: UiStatus
  changeTime: string
  mode: 'optimistic' | 'rollback'
}): DayItem[] {
  const optimisticFromLabel = getCoverageStatusLabel(previousStatus)
  const optimisticToLabel = getCoverageStatusLabel(nextStatus)

  const applyShiftStatus = (shift: ShiftItem | null): ShiftItem | null => {
    if (!shift || shift.id !== shiftId) return shift

    if (mode === 'optimistic') {
      if (shift.status === nextStatus) return shift
      return {
        ...shift,
        status: nextStatus,
        log: [
          ...shift.log,
          {
            from: optimisticFromLabel,
            to: nextStatus,
            toLabel: optimisticToLabel,
            time: changeTime,
          },
        ],
      }
    }

    const lastLog = shift.log[shift.log.length - 1]
    const isMatchingOptimisticLog =
      Boolean(lastLog) &&
      lastLog.from === optimisticFromLabel &&
      lastLog.to === nextStatus &&
      lastLog.toLabel === optimisticToLabel &&
      lastLog.time === changeTime

    if (!isMatchingOptimisticLog || shift.status !== nextStatus) {
      return shift
    }

    return {
      ...shift,
      status: previousStatus,
      log: shift.log.slice(0, -1),
    }
  }

  return days.map((day) => {
    if (day.id !== dayId) return day
    return {
      ...day,
      leadShift: isLead ? applyShiftStatus(day.leadShift) : day.leadShift,
      staffShifts: isLead
        ? day.staffShifts
        : day.staffShifts.map((shift) => applyShiftStatus(shift) as ShiftItem),
    }
  })
}
