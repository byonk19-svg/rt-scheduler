import withDynamic from 'next/dynamic'
import type { AppShellUser } from '@/components/AppShell'
import { toUiRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import type { ReactNode } from 'react'

const AppShell = withDynamic<{ user: AppShellUser | null; unreadNotificationCount: number; children: ReactNode }>(
  () =>
    import('@/components/AppShell').then(
      (m) => m.default ?? (({ children }: { children: ReactNode }) => <>{children}</>)
    )
)

export const dynamic = 'force-dynamic'

async function getAuthenticatedShellData(): Promise<{
  user: AppShellUser | null
  unreadNotificationCount: number
}> {
  let appShellUser: AppShellUser | null = null
  let unreadNotificationCount = 0

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { user: null, unreadNotificationCount: 0 }
    }

    const [{ data: profile }, unreadNotificationsResult] = await Promise.all([
      supabase.from('profiles').select('full_name, role').eq('id', user.id).maybeSingle(),
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('read_at', null),
    ])

    unreadNotificationCount = unreadNotificationsResult.count ?? 0

    let pendingAccessRequests = 0
    if (profile?.role === 'manager') {
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .is('role', null)
      pendingAccessRequests = count ?? 0
    }

    appShellUser = {
      fullName: profile?.full_name ?? user.user_metadata?.full_name ?? user.email ?? 'Team member',
      role: toUiRole(profile?.role),
      pendingAccessRequests,
    }
  } catch (error) {
    console.warn(
      'Supabase lookup failed in authenticated layout:',
      error instanceof Error ? error.message : error
    )
  }

  return { user: appShellUser, unreadNotificationCount }
}

export default async function AuthenticatedLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const { user, unreadNotificationCount } = await getAuthenticatedShellData()

  return (
    <AppShell user={user} unreadNotificationCount={unreadNotificationCount}>
      {children}
    </AppShell>
  )
}
