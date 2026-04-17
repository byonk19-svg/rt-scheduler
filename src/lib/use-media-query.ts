'use client'

import { useSyncExternalStore } from 'react'

/**
 * Subscribes to `window.matchMedia`. SSR / first paint uses `false` until the client runs.
 * Use Tailwind-aligned queries, e.g. `(max-width: 767px)` for below `md`.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined') return () => {}
      const mq = window.matchMedia(query)
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    },
    () => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false),
    () => false
  )
}
