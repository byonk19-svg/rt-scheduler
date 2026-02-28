import type { UiRole } from '@/lib/auth/roles'
// Core domain primitives live in @/lib/shift-types; imported here for local use and re-exported
// for backward compatibility so that the 17 callers of this module need no changes.
import type {
  ShiftStatus,
  ShiftRole,
  AssignmentStatus,
  EmploymentType,
  WeekendRotation,
  WorksDowMode,
} from '@/lib/shift-types'

export type { ShiftStatus, ShiftRole, AssignmentStatus, EmploymentType, WeekendRotation, WorksDowMode }

export type Role = UiRole

export type ViewMode = 'grid' | 'list' | 'calendar' | 'week'

export type ToastVariant = 'success' | 'error'

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
  works_dow: number[]
  offs_dow: number[]
  weekend_rotation: WeekendRotation
  weekend_anchor_date: string | null
  works_dow_mode: WorksDowMode
  shift_preference?: 'day' | 'night' | 'either' | null
  on_fmla: boolean
  fmla_return_date: string | null
  is_active: boolean
}

export type ShiftRow = {
  id: string
  date: string
  shift_type: 'day' | 'night'
  status: ShiftStatus
  unfilled_reason: string | null
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
    | { full_name: string; is_lead_eligible: boolean; employment_type?: EmploymentType | null }
    | { full_name: string; is_lead_eligible: boolean; employment_type?: EmploymentType | null }[]
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
  constraints_unfilled?: string
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
  publish_event_id?: string
  recipient_count?: string
  queued_count?: string
  sent_count?: string
  failed_count?: string
  published_at?: string
  email_configured?: string
  email_queue_error?: string
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

export type AvailabilityOverrideRow = {
  therapist_id: string
  cycle_id: string
  date: string
  shift_type: 'day' | 'night' | 'both'
  override_type: 'force_off' | 'force_on'
  note?: string | null
}

export type LegacyAvailabilityEntryRow = {
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
  unfilled_reason: string | null
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
