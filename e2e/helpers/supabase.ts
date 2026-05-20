import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { getEnv } from './env'

let warnedAboutMissingSeededEnv = false

type E2ERole = 'manager' | 'therapist' | 'lead'
type E2EEmploymentType = 'full_time' | 'part_time' | 'prn'
type E2EShiftType = 'day' | 'night'

type E2EUserPayload = {
  email: string
  password: string
  fullName: string
  role: E2ERole
  employmentType: E2EEmploymentType
  shiftType: E2EShiftType
  isLeadEligible?: boolean
  maxWorkDaysPerWeek?: number
  siteId?: string
}

export function createServiceRoleClientOrNull(): SupabaseClient | null {
  const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    if (!warnedAboutMissingSeededEnv) {
      console.warn(
        'Seeded E2E coverage is reduced: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.'
      )
      warnedAboutMissingSeededEnv = true
    }
    return null
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function createE2EUser(
  supabase: SupabaseClient,
  payload: E2EUserPayload
): Promise<{ id: string }> {
  const createResult = await supabase.auth.admin.createUser({
    email: payload.email,
    password: payload.password,
    email_confirm: true,
    user_metadata: { full_name: payload.fullName },
  })

  if (createResult.error || !createResult.data.user) {
    throw new Error(
      `Could not create test user ${payload.email}: ${createResult.error?.message ?? 'unknown error'}`
    )
  }

  const userId = createResult.data.user.id
  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      id: userId,
      full_name: payload.fullName,
      email: payload.email,
      role: payload.role,
      access_status: 'approved',
      shift_type: payload.shiftType,
      employment_type: payload.employmentType,
      max_work_days_per_week:
        payload.maxWorkDaysPerWeek ?? (payload.employmentType === 'prn' ? 1 : 3),
      preferred_work_days: [],
      is_lead_eligible: payload.isLeadEligible ?? payload.role === 'lead',
      on_fmla: false,
      is_active: true,
      site_id: payload.siteId ?? 'default',
    },
    { onConflict: 'id' }
  )

  if (profileError) {
    throw new Error(`Could not upsert profile for ${payload.email}: ${profileError.message}`)
  }

  return { id: userId }
}
