import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Request access',
  description: 'Create a Teamwise account. Your manager reviews requests before access is enabled.',
}

export default function SignUpLayout({ children }: { children: ReactNode }) {
  return children
}
