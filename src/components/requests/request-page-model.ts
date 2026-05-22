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
  verdict?: 'coverage_safe' | 'needs_manager_review' | 'not_allowed'
  consequence?: string | null
  nextMove?: string | null
  availabilityReason?: string | null
  currentShiftLabel?: string | null
  isBestOption?: boolean
}

export type OpenRequest = {
  id: string
  createdAt: string
  recipientRespondedAt: string | null
  type: RequestType
  visibility: RequestVisibility
  involvement: 'posted' | 'received_direct' | 'claimed' | 'interest'
  sourcePostId: string | null
  recipientResponse: RecipientResponse | null
  requestKind: RequestKind
  shift: string
  status: RequestStatus
  stageLabel: string
  stageDetail: string | null
  swapWith: string | null
  posted: string
  message: string
}
