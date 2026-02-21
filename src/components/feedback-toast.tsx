'use client'

import { useEffect, useState } from 'react'

type FeedbackToastProps = {
  message: string
  variant: 'success' | 'error'
}

export function FeedbackToast({ message, variant }: FeedbackToastProps) {
  const [open, setOpen] = useState(true)

  useEffect(() => {
    const timeout = setTimeout(() => setOpen(false), 5000)
    return () => clearTimeout(timeout)
  }, [])

  if (!open) return null

  const variantClass =
    variant === 'error'
      ? 'border-red-200 bg-red-50 text-red-800'
      : 'border-emerald-200 bg-emerald-50 text-emerald-800'

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`no-print fixed right-4 top-4 z-50 w-full max-w-sm rounded-xl border-2 px-4 py-3 shadow-lg ${variantClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium">{message}</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs underline opacity-80 hover:opacity-100"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
