import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
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

  const isManager = profile?.role === 'manager' || user.user_metadata?.role === 'manager'
  redirect(isManager ? '/dashboard/manager' : '/dashboard/staff')
}
