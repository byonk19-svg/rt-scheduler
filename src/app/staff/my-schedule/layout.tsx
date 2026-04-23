import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'My Shifts',
}

export default function StaffMyScheduleLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}
