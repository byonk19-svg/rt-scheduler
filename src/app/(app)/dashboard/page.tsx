import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Route users to the right Teamwise dashboard for their role.',
}

type DashboardSearchParams = Record<string, string | string[] | undefined>

function toSearchSuffix(params?: DashboardSearchParams): string {
  if (!params) return ''

  const query = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        query.append(key, item)
      }
      continue
    }

    if (typeof value === 'string') {
      query.set(key, value)
    }
  }

  const encoded = query.toString()
  return encoded ? `?${encoded}` : ''
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<DashboardSearchParams>
}) {
  const supabase = await createClient()
  const params = searchParams ? await searchParams : undefined
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, default_landing_page, staff_onboarding_required, staff_onboarding_completed_at')
    .eq('id', user.id)
    .maybeSingle()

  const isManager = can(parseRole(profile?.role), 'access_manager_ui')
  const preferredLanding = profile?.default_landing_page === 'coverage' ? 'coverage' : 'dashboard'
  const suffix = toSearchSuffix(params)

  if (
    !isManager &&
    profile?.staff_onboarding_required === true &&
    !profile?.staff_onboarding_completed_at
  ) {
    redirect(`/onboarding${suffix}`)
  }

  if (preferredLanding === 'coverage') {
    if (isManager) {
      redirect(`/coverage?view=week${suffix ? `&${suffix.slice(1)}` : ''}`)
    }
    redirect(`/staff/schedule${suffix}`)
  }

  redirect(`${isManager ? '/dashboard/manager' : '/dashboard/staff'}${suffix}`)
}
