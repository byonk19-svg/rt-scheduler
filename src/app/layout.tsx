import type { Metadata } from 'next'
import { DM_Sans, Plus_Jakarta_Sans } from 'next/font/google'
import { Suspense } from 'react'
import { AppShell, type AppShellPublishCta, type AppShellUser } from '@/components/AppShell'
import { can } from '@/lib/auth/can'
import { parseRole, toUiRole } from '@/lib/auth/roles'
import { getManagerAttentionSnapshot } from '@/lib/manager-workflow'
import { createClient } from '@/lib/supabase/server'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  display: 'swap',
})

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['800'],
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
  let appShellPublishCta: AppShellPublishCta | null = null

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

      appShellUser = {
        fullName:
          profile?.full_name ?? user.user_metadata?.full_name ?? user.email ?? 'Team member',
        role: toUiRole(profile?.role),
      }

      if (can(parseRole(profile?.role), 'access_manager_ui')) {
        const attention = await getManagerAttentionSnapshot(supabase)
        if (attention.publishReady) {
          appShellPublishCta = {
            href: attention.links.publish,
            label: 'Publish cycle',
          }
        }
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
          <AppShell user={appShellUser} publishCta={appShellPublishCta}>
            {children}
          </AppShell>
        </Suspense>
      </body>
    </html>
  )
}
