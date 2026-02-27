export type ShiftTypeForAvailability = 'day' | 'night' | 'both'

export type AvailabilityOverrideType = 'force_off' | 'force_on'

export type AvailabilityOverrideRow = {
  id?: string
  cycle_id: string
  therapist_id: string
  date: string
  shift_type: ShiftTypeForAvailability
  override_type: AvailabilityOverrideType
  note?: string | null
  created_by?: string
  created_at?: string
}
