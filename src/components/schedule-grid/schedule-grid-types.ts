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
  employmentType: 'full_time' | 'part_time' | 'prn'
  shiftType: 'day' | 'night'
  cells: Record<string, GridCell>
}

export type ScheduleInteractionModeKind =
  | 'staff_view'
  | 'lead_status'
  | 'manager_edit'
  | 'combined_readonly'

export type ScheduleInteractionMode = {
  kind: ScheduleInteractionModeKind
  canUseManagerToolbar: boolean
  canAssignShifts: boolean
  canUnassignShifts: boolean
  canDesignateLead: boolean
  canUpdateAssignmentStatus: boolean
}

export type GridDataset = {
  cycleId: string
  shiftType: 'day' | 'night'
  interactionMode: ScheduleInteractionMode
  availableCycles: Array<{ id: string; label: string }>
  cycleDates: string[]
  cycleDateRangeLabel: string
  isPublished: boolean
  cycleStatus: 'draft' | 'preliminary' | 'final' | 'offline' | 'archived' | null
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
