import type { Metadata } from 'next'
import { DM_Sans, Plus_Jakarta_Sans } from 'next/font/google'
import { Suspense } from 'react'
import { AppShell, type AppShellUser } from '@/components/AppShell'
import { toUiRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  display: 'swap',
})

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-plus-jakarta',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Teamwise',
  description: 'Team scheduling, availability, and coverage together.',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  let appShellUser: AppShellUser | null = null

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', user.id)
        .maybeSingle()

      let pendingAccessRequests = 0
      if (profile?.role === 'manager') {
        const { count } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .is('role', null)
        pendingAccessRequests = count ?? 0
      }

      appShellUser = {
        fullName:
          profile?.full_name ?? user.user_metadata?.full_name ?? user.email ?? 'Team member',
        role: toUiRole(profile?.role),
        pendingAccessRequests,
      }
    }
  } catch (error) {
    console.warn(
      'Supabase lookup failed in RootLayout:',
      error instanceof Error ? error.message : error
    )
  }

  return (
    <html lang="en" className={plusJakarta.variable}>
      <body className={`${dmSans.className} antialiased`}>
        <Suspense fallback={children}>
          <AppShell user={appShellUser}>{children}</AppShell>
        </Suspense>
      </body>
    </html>
  )
}
