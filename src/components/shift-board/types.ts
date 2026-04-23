import type { UiRole } from '@/lib/auth/roles'

export type Role = UiRole
export type RequestType = 'swap' | 'pickup'
export type RequestStatus = 'pending' | 'approved' | 'denied' | 'expired'
export type ShiftType = 'day' | 'night'
export type ShiftRole = 'lead' | 'staff'

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
  poster: string
  postedById: string | null
  avatar: string
  shift: string
  shiftDate: string | null
  shiftId: string | null
  message: string
  status: RequestStatus
  posted: string
  postedAt: string
  swapWithName: string | null
  swapWithId: string | null
  claimedById: string | null
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
}

export const STATUS_META: Record<
  RequestStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  pending: {
    label: 'Pending',
    color: 'var(--warning-text)',
    bg: 'var(--warning-subtle)',
    border: 'var(--warning-border)',
  },
  approved: {
    label: 'Approved',
    color: 'var(--success-text)',
    bg: 'var(--success-subtle)',
    border: 'var(--success-border)',
  },
  denied: {
    label: 'Denied',
    color: 'var(--error-text)',
    bg: 'var(--error-subtle)',
    border: 'var(--error-border)',
  },
  expired: {
    label: 'Expired',
    color: 'var(--muted-foreground)',
    bg: 'var(--muted)',
    border: 'var(--border)',
  },
}

export const TYPE_META: Record<
  RequestType,
  { label: string; color: string; bg: string; border: string }
> = {
  swap: {
    label: 'Swap',
    color: 'var(--info-text)',
    bg: 'var(--info-subtle)',
    border: 'var(--info-border)',
  },
  pickup: {
    label: 'Pickup',
    color: 'var(--primary)',
    bg: 'var(--secondary)',
    border: 'var(--border)',
  },
}

export const HISTORY_STATUSES: RequestStatus[] = ['approved', 'denied', 'expired']
