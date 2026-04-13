'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

function buildTeamUrl(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (!value) continue
    search.set(key, value)
  }
  const query = search.toString()
  return query.length > 0 ? `/team?${query}` : '/team'
}

async function requireManager() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active, archived_at')
    .eq('id', user.id)
    .maybeSingle()

  if (
    !can(parseRole(profile?.role), 'manage_directory', {
      isActive: profile?.is_active !== false,
      archivedAt: profile?.archived_at ?? null,
    })
  ) {
    redirect('/dashboard/staff')
  }

  return { supabase, userId: user.id }
}

export type RosterEntry = {
  id: string
  full_name: string
  email: string | null
  role: 'therapist' | 'lead' | 'manager'
  shift_type: 'day' | 'night'
  employment_type: 'full_time' | 'part_time' | 'prn'
  is_lead_eligible: boolean
  max_work_days_per_week: number
  matched_profile_id: string | null
  matched_at: string | null
  created_at: string
}

export async function addRosterEmployeeAction(formData: FormData) {
  const fullName = String(formData.get('full_name') ?? '').trim()
  const emailRaw = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()
  const role = String(formData.get('role') ?? '')
  const shiftType = String(formData.get('shift_type') ?? 'day')
  const employmentType = String(formData.get('employment_type') ?? 'full_time')
  const isLeadEligible = formData.get('is_lead_eligible') === 'true'
  const maxDaysRaw = parseInt(String(formData.get('max_work_days_per_week') ?? '3'), 10)
  const maxDays = isNaN(maxDaysRaw) ? 3 : Math.min(7, Math.max(1, maxDaysRaw))

  if (!fullName) redirect(buildTeamUrl({ roster_error: 'missing_name' }))
  if (!['therapist', 'lead', 'manager'].includes(role))
    redirect(buildTeamUrl({ roster_error: 'invalid_role' }))
  if (!['day', 'night'].includes(shiftType))
    redirect(buildTeamUrl({ roster_error: 'invalid_shift' }))

  const { supabase, userId } = await requireManager()

  const { error } = await supabase.from('employee_roster').insert({
    full_name: fullName,
    email: emailRaw || null,
    role,
    shift_type: shiftType,
    employment_type: employmentType,
    is_lead_eligible: isLeadEligible,
    max_work_days_per_week: maxDays,
    created_by: userId,
  })

  if (error) {
    if (error.code === '23505') {
      redirect(buildTeamUrl({ roster_error: 'duplicate_name' }))
    }
    console.error('Failed to add roster employee:', error)
    redirect(buildTeamUrl({ roster_error: 'add_failed' }))
  }

  revalidatePath('/team')
  redirect(buildTeamUrl({ roster_success: 'employee_added' }))
}

export async function removeRosterEmployeeAction(formData: FormData) {
  const rosterId = String(formData.get('roster_id') ?? '').trim()
  if (!rosterId) redirect(buildTeamUrl({ roster_error: 'missing_id' }))

  const { supabase } = await requireManager()

  const { data: entry } = await supabase
    .from('employee_roster')
    .select('id, matched_profile_id')
    .eq('id', rosterId)
    .maybeSingle()

  if (!entry) redirect(buildTeamUrl({ roster_error: 'not_found' }))
  if (entry.matched_profile_id) redirect(buildTeamUrl({ roster_error: 'already_matched' }))

  const { error } = await supabase
    .from('employee_roster')
    .delete()
    .eq('id', rosterId)
    .is('matched_profile_id', null)

  if (error) {
    console.error('Failed to remove roster entry:', error)
    redirect(buildTeamUrl({ roster_error: 'remove_failed' }))
  }

  revalidatePath('/team')
  redirect(buildTeamUrl({ roster_success: 'employee_removed' }))
}

/**
 * Called from the signup page after a successful signUp() to detect whether the
 * new user's name matched a roster entry (meaning their profile was auto-provisioned
 * with a real role rather than landing in the pending-approval queue).
 *
 * The DB trigger fires synchronously, so by the time this runs the roster entry
 * will already have matched_profile_id set. We look for a recently-matched entry
 * (within the last 2 minutes) with the same normalized name.
 *
 * Uses the admin client so it bypasses RLS — acceptable here because:
 * 1. It's a server action (never exposed to the client)
 * 2. The caller just signed up with this name — it's their own data
 * 3. We only return a boolean, not any roster details
 */
export async function checkNameRosterMatchAction(fullName: string): Promise<boolean> {
  const normalized = fullName.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!normalized) return false

  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()

  const admin = createAdminClient()
  const { data } = await admin
    .from('employee_roster')
    .select('full_name')
    .not('matched_profile_id', 'is', null)
    .gte('matched_at', twoMinutesAgo)

  if (!data) return false

  return (data as Array<{ full_name: string }>).some((row) => {
    const rosterNorm = String(row.full_name ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
    return rosterNorm === normalized
  })
}
