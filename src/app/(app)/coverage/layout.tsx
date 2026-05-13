import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Schedule',
  description: 'Redirects to the unified Schedule grid.',
}

export default function CoverageSegmentLayout({ children }: { children: ReactNode }) {
  return children
}
