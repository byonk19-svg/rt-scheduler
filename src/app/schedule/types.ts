export type Role = 'manager' | 'therapist'

export type ViewMode = 'grid' | 'list' | 'calendar'

export type ToastVariant = 'success' | 'error'

export type ShiftStatus = 'scheduled' | 'on_call' | 'sick' | 'called_off'
export type ShiftRole = 'lead' | 'staff'

export type Cycle = {
  id: string
  label: string
  start_date: string
  end_date: string
  published: boolean
}

export type Therapist = {
  id: string
  full_name: string
  shift_type: 'day' | 'night'
  is_lead_eligible: boolean
}

export type ShiftRow = {
  id: string
  date: string
  shift_type: 'day' | 'night'
  status: ShiftStatus
  role: ShiftRole
  user_id: string
  profiles:
    | { full_name: string; is_lead_eligible: boolean }
    | { full_name: string; is_lead_eligible: boolean }[]
    | null
}

export type ScheduleSearchParams = {
  cycle?: string
  view?: string
  auto?: string
  added?: string
  unfilled?: string
  error?: string
  week_start?: string
  week_end?: string
  violations?: string
  under?: string
  over?: string
  under_coverage?: string
  over_coverage?: string
  lead_missing?: string
  lead_ineligible?: string
  lead_multiple?: string
  affected?: string
  set_lead_error?: string
  filter?: string
  focus?: string
}

export type AutoScheduleShiftRow = {
  user_id: string
  date: string
  shift_type: 'day' | 'night'
  status: ShiftStatus
  role: ShiftRole
}

export type ShiftLimitRow = {
  user_id: string
  date: string
  status: ShiftStatus
}

export type AvailabilityDateRow = {
  user_id: string
  date: string
}

export type CalendarShift = {
  id: string
  date: string
  shift_type: 'day' | 'night'
  status: ShiftStatus
  role: ShiftRole
  user_id: string
  full_name: string
  isLeadEligible: boolean
}
