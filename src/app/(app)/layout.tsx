import type { Metadata } from 'next'
import AppShell, { type AppShellUser } from '@/components/AppShell'
import { toUiRole } from '@/lib/auth/roles'
import { shouldIgnoreAuthenticatedLayoutError } from '@/lib/authenticated-layout-error'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

async function getAuthenticatedShellData(): Promise<{
  user: AppShellUser | null
}> {
  let appShellUser: AppShellUser | null = null

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { user: null }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .maybeSingle()

    appShellUser = {
      fullName: profile?.full_name ?? user.user_metadata?.full_name ?? user.email ?? 'Team member',
      role: toUiRole(profile?.role),
    }
  } catch (error) {
    if (shouldIgnoreAuthenticatedLayoutError(error)) {
      return { user: appShellUser }
    }
    console.warn(
      'Supabase lookup failed in authenticated layout:',
      error instanceof Error ? error.message : error
    )
  }

  return { user: appShellUser }
}

export default async function AuthenticatedLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const { user } = await getAuthenticatedShellData()

  return <AppShell user={user}>{children}</AppShell>
}
