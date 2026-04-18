import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Reset password',
  description: 'Request a password reset link for your Teamwise account.',
}

export default function ResetPasswordLayout({ children }: { children: ReactNode }) {
  return children
}
