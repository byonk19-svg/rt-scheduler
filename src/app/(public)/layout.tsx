import { Fraunces } from 'next/font/google'
import dynamic from 'next/dynamic'

const PublicHeader = dynamic(
  () =>
    import('@/components/public/PublicHeader').then((m) => m.default ?? (() => null))
)

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
