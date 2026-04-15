import type { Metadata } from 'next'
import { DM_Sans, Fraunces, Geist_Mono } from 'next/font/google'
import { Suspense } from 'react'
import { AppShell, type AppShellUser } from '@/components/AppShell'
import { MotionProvider } from '@/components/motion-provider'
import { toUiRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import './globals.css'

/** UI + body — DESIGN.md */
const dmSans = DM_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-dm-sans',
})

/** Marketing hero + auth brand panel only — DESIGN.md */
const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
})

/** Code / IDs — DESIGN.md */
const geistMono = Geist_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-geist-mono',
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
    <html lang="en" className={`${dmSans.variable} ${fraunces.variable} ${geistMono.variable}`}>
      <body className={`${dmSans.className} antialiased`}>
        <MotionProvider>
          {/*
            AppShell reads search params; it must sit under Suspense. Never use `children` as the
            fallback — RSC children can be a thenable React treats like a lazy type and then crash
            with "Element type is invalid... promise... undefined".
          */}
          <Suspense
            fallback={<div className="min-h-svh bg-background text-foreground" aria-busy="true" />}
          >
            <AppShell user={appShellUser}>{children}</AppShell>
          </Suspense>
        </MotionProvider>
      </body>
    </html>
  )
}
