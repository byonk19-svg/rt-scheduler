import { redirect } from 'next/navigation'

import { archiveTeamMemberAction, saveTeamQuickEditAction } from '@/app/team/actions'
import { FeedbackToast } from '@/components/feedback-toast'
import { ManagerWorkspaceHeader } from '@/components/manager/ManagerWorkspaceHeader'
import { TeamDirectory } from '@/components/team/TeamDirectory'
import { can } from '@/lib/auth/can'
import { MANAGED_TEAM_ROLE_VALUES, parseRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'

type ProfileRow = {
  id: string
  full_name: string | null
  role: 'manager' | 'therapist' | 'lead' | null
  shift_type: 'day' | 'night' | null
  employment_type: 'full_time' | 'part_time' | 'prn' | null
  is_lead_eligible: boolean | null
  is_active: boolean | null
  on_fmla: boolean | null
  fmla_return_date: string | null
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
    return { message: 'Team member updated.', variant: 'success' }
  }

  if (success === 'profile_archived') {
    return { message: 'Team member archived.', variant: 'success' }
  }

  if (error === 'missing_profile') {
    return { message: 'Could not find that team member.', variant: 'error' }
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
    return { message: 'Could not save team member changes. Please try again.', variant: 'error' }
  }

  if (error === 'archive_requires_inactive') {
    return { message: 'Only inactive team members can be archived.', variant: 'error' }
  }

  if (error === 'archive_failed') {
    return { message: 'Could not archive that team member. Please try again.', variant: 'error' }
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
      'id, full_name, role, shift_type, employment_type, is_lead_eligible, is_active, on_fmla, fmla_return_date'
    )
    .in('role', [...MANAGED_TEAM_ROLE_VALUES])
    .is('archived_at', null)
    .order('full_name', { ascending: true })

  const allProfiles = (profiles ?? []) as ProfileRow[]
  const activeProfiles = allProfiles.filter((profile) => profile.is_active !== false)
  const managerCount = activeProfiles.filter((profile) => profile.role === 'manager').length
  const leadCount = activeProfiles.filter((profile) => profile.role === 'lead').length
  const therapistCount = activeProfiles.filter((profile) => profile.role === 'therapist').length
  const inactiveCount = allProfiles.length - activeProfiles.length
  const onFmlaCount = allProfiles.filter((profile) => profile.on_fmla === true).length
  const feedback = getTeamFeedback(params)
  const initialEditProfileId = getSearchParam(params?.edit_profile) ?? null

  return (
    <div className="max-w-5xl space-y-7 py-6">
      {feedback && <FeedbackToast message={feedback.message} variant={feedback.variant} />}

      <ManagerWorkspaceHeader
        title="Team"
        subtitle="Manage roles, staffing access, and inactive employees in one place."
        className="px-0"
        summary={
          <>
            <span className="rounded-full border border-border/70 bg-muted/15 px-3 py-1 font-medium text-foreground">
              {allProfiles.length} team members
            </span>
            <span className="text-muted-foreground">{managerCount} managers</span>
            <span className="text-border/90">/</span>
            <span className="text-muted-foreground">{leadCount} lead therapists</span>
            <span className="text-border/90">/</span>
            <span className="text-muted-foreground">{therapistCount} therapists</span>
            <span className="text-border/90">/</span>
            <span className="text-muted-foreground">{inactiveCount} inactive</span>
            <span className="text-border/90">/</span>
            <span className="text-muted-foreground">{onFmlaCount} on FMLA</span>
          </>
        }
      />

      <TeamDirectory
        profiles={allProfiles}
        initialEditProfileId={initialEditProfileId}
        archiveTeamMemberAction={archiveTeamMemberAction}
        saveTeamQuickEditAction={saveTeamQuickEditAction}
      />
    </div>
  )
}
