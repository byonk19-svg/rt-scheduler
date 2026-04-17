import { Fraunces } from 'next/font/google'

import { PublicHeader } from '@/components/public/PublicHeader'

const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
})

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className={`${fraunces.variable} min-h-screen bg-background`}>
      <PublicHeader />
      {children}
    </div>
  )
}
