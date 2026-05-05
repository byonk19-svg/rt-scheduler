import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Manager dashboard for triaging requests and schedule updates.',
}

export default function ManagerDashboardLayout({ children }: { children: ReactNode }) {
  return children
}
