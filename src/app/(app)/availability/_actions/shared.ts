import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

export type AvailabilityOverrideType = 'force_off' | 'force_on'
export type AvailabilityShiftType = 'day' | 'night' | 'both'

export function revalidateTherapistAvailabilitySurfaces() {
  revalidatePath('/availability')
  revalidatePath('/therapist/availability')
  revalidatePath('/dashboard/staff')
}

export function getReturnPath(value: string | null): '/availability' | '/therapist/availability' {
  return value === '/therapist/availability' ? '/therapist/availability' : '/availability'
}

export function buildAvailabilityUrl(
  params?: Record<string, string | undefined>,
  returnPath: '/availability' | '/therapist/availability' = '/availability'
) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) {
      search.set(key, value)
    }
  }
  const query = search.toString()
  return query.length > 0 ? `${returnPath}?${query}` : returnPath
}

export function buildEmailIntakeAvailabilityUrl(params?: Record<string, string | undefined>) {
  return buildAvailabilityUrl({ ...params, tab: 'intake' })
}

export async function getAuthenticatedUserWithRole() {
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

  return {
    supabase,
    user,
    role: profile?.role ?? null,
  }
}
