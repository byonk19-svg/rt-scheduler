import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Your Teamwise dashboard — schedules, requests, and updates.',
}

export default function StaffDashboardLayout({ children }: { children: ReactNode }) {
  return children
}
