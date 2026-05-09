import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Coverage',
  description: 'View the Team Schedule or manage Coverage for the active Schedule Block.',
}

export default function CoverageSegmentLayout({ children }: { children: ReactNode }) {
  return children
}
