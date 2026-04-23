import type { Metadata } from 'next'
import { Instrument_Serif } from 'next/font/google'
import dynamic from 'next/dynamic'

import { cn } from '@/lib/utils'

const PublicHeaderConditional = dynamic(() =>
  import('@/components/public/PublicHeaderConditional').then((m) => m.default ?? (() => null))
)

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
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
    <div className={`${instrumentSerif.variable} min-h-screen bg-background`}>
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
      <PublicHeaderConditional />
      <main id="main-content" tabIndex={-1} className="outline-none">
        {children}
      </main>
    </div>
  )
}
