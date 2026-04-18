import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Team',
  description: 'Directory, roster administration, and team settings.',
}

export default function TeamSegmentLayout({ children }: { children: ReactNode }) {
  return children
}
