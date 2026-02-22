import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { FeedbackToast } from '@/components/feedback-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

type ProfileSearchParams = {
  success?: string | string[]
  error?: string | string[]
}

type WeekdayOption = {
  value: number
  label: string
}

const WEEKDAY_OPTIONS: WeekdayOption[] = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function normalizePreferredWorkDays(rawValues: FormDataEntryValue[]): number[] {
  const days = rawValues
    .map((value) => Number.parseInt(String(value), 10))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
  return Array.from(new Set(days)).sort((a, b) => a - b)
}

function getFeedback(searchParams?: ProfileSearchParams): { message: string; variant: 'success' | 'error' } | null {
  const success = getSearchParam(searchParams?.success)
  const error = getSearchParam(searchParams?.error)

  if (success === 'preferred_days_saved') {
    return { message: 'Preferred work days saved.', variant: 'success' }
  }

  if (error === 'preferred_days_failed') {
    return { message: 'Could not save preferred work days. Please try again.', variant: 'error' }
  }

  return null
}

async function savePreferredWorkDaysAction(formData: FormData) {
  'use server'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const preferredDays = normalizePreferredWorkDays(formData.getAll('preferred_work_days'))

  const { error } = await supabase
    .from('profiles')
    .update({
      preferred_work_days: preferredDays,
    })
    .eq('id', user.id)

  if (error) {
    console.error('Failed to update preferred work days:', error)
    redirect('/profile?error=preferred_days_failed')
  }

  revalidatePath('/profile')
  revalidatePath('/schedule')
  redirect('/profile?success=preferred_days_saved')
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams?: Promise<ProfileSearchParams>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const feedback = getFeedback(resolvedSearchParams)

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'full_name, email, role, shift_type, is_lead_eligible, employment_type, max_work_days_per_week, preferred_work_days'
    )
    .eq('id', user.id)
    .maybeSingle()

  const fullName = profile?.full_name ?? user.user_metadata?.full_name ?? 'Team member'
  const email = profile?.email ?? user.email ?? 'No email on file'
  const role = profile?.role === 'manager' ? 'manager' : 'therapist'
  const shiftType = profile?.shift_type === 'night' ? 'night' : 'day'
  const employmentType =
    profile?.employment_type === 'part_time' || profile?.employment_type === 'prn'
      ? profile.employment_type
      : 'full_time'
  const weeklyLimit = typeof profile?.max_work_days_per_week === 'number' ? profile.max_work_days_per_week : 3
  const preferredWorkDays = Array.isArray(profile?.preferred_work_days)
    ? profile.preferred_work_days
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
    : []
  const preferredDayLabels = WEEKDAY_OPTIONS.filter((option) => preferredWorkDays.includes(option.value)).map(
    (option) => option.label
  )

  return (
    <div className="space-y-6">
      {feedback && <FeedbackToast message={feedback.message} variant={feedback.variant} />}

      <div>
        <h1 className="text-3xl font-bold text-foreground">Profile</h1>
        <p className="text-muted-foreground">Your account details and role configuration.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{fullName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-muted-foreground">Email</p>
            <p className="font-medium text-foreground">{email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="capitalize">{role}</Badge>
            <Badge variant="outline" className="capitalize">
              {shiftType} shift
            </Badge>
            <Badge variant="outline" className="capitalize">
              {employmentType.replace('_', ' ')}
            </Badge>
            {role === 'therapist' && (
              <Badge variant={profile?.is_lead_eligible ? 'default' : 'outline'}>
                {profile?.is_lead_eligible ? 'Lead eligible' : 'Staff only'}
              </Badge>
            )}
            {role === 'therapist' && <Badge variant="outline">Max {weeklyLimit}/week</Badge>}
          </div>
        </CardContent>
      </Card>

      {role === 'therapist' && (
        <Card>
          <CardHeader>
            <CardTitle>Preferred Work Days</CardTitle>
            <CardDescription>
              Auto-generate will prioritize these weekdays when possible. Leave all unchecked if you have no
              day-of-week preference.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={savePreferredWorkDaysAction} className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {WEEKDAY_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="preferred_work_days"
                      value={option.value}
                      defaultChecked={preferredWorkDays.includes(option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit">Save preferred days</Button>
                <p className="text-xs text-muted-foreground">
                  Current: {preferredDayLabels.length > 0 ? preferredDayLabels.join(', ') : 'No preference'}
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
