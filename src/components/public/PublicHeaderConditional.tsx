'use client'

import { usePathname } from 'next/navigation'

import PublicHeader from './PublicHeader'

export default function PublicHeaderConditional({ className }: { className?: string }) {
  const pathname = usePathname()
  if (pathname === '/') return null
  return <PublicHeader className={className} />
}
