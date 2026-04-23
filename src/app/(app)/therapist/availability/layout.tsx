import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'My Availability',
}

export default function TherapistAvailabilityLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}
