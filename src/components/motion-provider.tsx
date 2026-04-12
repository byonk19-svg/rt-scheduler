'use client'

import { MotionConfig } from 'framer-motion'
import type { ReactNode } from 'react'

/** Respects `prefers-reduced-motion` for all Framer Motion descendants. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
