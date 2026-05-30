import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'My Requests',
  description: 'Create and track your trade, coverage, and direct requests.',
}

export default function RequestsComposerLayout({ children }: { children: ReactNode }) {
  return children
}
