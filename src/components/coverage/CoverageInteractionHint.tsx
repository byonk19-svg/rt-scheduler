'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { X } from 'lucide-react'

const STORAGE_KEY = 'teamwise_coverage_interaction_hint_v1'
const DISMISS_EVENT = 'teamwise:coverage-hint-dismiss'

function readDismissedFromStorage(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function subscribe(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => {}
  const onStorage = () => onStoreChange()
  window.addEventListener('storage', onStorage)
  window.addEventListener(DISMISS_EVENT, onStorage)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(DISMISS_EVENT, onStorage)
  }
}

type CoverageInteractionHintProps = {
  /** When false, nothing renders. */
  show: boolean
}

/**
 * One-time dismissible hint for tap/click affordances on narrow viewports.
 */
export function CoverageInteractionHint({ show }: CoverageInteractionHintProps) {
  const dismissed = useSyncExternalStore(subscribe, readDismissedFromStorage, () => false)

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(DISMISS_EVENT))
  }, [])

  if (!show || dismissed) return null

  return (
    <div className="mb-3 flex gap-2 rounded-lg border border-border/80 bg-card px-3 py-2.5 shadow-sm md:hidden">
      <p className="min-w-0 flex-1 text-xs leading-snug text-muted-foreground">
        <span className="font-medium text-foreground">Tip:</span> Tap a day to open the shift editor.
        {` `}
        Tap a therapist name to change assignment status (on call, leave early, and similar).
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="inline-flex h-8 w-8 shrink-0 touch-manipulation items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none"
        aria-label="Dismiss scheduling tip"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  )
}
