import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { ManagerScheduleHome } from '@/components/manager/ManagerScheduleHome'
import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { buildManagerScheduleHomeModel } from '@/lib/manager-schedule-home'
import { getManagerAttentionSnapshot } from '@/lib/manager-workflow'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Schedule · Teamwise',
}

export default async function ManagerScheduleHomePage() {
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

  if (!can(parseRole(profile?.role), 'access_manager_ui')) {
    redirect('/dashboard/staff')
  }

  const snapshot = await getManagerAttentionSnapshot(supabase)
  const model = buildManagerScheduleHomeModel(snapshot)

  return <ManagerScheduleHome model={model} />
}
