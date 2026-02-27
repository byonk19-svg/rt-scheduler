import { redirect } from 'next/navigation'

import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { StaffNavbar } from '@/app/staff/staff-navbar'

type LayoutProfileRow = {
  full_name: string | null
  role: string | null
}

export default async function StaffLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .maybeSingle()

  const typedProfile = (profile ?? null) as LayoutProfileRow | null

  if (can(parseRole(typedProfile?.role), 'access_manager_ui')) {
    redirect('/dashboard/manager')
  }

  const fullName =
    typedProfile?.full_name ?? user.user_metadata?.full_name ?? user.email ?? 'Staff member'

  return (
    <div className="min-h-screen bg-background">
      <StaffNavbar fullName={fullName} />
      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  )
}
