import type { Metadata } from 'next'
import { Fraunces } from 'next/font/google'
import dynamic from 'next/dynamic'

import { cn } from '@/lib/utils'

const PublicHeader = dynamic(() =>
  import('@/components/public/PublicHeader').then((m) => m.default ?? (() => null))
)

const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
})

export const metadata: Metadata = {
  robots: { index: true, follow: true },
}

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className={`${fraunces.variable} min-h-screen bg-background`}>
      <a
        href="#main-content"
        className={cn(
          'sr-only rounded-md bg-card px-3 py-2 text-sm font-medium text-foreground shadow-lg outline-none',
          'focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60]',
          'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'
        )}
      >
        Skip to main content
      </a>
      <PublicHeader />
      <main id="main-content" tabIndex={-1} className="outline-none">
        {children}
      </main>
    </div>
  )
}
