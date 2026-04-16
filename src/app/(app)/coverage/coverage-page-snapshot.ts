import type { RosterMemberRow } from '@/components/coverage/RosterScheduleView'
import type { Role } from '@/lib/auth/roles'
import type { CoverageScheduleCycleRow } from '@/lib/coverage/fetch-schedule-cycles'
import type { DayItem, ShiftTab } from '@/lib/coverage/selectors'
import type { ShiftStatus } from '@/lib/shift-types'

export type CycleRow = CoverageScheduleCycleRow

export type TherapistOption = {
  id: string
  full_name: string
  role?: 'therapist' | 'lead'
  shift_type: 'day' | 'night'
  isLeadEligible: boolean
  employment_type: string | null
  max_work_days_per_week: number | null
}

export type PrintTherapist = {
  id: string
  full_name: string
  role?: 'therapist' | 'lead'
  shift_type: 'day' | 'night'
  employment_type?: 'full_time' | 'part_time' | 'prn'
}

export type PreliminarySnapshotRow = {
  id: string
  sent_at: string
}

export type CoveragePageSnapshot = {
  actorScheduleShift: {
    resolved: boolean
    type: 'day' | 'night' | null
  }
  activeCycleId: string | null
  activeCyclePublished: boolean
  activePreliminarySnapshot: PreliminarySnapshotRow | null
  availableCycles: CycleRow[]
  printCycle: { label: string; start_date: string; end_date: string } | null
  printCycleDates: string[]
  printDayTeam: PrintTherapist[]
  printNightTeam: PrintTherapist[]
  printUsers: PrintTherapist[]
  printShiftByUserDate: Record<string, ShiftStatus>
  allTherapists: TherapistOption[]
  rosterProfiles: RosterMemberRow[]
  activeOpCodes: Record<string, string>
  dayDays: DayItem[]
  nightDays: DayItem[]
  selectedCycleHasShiftRows: boolean
  canManageCoverage: boolean
  canUpdateAssignmentStatus: boolean
  actorRole: Role | null
  error: string
}

export type CoveragePageServerData = {
  initialShiftTab: ShiftTab
  shiftTabLockedFromUrl: boolean
  initialViewMode: 'week' | 'calendar' | 'roster'
  initialSnapshot: CoveragePageSnapshot
}
