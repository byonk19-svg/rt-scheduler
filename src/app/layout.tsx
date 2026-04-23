import type { Metadata } from 'next'
import { Geist_Mono, Plus_Jakarta_Sans } from 'next/font/google'
import { cookies } from 'next/headers'
import { getServerThemeClass, THEME_KEY } from '@/lib/theme'
import { getSiteUrl, getSupabaseOrigin } from '@/lib/site-url'
import './globals.css'

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-plus-jakarta-sans',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-geist-mono',
})

const siteUrl = getSiteUrl()

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: 'Teamwise',
    template: '%s · Teamwise',
  },
  description: 'Team scheduling, availability, and coverage together.',
  applicationName: 'Teamwise',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl.href,
    siteName: 'Teamwise',
    title: 'Teamwise',
    description: 'Team scheduling, availability, and coverage together.',
    images: [
      {
        url: '/images/app-preview.png',
        width: 1200,
        height: 630,
        alt: 'Teamwise schedule view',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Teamwise',
    description: 'Team scheduling, availability, and coverage together.',
    images: ['/images/app-preview.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const themeClass = getServerThemeClass(cookieStore.get(THEME_KEY)?.value)
  const supabaseOrigin = getSupabaseOrigin()

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={[plusJakartaSans.variable, geistMono.variable, themeClass]
        .filter(Boolean)
        .join(' ')}
    >
      <head>
        {supabaseOrigin ? (
          <link rel="preconnect" href={supabaseOrigin} crossOrigin="anonymous" />
        ) : null}
      </head>
      <body className={`${plusJakartaSans.className} antialiased`}>{children}</body>
    </html>
  )
}
