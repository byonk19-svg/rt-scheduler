export type WorkPatternRecord = {
  works_dow: number[]
  offs_dow: number[]
  works_dow_mode: 'hard' | 'soft'
  weekend_rotation: 'none' | 'every_other'
  weekend_anchor_date: string | null
}

export type TeamProfileRecord = {
  id: string
  full_name: string | null
  role: 'manager' | 'therapist' | 'lead' | null
  shift_type: 'day' | 'night' | null
  employment_type: 'full_time' | 'part_time' | 'prn' | null
  is_lead_eligible: boolean | null
  is_active: boolean | null
  on_fmla: boolean | null
  fmla_return_date: string | null
  phone_number?: string | null
}

export const TEAM_QUICK_EDIT_DIALOG_CLASS =
  'max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-[560px]'
export const TEAM_LEAD_ROLE_LABEL = 'Lead Therapist'

type ShiftBucket = 'day' | 'night'

export type TeamDirectorySections = {
  managers: TeamProfileRecord[]
  inactive: TeamProfileRecord[]
  dayLeads: TeamProfileRecord[]
  dayTherapists: TeamProfileRecord[]
  nightLeads: TeamProfileRecord[]
  nightTherapists: TeamProfileRecord[]
}

function shiftBucket(type: TeamProfileRecord['shift_type']): ShiftBucket {
  return type === 'night' ? 'night' : 'day'
}

export function teamMemberHasAppAccess(profile: Pick<TeamProfileRecord, 'is_active'>): boolean {
  return profile.is_active !== false
}

export function partitionTeamProfiles(profiles: TeamProfileRecord[]): TeamDirectorySections {
  const sections: TeamDirectorySections = {
    managers: [],
    inactive: [],
    dayLeads: [],
    dayTherapists: [],
    nightLeads: [],
    nightTherapists: [],
  }

  for (const profile of profiles) {
    if (!teamMemberHasAppAccess(profile)) {
      sections.inactive.push(profile)
      continue
    }

    if (profile.role === 'manager') {
      sections.managers.push(profile)
      continue
    }

    const bucket = shiftBucket(profile.shift_type)
    if (profile.role === 'lead') {
      if (bucket === 'night') sections.nightLeads.push(profile)
      else sections.dayLeads.push(profile)
      continue
    }

    if (bucket === 'night') sections.nightTherapists.push(profile)
    else sections.dayTherapists.push(profile)
  }

  return sections
}

export type TeamSummaryCounts = {
  totalStaff: number
  managers: number
  leadTherapists: number
  therapists: number
  dayShift: number
  nightShift: number
  inactive: number
  onFmla: number
}
