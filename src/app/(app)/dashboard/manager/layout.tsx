import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Inbox',
  description: 'Manager inbox — triage requests and schedule updates.',
}

export default function ManagerDashboardLayout({ children }: { children: ReactNode }) {
  return children
}
