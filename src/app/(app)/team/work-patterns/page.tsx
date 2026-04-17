import { redirect } from 'next/navigation'

import { saveWorkPatternAction } from '@/app/team/actions'
import { FeedbackToast } from '@/components/feedback-toast'
import { ManagerWorkspaceHeader } from '@/components/manager/ManagerWorkspaceHeader'
import { WorkPatternCard } from '@/components/team/WorkPatternCard'
import { WorkPatternEditDialog } from '@/components/team/WorkPatternEditDialog'
import type { WorkPatternRecord } from '@/components/team/team-directory-model'
import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'

type SearchParams = {
  success?: string | string[]
  error?: string | string[]
  edit_profile?: string | string[]
}

type ProfileRow = {
  id: string
  full_name: string | null
  role: 'therapist' | 'lead' | null
  shift_type: 'day' | 'night' | null
  work_patterns:
    | {
        works_dow: number[] | null
        offs_dow: number[] | null
        weekend_rotation: string | null
        weekend_anchor_date: string | null
        works_dow_mode: string | null
      }
    | {
        works_dow: number[] | null
        offs_dow: number[] | null
        weekend_rotation: string | null
        weekend_anchor_date: string | null
        works_dow_mode: string | null
      }[]
    | null
}

function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function getFeedback(params?: SearchParams) {
  const success = getSearchParam(params?.success)
  const error = getSearchParam(params?.error)

  if (success === 'work_pattern_saved') {
    return { message: 'Work pattern saved.', variant: 'success' as const }
  }
  if (error === 'invalid_weekend_anchor') {
    return { message: 'Weekend anchor date must be a Saturday.', variant: 'error' as const }
  }
  if (error === 'work_pattern_save_failed') {
    return {
      message: 'Could not save the work pattern. Please try again.',
      variant: 'error' as const,
    }
  }
  if (error === 'missing_profile') {
    return { message: 'Could not find that therapist profile.', variant: 'error' as const }
  }

  return null
}

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function toPatternRecord(
  value: NonNullable<ProfileRow['work_patterns']>
): WorkPatternRecord | null {
  const row = getOne(value)
  if (!row) return null

  const worksDow = row.works_dow ?? []
  const offsDow = row.offs_dow ?? []
  const weekendRotation = row.weekend_rotation === 'every_other' ? 'every_other' : 'none'
  const worksDowMode = row.works_dow_mode === 'soft' ? 'soft' : 'hard'

  if (worksDow.length === 0 && offsDow.length === 0 && weekendRotation === 'none') return null

  return {
    works_dow: worksDow,
    offs_dow: offsDow,
    weekend_rotation: weekendRotation,
    weekend_anchor_date: row.weekend_anchor_date ?? null,
    works_dow_mode: worksDowMode,
  }
}

export default async function WorkPatternsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>
}) {
  const supabase = await createClient()
  const params = searchParams ? await searchParams : undefined

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role, is_active, archived_at')
    .eq('id', user.id)
    .maybeSingle()

  if (
    !can(parseRole(profileData?.role), 'manage_directory', {
      isActive: profileData?.is_active !== false,
      archivedAt: profileData?.archived_at ?? null,
    })
  ) {
    redirect('/dashboard/staff')
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select(
      'id, full_name, role, shift_type, work_patterns(works_dow, offs_dow, weekend_rotation, weekend_anchor_date, works_dow_mode)'
    )
    .in('role', ['therapist', 'lead'])
    .eq('is_active', true)
    .order('full_name')

  const rows = (profiles ?? []) as ProfileRow[]
  const dayRows = rows.filter((row) => row.shift_type !== 'night')
  const nightRows = rows.filter((row) => row.shift_type === 'night')
  const feedback = getFeedback(params)

  return (
    <div className="max-w-6xl space-y-7 py-6">
      {feedback ? <FeedbackToast message={feedback.message} variant={feedback.variant} /> : null}

      <ManagerWorkspaceHeader
        title="Work Patterns"
        subtitle="Review and update recurring weekly staffing patterns for day and night therapists."
        className="px-0"
      />

      {(
        [
          { key: 'day', label: 'Day shift', rows: dayRows },
          { key: 'night', label: 'Night shift', rows: nightRows },
        ] as const
      ).map((section) => (
        <section key={section.key} className="space-y-4">
          <div className="flex items-center justify-between border-b border-border/70 pb-2">
            <h2 className="text-lg font-semibold text-foreground">{section.label}</h2>
            <span className="text-xs text-muted-foreground">{section.rows.length} therapists</span>
          </div>

          <div className="space-y-3">
            {section.rows.map((profile) => {
              const pattern = profile.work_patterns ? toPatternRecord(profile.work_patterns) : null
              return (
                <div
                  key={profile.id}
                  className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/70 p-4 shadow-tw-2xs-soft sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {profile.full_name ?? 'Unknown therapist'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {profile.role === 'lead' ? 'Lead therapist' : 'Therapist'}
                      </p>
                    </div>

                    {pattern ? (
                      <WorkPatternCard
                        worksDow={pattern.works_dow}
                        offsDow={pattern.offs_dow}
                        weekendRotation={pattern.weekend_rotation}
                        worksDowMode={pattern.works_dow_mode}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No pattern set — click Edit to add one
                      </p>
                    )}
                  </div>

                  <WorkPatternEditDialog
                    therapistId={profile.id}
                    therapistName={profile.full_name ?? 'Unknown therapist'}
                    initialPattern={pattern}
                    saveWorkPatternAction={saveWorkPatternAction}
                  />
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
