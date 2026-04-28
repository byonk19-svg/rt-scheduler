import type {
  RequestKind,
  RecipientResponse,
  RequestStatus,
  RequestType,
  RequestVisibility,
} from '@/lib/request-workflow'
import type { ShiftType } from '@/lib/shift-types'

export type MyShift = {
  id: string
  isoDate: string
  date: string
  dow: string
  type: 'Day' | 'Night'
  shiftType: ShiftType
  isLead: boolean
}

export type TeamMember = {
  id: string
  name: string
  avatar: string
  shift: 'Day' | 'Night'
  isLead: boolean
}

export type OpenRequest = {
  id: string
  createdAt: string
  type: RequestType
  visibility: RequestVisibility
  involvement: 'posted' | 'received_direct' | 'claimed' | 'interest'
  sourcePostId: string | null
  recipientResponse: RecipientResponse | null
  requestKind: RequestKind
  shift: string
  status: RequestStatus
  swapWith: string | null
  posted: string
  message: string
}

export const REQUEST_STATUS_META: Record<
  RequestStatus,
  { label: string; colorClass: string; bgClass: string; borderClass: string }
> = {
  pending: {
    label: 'Pending',
    colorClass: 'text-[var(--warning-text)]',
    bgClass: 'bg-[var(--warning-subtle)]',
    borderClass: 'border-[var(--warning-border)]',
  },
  approved: {
    label: 'Approved',
    colorClass: 'text-[var(--success-text)]',
    bgClass: 'bg-[var(--success-subtle)]',
    borderClass: 'border-[var(--success-border)]',
  },
  denied: {
    label: 'Denied',
    colorClass: 'text-[var(--error-text)]',
    bgClass: 'bg-[var(--error-subtle)]',
    borderClass: 'border-[var(--error-border)]',
  },
  selected: {
    label: 'Selected',
    colorClass: 'text-[var(--success-text)]',
    bgClass: 'bg-[var(--success-subtle)]',
    borderClass: 'border-[var(--success-border)]',
  },
  withdrawn: {
    label: 'Withdrawn',
    colorClass: 'text-muted-foreground',
    bgClass: 'bg-muted',
    borderClass: 'border-border',
  },
  expired: {
    label: 'Expired',
    colorClass: 'text-muted-foreground',
    bgClass: 'bg-muted',
    borderClass: 'border-border',
  },
}
