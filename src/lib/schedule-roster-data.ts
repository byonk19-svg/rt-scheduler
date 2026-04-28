import {
  createAssignmentKey,
  type AssignmentStore,
  type AvailabilityApprovalKind,
  type AvailabilityApprovalStore,
  type RosterKind,
  type RosterShiftStatus,
  type Staff,
  type ShiftType,
} from '@/lib/mock-coverage-roster'

export type LiveRosterShiftRow = {
  id: string
  user_id: string
  date: string
  shift_type: 'day' | 'night'
  assignment_status?: string | null
}

const VALID_SHIFT_STATUSES = new Set<string>([
  'scheduled',
  'on_call',
  'cancelled',
  'left_early',
  'call_in',
])

function toRosterShiftStatus(raw: string | null | undefined): RosterShiftStatus | null {
  if (raw && VALID_SHIFT_STATUSES.has(raw)) return raw as RosterShiftStatus
  return null
}

export type LiveRosterOverrideRow = {
  therapist_id: string
  date: string
  shift_type: 'day' | 'night' | 'both'
  override_type: 'force_off' | 'force_on'
}

export type ScheduleRosterStaff = Staff & {
  shiftType: ShiftType
}

export function buildAssignmentStoreFromShifts(shifts: LiveRosterShiftRow[]): AssignmentStore {
  const store: AssignmentStore = {}
  for (const row of shifts) {
    if (!row.user_id || !row.date) continue
    const shiftType: ShiftType = row.shift_type === 'night' ? 'night' : 'day'
    const key = createAssignmentKey(row.user_id, row.date, shiftType)
    store[key] = {
      id: row.id,
      staffId: row.user_id,
      isoDate: row.date,
      shiftType,
      status: 'assigned',
      assignmentStatus: toRosterShiftStatus(row.assignment_status),
    }
  }
  return store
}

function shiftTypesForOverrideRow(shiftType: LiveRosterOverrideRow['shift_type']): ShiftType[] {
  if (shiftType === 'both') return ['day', 'night']
  return [shiftType === 'night' ? 'night' : 'day']
}

function splitStaffByRosterKind(
  staff: readonly ScheduleRosterStaff[],
  rosterKind: RosterKind
): ScheduleRosterStaff[] {
  return staff.filter((member) => member.rosterKind === rosterKind)
}

export function splitStaffByRosterAndShift(
  staff: readonly ScheduleRosterStaff[],
  shiftType: ShiftType
): { core: ScheduleRosterStaff[]; prn: ScheduleRosterStaff[] } {
  const shiftStaff = staff.filter((member) => member.shiftType === shiftType)

  return {
    core: splitStaffByRosterKind(shiftStaff, 'core'),
    prn: splitStaffByRosterKind(shiftStaff, 'prn'),
  }
}

/** Maps therapist-submitted overrides to mock-roster approval cells; only for therapists in `submittedTherapistIds`. */
export function buildAvailabilityApprovalStoreFromSubmittedOverrides(
  overrides: LiveRosterOverrideRow[],
  submittedTherapistIds: Set<string>
): AvailabilityApprovalStore {
  const store: AvailabilityApprovalStore = {}
  for (const row of overrides) {
    if (!submittedTherapistIds.has(row.therapist_id) || !row.date) continue
    const approvalKind: AvailabilityApprovalKind =
      row.override_type === 'force_off' ? 'approved_off' : 'approved_work'
    for (const st of shiftTypesForOverrideRow(row.shift_type)) {
      const key = createAssignmentKey(row.therapist_id, row.date, st)
      store[key] = approvalKind
    }
  }
  return store
}
