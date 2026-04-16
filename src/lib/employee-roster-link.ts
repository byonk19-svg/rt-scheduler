import { normalizeRosterFullName } from '@/lib/employee-roster-bulk'
import { createAdminClient } from '@/lib/supabase/admin'

type LinkableProfile = {
  id: string
  full_name: string | null
  email: string | null
}

export async function linkEmployeeRosterToProfile(profile: LinkableProfile) {
  const normalizedName = normalizeRosterFullName(profile.full_name ?? '')
  if (!normalizedName) return

  const admin = createAdminClient()
  const { error } = await admin
    .from('employee_roster')
    .update({
      matched_profile_id: profile.id,
      matched_email: profile.email ?? '',
      matched_at: new Date().toISOString(),
    })
    .eq('normalized_full_name', normalizedName)
    .eq('is_active', true)
    .is('matched_profile_id', null)

  if (error) {
    console.error('Failed to link approved profile to employee roster:', error)
  }
}
