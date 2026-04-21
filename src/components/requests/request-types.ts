export type RequestType = 'swap' | 'pickup'
export type PersistedRequestStatus = 'pending' | 'approved' | 'denied' | 'expired'
export type RequestStatus = PersistedRequestStatus | 'expired'
export type ShiftType = 'day' | 'night'
export type ShiftRole = 'lead' | 'staff'
export type ShiftStatus = 'scheduled' | 'on_call' | 'sick' | 'called_off'

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
  type: RequestType
  shift: string
  status: RequestStatus
  swapWith: string | null
  posted: string
  message: string
}
