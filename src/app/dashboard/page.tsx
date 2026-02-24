import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

type DashboardSearchParams = {
  success?: string | string[]
  error?: string | string[]
}

function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
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
    .select('role, default_landing_page')
    .eq('id', user.id)
    .maybeSingle()

  const isManager = profile?.role === 'manager'
  const preferredLanding = profile?.default_landing_page === 'coverage' ? 'coverage' : 'dashboard'
  const success = getSearchParam(params?.success)
  const error = getSearchParam(params?.error)
  const query = new URLSearchParams()
  if (success) query.set('success', success)
  if (error) query.set('error', error)
  const suffix = query.toString() ? `?${query.toString()}` : ''

  if (preferredLanding === 'coverage') {
    if (isManager) {
      redirect(`/coverage?view=week${suffix ? `&${query.toString()}` : ''}`)
    }
    redirect(`/schedule?view=week${suffix ? `&${query.toString()}` : ''}`)
  }

  redirect(`${isManager ? '/dashboard/manager' : '/dashboard/staff'}${suffix}`)
}
