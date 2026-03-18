'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { parseTeamQuickEditFormData } from '@/lib/team-quick-edit'
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

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!can(parseRole(profile?.role), 'manage_directory')) {
    redirect('/dashboard/staff')
  }

  return { supabase }
}

function getTodayKey(): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function realignFutureDraftShiftsForEmployee(
  supabase: Awaited<ReturnType<typeof createClient>>,
  employeeId: string
): Promise<void> {
  const { data: draftCycles, error: draftCyclesError } = await supabase
    .from('schedule_cycles')
    .select('id')
    .eq('published', false)

  if (draftCyclesError) {
    console.error('Failed to load draft cycles for team quick edit realignment:', draftCyclesError)
    return
  }

  const cycleIds = (draftCycles ?? [])
    .map((row) => String((row as { id?: string }).id ?? ''))
    .filter((id) => id.length > 0)

  if (cycleIds.length === 0) return

  const { error: deleteError } = await supabase
    .from('shifts')
    .delete()
    .eq('user_id', employeeId)
    .gte('date', getTodayKey())
    .in('cycle_id', cycleIds)

  if (deleteError) {
    console.error('Failed to realign future draft shifts from team quick edit:', deleteError)
  }
}

export async function saveTeamQuickEditAction(formData: FormData) {
  const parsed = parseTeamQuickEditFormData(formData)

  if (!parsed.ok) {
    redirect(
      buildTeamUrl({
        error: parsed.error,
        edit_profile: parsed.profileId,
      })
    )
  }

  const { supabase } = await requireManager()
  const input = parsed.value

  const { data: existingProfile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', input.profileId)
    .maybeSingle()

  if (profileError || !existingProfile) {
    console.error('Failed to load team quick edit profile:', profileError)
    redirect(buildTeamUrl({ error: 'missing_profile' }))
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      full_name: input.fullName,
      role: input.role,
      shift_type: input.shiftType,
      employment_type: input.employmentType,
      is_lead_eligible: input.isLeadEligible,
      on_fmla: input.onFmla,
      fmla_return_date: input.fmlaReturnDate,
      is_active: input.isActive,
    })
    .eq('id', input.profileId)

  if (updateError) {
    console.error('Failed to save team quick edit profile:', updateError)
    redirect(
      buildTeamUrl({
        error: 'update_failed',
        edit_profile: input.profileId,
      })
    )
  }

  if (!input.isActive || input.onFmla || input.role === 'manager') {
    await realignFutureDraftShiftsForEmployee(supabase, input.profileId)
  }

  revalidatePath('/team')
  revalidatePath('/schedule')
  revalidatePath('/coverage')
  revalidatePath('/dashboard/manager')

  redirect(buildTeamUrl({ success: 'profile_saved' }))
}
