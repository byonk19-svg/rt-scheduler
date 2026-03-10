import { redirect } from 'next/navigation'

import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'

type ScheduleSearchParams = Record<string, string | string[] | undefined>

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams?: Promise<ScheduleSearchParams>
}) {
  const supabase = await createClient()
  const params = searchParams ? await searchParams : {}

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

  const isManager = can(parseRole(profile?.role), 'access_manager_ui')
  const targetPath = isManager ? '/coverage' : '/therapist/schedule'

  const passthrough = new URLSearchParams()
  for (const [key, rawValue] of Object.entries(params ?? {})) {
    const value = firstValue(rawValue)
    if (!value) continue
    passthrough.set(key, value)
  }

  const query = passthrough.toString()
  redirect(query ? `${targetPath}?${query}` : targetPath)
}
