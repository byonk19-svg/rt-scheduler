import Link from 'next/link'
import { redirect } from 'next/navigation'

import { saveTeamQuickEditAction } from '@/app/team/actions'
import { FeedbackToast } from '@/components/feedback-toast'
import { TeamDirectory } from '@/components/team/TeamDirectory'
import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'

type ProfileRow = {
  id: string
  full_name: string | null
  role: 'manager' | 'therapist' | 'staff' | null
  shift_type: 'day' | 'night' | null
  employment_type: 'full_time' | 'part_time' | 'prn' | null
  is_lead_eligible: boolean | null
  is_active: boolean | null
  on_fmla: boolean | null
}

type TeamSearchParams = {
  success?: string | string[]
  error?: string | string[]
  edit_profile?: string | string[]
}

function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function getTeamFeedback(params?: TeamSearchParams): {
  message: string
  variant: 'success' | 'error'
} | null {
  const success = getSearchParam(params?.success)
  const error = getSearchParam(params?.error)

  if (success === 'profile_saved') {
    return { message: 'Therapist updated.', variant: 'success' }
  }

  if (error === 'missing_profile') {
    return { message: 'Could not find that therapist.', variant: 'error' }
  }

  if (error === 'missing_name') {
    return { message: 'Name is required.', variant: 'error' }
  }

  if (error === 'invalid_role') {
    return { message: 'Choose a valid role.', variant: 'error' }
  }

  if (error === 'invalid_shift') {
    return { message: 'Choose a valid shift.', variant: 'error' }
  }

  if (error === 'invalid_employment') {
    return { message: 'Choose a valid employment type.', variant: 'error' }
  }

  if (error === 'update_failed') {
    return { message: 'Could not save therapist changes. Please try again.', variant: 'error' }
  }

  return null
}

export default async function TeamPage({
  searchParams,
}: {
  searchParams?: Promise<TeamSearchParams>
}) {
  const supabase = await createClient()
  const params = searchParams ? await searchParams : undefined

  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .maybeSingle()

  if (!can(parseRole(profileData?.role), 'access_manager_ui')) {
    redirect('/dashboard/staff')
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select(
      'id, full_name, role, shift_type, employment_type, is_lead_eligible, is_active, on_fmla'
    )
    .in('role', ['therapist', 'staff', 'manager'])
    .order('full_name', { ascending: true })

  const allProfiles = (profiles ?? []) as ProfileRow[]
  const activeProfiles = allProfiles.filter((profile) => profile.is_active !== false)
  const leads = activeProfiles.filter((profile) => profile.is_lead_eligible === true)
  const staff = activeProfiles.filter((profile) => profile.is_lead_eligible !== true)
  const feedback = getTeamFeedback(params)
  const initialEditProfileId = getSearchParam(params?.edit_profile) ?? null

  return (
    <div className="max-w-4xl px-8 py-6">
      {feedback && <FeedbackToast message={feedback.message} variant={feedback.variant} />}

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">Team</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeProfiles.length} therapists · {leads.length} leads, {staff.length} staff
          </p>
        </div>
        <Link
          href="/directory"
          className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
        >
          Full directory
        </Link>
      </div>

      <TeamDirectory
        profiles={allProfiles}
        initialEditProfileId={initialEditProfileId}
        saveTeamQuickEditAction={saveTeamQuickEditAction}
      />
    </div>
  )
}
