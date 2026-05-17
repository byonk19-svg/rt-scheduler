import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Availability',
  description:
    'Collect therapist availability, planner inputs, and email intake for the active Schedule Block.',
}

export default function AvailabilitySegmentLayout({ children }: { children: ReactNode }) {
  return children
}
