import type { ShiftRole, ShiftStatus } from '@/app/schedule/types'

export type PreliminarySnapshotStatus = 'active' | 'superseded' | 'closed'
export type PreliminaryShiftState =
  | 'tentative_assignment'
  | 'open'
  | 'pending_claim'
  | 'pending_change'
export type PreliminaryRequestType = 'claim_open_shift' | 'request_change'
export type PreliminaryRequestStatus = 'pending' | 'approved' | 'denied' | 'cancelled'

export type PreliminarySnapshotRow = {
  id: string
  cycle_id: string
  created_by: string
  sent_at: string
  status: PreliminarySnapshotStatus
  created_at: string
}

export type PreliminaryShiftStateRow = {
  id: string
  snapshot_id: string
  shift_id: string
  state: PreliminaryShiftState
  reserved_by: string | null
  active_request_id: string | null
  updated_at: string
}

export type PreliminaryShiftRow = {
  id: string
  cycle_id: string | null
  user_id: string | null
  date: string
  shift_type: 'day' | 'night'
  status: ShiftStatus
  role: ShiftRole
  full_name: string | null
}

export type PreliminaryRequestRow = {
  id: string
  snapshot_id: string
  shift_id: string
  requester_id: string
  type: PreliminaryRequestType
  status: PreliminaryRequestStatus
  note: string | null
  decision_note: string | null
  approved_by: string | null
  approved_at: string | null
  created_at: string
  requester_name: string | null
}

export type PreliminaryShiftCard = {
  shiftId: string
  shiftDate: string
  shiftType: 'day' | 'night'
  shiftRole: ShiftRole
  assignedUserId: string | null
  assignedName: string | null
  state: PreliminaryShiftState
  reservedById: string | null
  requestId: string | null
  canClaim: boolean
  canRequestChange: boolean
}

export type PreliminaryHistoryItem = {
  id: string
  requestId: string
  shiftId: string
  shiftDate: string
  shiftType: 'day' | 'night'
  requestType: PreliminaryRequestType
  status: PreliminaryRequestStatus
  note: string | null
  createdAt: string
}

export type ManagerPreliminaryQueueItem = {
  id: string
  shiftId: string
  shiftDate: string
  shiftType: 'day' | 'night'
  requesterId: string
  requesterName: string
  requestType: PreliminaryRequestType
  status: PreliminaryRequestStatus
  note: string | null
  createdAt: string
}

export type SendPreliminarySnapshotParams = {
  cycleId: string
  actorId: string
  shifts: PreliminaryShiftRow[]
}

export type RefreshPreliminarySnapshotParams = {
  snapshotId: string
  shifts: PreliminaryShiftRow[]
}

export type SubmitPreliminaryRequestParams = {
  snapshotId: string
  shiftId: string
  requesterId: string
  note?: string | null
}

export type ReviewPreliminaryRequestParams = {
  requestId: string
  actorId: string
  decisionNote?: string | null
}

export type CancelPreliminaryRequestParams = {
  requestId: string
  requesterId: string
}
