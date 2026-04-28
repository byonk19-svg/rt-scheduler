import { redirect } from 'next/navigation'

import { ScheduleRosterScreen } from '@/components/schedule-roster/ScheduleRosterScreen'
import { parseRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'

export default async function SchedulePage() {
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

  const role = parseRole(profile?.role)
  if (role !== 'manager' && role !== 'lead') {
    redirect('/dashboard/staff')
  }

  return <ScheduleRosterScreen />
}
