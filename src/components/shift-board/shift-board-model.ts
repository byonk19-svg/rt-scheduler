'use client'

import type {
  RequestKind,
  RequestStatus as SharedRequestStatus,
  RequestType,
  RequestVisibility,
  RecipientResponse,
} from '@/lib/request-workflow'
import type { UiRole } from '@/lib/auth/roles'
import type { ShiftRole, ShiftType } from '@/lib/shift-types'
import { MIN_SHIFT_COVERAGE_PER_DAY } from '@/lib/scheduling-constants'

export type Role = UiRole
export type RequestStatus = Exclude<SharedRequestStatus, 'selected'>

export type ProfileLookupRow = {
  id: string
  full_name: string | null
  role?: string | null
  is_lead_eligible?: boolean | null
  employment_type?: string | null
}

export type ShiftBoardRequest = {
  id: string
  type: RequestType
  visibility: RequestVisibility
  recipientResponse: RecipientResponse | null
  requestKind: RequestKind
  poster: string
  postedById: string | null
  avatar: string
  shift: string
  shiftDate: string | null
  shiftCycleId: string | null
  shiftId: string | null
  swapShift: string | null
  swapShiftDate: string | null
  swapShiftId: string | null
  swapShiftType: ShiftType | null
  swapShiftRole: ShiftRole | null
  message: string
  status: RequestStatus
  posted: string
  postedAt: string
  swapWithName: string | null
  swapWithId: string | null
  claimedById: string | null
  pendingInterestCount: number
  hasMyInterest: boolean
  myInterestId: string | null
  myInterestStatus: 'pending' | 'selected' | null
  interestCandidates: Array<{
    id: string
    therapistId: string
    therapistName: string
    createdAt: string
    status: 'pending' | 'selected'
  }>
  shiftType: ShiftType | null
  shiftRole: ShiftRole | null
  overrideReason: string | null
}

export type MetricState = {
  unfilled: number
  missingLead: number
}

export type ShiftBoardInitialSnapshot = {
  role: Role
  requests: ShiftBoardRequest[]
  metrics: MetricState
  pendingCount: number
  currentUserId: string
  therapists: ProfileLookupRow[]
  employmentType: string | null
  scheduledByDateEntries: Array<[string, Array<[string, ShiftType]>]>
  scheduledByCycleDateEntries: Array<[string, Array<[string, ShiftType]>]>
}

export const HISTORY_STATUSES: RequestStatus[] = ['approved', 'denied', 'expired', 'withdrawn']
export type ShiftBoardSection = 'needs-action' | 'open-shifts' | 'waiting' | 'history'
export type TypeFilter = 'all' | RequestType | 'give-up'
export type ShiftFilter = 'all' | ShiftType
export type StatusFilter =
  | 'all'
  | 'needs-action'
  | 'waiting'
  | 'no-responders'
  | 'approved'
  | 'denied'

export const BOARD_SECTIONS: Array<{ id: ShiftBoardSection; label: string }> = [
  { id: 'needs-action', label: 'Needs Action' },
  { id: 'open-shifts', label: 'Open Shifts' },
  { id: 'waiting', label: 'Waiting' },
  { id: 'history', label: 'History' },
]

export function getRequestTypeLabel(req: ShiftBoardRequest): string {
  if (req.type === 'swap' && req.visibility === 'direct') return 'Direct Swap'
  if (req.type === 'swap') return req.swapWithId ? 'Swap' : 'Open Swap'
  if (req.requestKind === 'call_in') return 'Pickup'
  return 'Pickup'
}

export function isWaitingOnTeammate(req: ShiftBoardRequest): boolean {
  return (
    req.status === 'pending' && req.visibility === 'direct' && req.recipientResponse !== 'accepted'
  )
}

export function isOpenSwapWithoutPartner(req: ShiftBoardRequest): boolean {
  return (
    req.status === 'pending' && req.type === 'swap' && req.visibility === 'team' && !req.swapWithId
  )
}

function isPickupWithResponders(req: ShiftBoardRequest): boolean {
  return (
    req.status === 'pending' &&
    req.type === 'pickup' &&
    req.visibility === 'team' &&
    req.pendingInterestCount > 0
  )
}

export function isPickupWithoutResponders(req: ShiftBoardRequest): boolean {
  return (
    req.status === 'pending' &&
    req.type === 'pickup' &&
    req.visibility === 'team' &&
    req.pendingInterestCount === 0
  )
}

export function isReadyForManagerDecision(req: ShiftBoardRequest): boolean {
  if (req.status !== 'pending') return false
  if (isWaitingOnTeammate(req)) return false
  if (isPickupWithResponders(req)) return true
  if (req.type === 'pickup' && req.visibility === 'direct') {
    return req.recipientResponse === 'accepted' && Boolean(req.claimedById)
  }
  if (req.type === 'swap') return Boolean(req.swapWithId)
  return false
}

export function getPlainStateLabel(req: ShiftBoardRequest): string {
  if (req.status === 'approved') return 'Approved'
  if (req.status === 'denied') return 'Denied'
  if (req.status === 'withdrawn') return 'Withdrawn'
  if (req.status === 'expired') return 'Expired'
  if (isWaitingOnTeammate(req)) return 'Waiting on teammate'
  if (isPickupWithoutResponders(req)) return 'No responders yet'
  if (isOpenSwapWithoutPartner(req)) return 'Needs swap partner'
  if (isReadyForManagerDecision(req)) return 'Ready for decision'
  return 'Waiting'
}

export function getStateTone(
  req: ShiftBoardRequest
): 'success' | 'warning' | 'muted' | 'error' | 'info' {
  const state = getPlainStateLabel(req)
  if (state === 'Approved') return 'success'
  if (state === 'Denied') return 'error'
  if (state === 'Ready for decision' || state === 'Needs swap partner') return 'warning'
  if (state === 'Waiting on teammate' || state === 'No responders yet') return 'muted'
  return 'info'
}

export function getToneClasses(tone: 'success' | 'warning' | 'muted' | 'error' | 'info'): string {
  if (tone === 'success') {
    return 'border-[var(--success-border)] bg-[var(--success-subtle)] text-[var(--success-text)]'
  }
  if (tone === 'warning') {
    return 'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
  }
  if (tone === 'error') {
    return 'border-[var(--error-border)] bg-[var(--error-subtle)] text-[var(--error-text)]'
  }
  if (tone === 'info') {
    return 'border-[var(--info-border)] bg-[var(--info-subtle)] text-[var(--info-text)]'
  }
  return 'border-border bg-muted text-muted-foreground'
}

export function countStaffForShift(
  scheduledOnDate: Map<string, ShiftType>,
  shiftType: ShiftType | null
): number {
  if (!shiftType) return scheduledOnDate.size
  return Array.from(scheduledOnDate.values()).filter((value) => value === shiftType).length
}

export function getStaffingVerdict(staffCount: number): 'Below minimum' | 'Covered' | 'Target met' {
  if (staffCount < MIN_SHIFT_COVERAGE_PER_DAY) return 'Below minimum'
  if (staffCount === MIN_SHIFT_COVERAGE_PER_DAY) return 'Covered'
  return 'Target met'
}

export function getStaffingTone(verdict: string): 'success' | 'error' {
  return verdict === 'Below minimum' ? 'error' : 'success'
}

export function formatShiftType(value: ShiftType | null): string {
  if (value === 'day') return 'Day'
  if (value === 'night') return 'Night'
  return 'Shift'
}

export function formatScheduleBlockRange(requests: ShiftBoardRequest[]): string {
  const dates = requests
    .map((request) => request.shiftDate)
    .filter((value): value is string => Boolean(value))
    .sort()
  if (dates.length === 0) return 'Current Schedule Block'
  const first = dates[0]
  const last = dates[dates.length - 1] ?? first
  const format = (value: string, includeYear: boolean) =>
    new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: includeYear ? 'numeric' : undefined,
    })
  return first === last ? format(first, true) : `${format(first, false)} - ${format(last, true)}`
}

export function getRequestMessageForDisplay(message: string): string | null {
  const trimmed = message.trim()
  if (!trimmed) return null
  if (/\b(seed|seeded|demo|test user)\b/i.test(trimmed)) return null
  return trimmed
    .replace(/\bcurrent primary pending claimant\b/gi, 'first responder')
    .replace(/\bpending claimant(s)?\b/gi, (_match, plural) =>
      plural ? 'pending responders' : 'pending responder'
    )
    .replace(/\bclaimant(s)?\b/gi, (_match, plural) => (plural ? 'responders' : 'responder'))
}

export function getRequestActionModel({
  req,
  canReview,
  hasSwapPartner,
  hasBackupResponder,
}: {
  req: Pick<
    ShiftBoardRequest,
    | 'status'
    | 'type'
    | 'visibility'
    | 'recipientResponse'
    | 'pendingInterestCount'
    | 'swapWithId'
    | 'claimedById'
  >
  canReview: boolean
  hasSwapPartner: boolean
  hasBackupResponder: boolean
}): { primary: string; secondary: string[]; showsApprove: boolean } {
  if (!canReview) {
    return {
      primary: req.type === 'pickup' && req.visibility === 'team' ? 'Respond' : 'View shift',
      secondary: req.type === 'pickup' && req.visibility === 'team' ? ['View shift'] : [],
      showsApprove: false,
    }
  }

  if (isWaitingOnTeammate(req as ShiftBoardRequest)) {
    return { primary: 'View request', secondary: ['Cancel request'], showsApprove: false }
  }

  if (isOpenSwapWithoutPartner(req as ShiftBoardRequest) && !hasSwapPartner) {
    return { primary: 'Choose partner', secondary: ['View shifts'], showsApprove: false }
  }

  if (isPickupWithoutResponders(req as ShiftBoardRequest)) {
    return {
      primary: 'View open post',
      secondary: ['Add coverage manually'],
      showsApprove: false,
    }
  }

  if (req.status !== 'pending') {
    return { primary: 'View shift', secondary: [], showsApprove: false }
  }

  if (req.type === 'swap') {
    return {
      primary: 'Approve swap',
      secondary: ['Deny request', 'View shifts'],
      showsApprove: true,
    }
  }

  return {
    primary: 'Approve pickup',
    secondary: [...(hasBackupResponder ? ['Change responder'] : []), 'Deny request', 'View shift'],
    showsApprove: true,
  }
}

export function toReviewErrorMessage(message: string): string {
  return message.includes('Team-visible swap approvals require a swap partner')
    ? 'Cannot approve: this swap request has no partner assigned. Select a swap partner first.'
    : message.includes('shifts_unique_cycle_user_date')
      ? 'Cannot approve: the selected swap partner is already scheduled on this date.'
      : message.includes('partner shift type mismatch')
        ? 'Cannot approve: swap partners must be scheduled on the same shift type.'
        : message.includes('operational code')
          ? 'Cannot approve: shifts with active operational codes are locked from swaps.'
          : message.includes('working scheduled shift')
            ? 'Cannot approve: both swap partners must have working scheduled shifts.'
            : message.includes('Lead coverage gap')
              ? 'override:Lead coverage gap - approving this request would leave a shift without a lead. You can force-approve below.'
              : message.includes('Double booking')
                ? 'Cannot approve: double booking. This therapist is already assigned to this shift.'
                : 'Could not save this request. Refresh the board and try again.'
}
