import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Swap Requests',
}

export default function ShiftBoardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}
