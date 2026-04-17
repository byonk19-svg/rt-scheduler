import type { Metadata } from 'next'
import { DM_Sans, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/ThemeProvider'
import './globals.css'

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${dmSans.variable} ${geistMono.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var t = localStorage.getItem('tw-theme');
                var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (t === 'dark' || (t === 'system' && prefersDark) || (!t && prefersDark)) {
                  document.documentElement.classList.add('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className={`${dmSans.className} antialiased`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
