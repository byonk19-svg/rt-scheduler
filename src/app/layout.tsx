import type { Metadata } from 'next'
import { DM_Sans, Geist_Mono } from 'next/font/google'
import { cookies } from 'next/headers'
import dynamic from 'next/dynamic'
import { getServerThemeClass, THEME_KEY } from '@/lib/theme'
import type { ReactNode } from 'react'
import './globals.css'

const ThemeProvider = dynamic(
  () =>
    import('@/components/ThemeProvider').then(
      (m) => m.default ?? (({ children }: { children: ReactNode }) => <>{children}</>)
    )
)

const dmSans = DM_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-dm-sans',
})

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
  const cookieStore = await cookies()
  const themeClass = getServerThemeClass(cookieStore.get(THEME_KEY)?.value)

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={[dmSans.variable, geistMono.variable, themeClass].filter(Boolean).join(' ')}
    >
      <body className={`${dmSans.className} antialiased`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
