export type Role = 'manager' | 'therapist'

export type ViewMode = 'grid' | 'list' | 'calendar' | 'week'

export type ToastVariant = 'success' | 'error'

export type ShiftStatus = 'scheduled' | 'on_call' | 'sick' | 'called_off'
export type ShiftRole = 'lead' | 'staff'
export type AssignmentStatus = 'scheduled' | 'call_in' | 'cancelled' | 'on_call' | 'left_early'
export type EmploymentType = 'full_time' | 'part_time' | 'prn'

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
  employment_type: EmploymentType
  max_work_days_per_week: number
  preferred_work_days: number[]
  on_fmla: boolean
  fmla_return_date: string | null
  is_active: boolean
}

export type ShiftRow = {
  id: string
  date: string
  shift_type: 'day' | 'night'
  status: ShiftStatus
  assignment_status: AssignmentStatus
  status_note: string | null
  left_early_time: string | null
  status_updated_at: string | null
  status_updated_by: string | null
  availability_override: boolean
  availability_override_reason: string | null
  availability_override_at: string | null
  availability_override_by: string | null
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
  panel?: string
  add_date?: string
  add_shift_type?: string
  success?: string
  auto?: string
  added?: string
  unfilled?: string
  copied?: string
  skipped?: string
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
  focus_slot?: string
  show_unavailable?: string
  draft?: string
  removed?: string
  dropped?: string
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

export type AvailabilityEntryRow = {
  therapist_id: string
  date: string
  shift_type: 'day' | 'night' | 'both'
  entry_type: 'unavailable' | 'available'
}

export type CalendarShift = {
  id: string
  date: string
  shift_type: 'day' | 'night'
  status: ShiftStatus
  assignment_status: AssignmentStatus
  status_note: string | null
  left_early_time: string | null
  status_updated_at: string | null
  status_updated_by: string | null
  status_updated_by_name: string | null
  availability_override: boolean
  availability_override_reason: string | null
  availability_override_at: string | null
  availability_override_by: string | null
  availability_override_by_name: string | null
  role: ShiftRole
  user_id: string
  full_name: string
  isLeadEligible: boolean
}
