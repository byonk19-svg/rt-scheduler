import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Coverage',
  description: 'Plan shift coverage, assign leads, and manage the active schedule cycle.',
}

export default function CoverageSegmentLayout({ children }: { children: ReactNode }) {
  return children
}
