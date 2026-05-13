export type GridCellStatus =
  | 'lead'
  | 'staff'
  | 'on_call'
  | 'cancelled'
  | 'call_in'
  | 'left_early'
  | 'off'

export type GridCell = {
  shiftId: string | null
  status: GridCellStatus
  hasNeedsOff: boolean
  isIneligible: boolean
}

export type TherapistGridRow = {
  userId: string
  name: string
  isOnFmla: boolean
  isActive: boolean
  shiftType: 'day' | 'night'
  cells: Record<string, GridCell>
}

export type GridDataset = {
  cycleId: string
  shiftType: 'day' | 'night'
  availableCycles: Array<{ id: string; label: string }>
  cycleDates: string[]
  cycleDateRangeLabel: string
  isPublished: boolean
  therapistRows: TherapistGridRow[]
  dailyTotals: Record<string, number>
  viewerUserId: string
  viewerRole: 'manager' | 'lead' | 'therapist' | null
  canManageCoverage: boolean
  canUpdateAssignmentStatus: boolean
}

export type ScheduleGridPreFlightSummary = {
  unfilledSlots: number
  missingLeadSlots: number
  forcedMustWorkMisses: number
  details: Array<{ date: string; shiftType: 'day' | 'night'; missingCount: number }>
}
