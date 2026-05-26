'use client'

import Link from 'next/link'
import { X } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'

export function SetupCompleteBanner() {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <section
      role="status"
      aria-live="polite"
      className="rounded-xl border border-[var(--success-border)] bg-[var(--success-subtle)] px-4 py-3 text-[var(--success-text)] shadow-tw-sm"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">{"You're all set"}</h2>
          <p className="text-sm">Your work pattern and preferences have been saved.</p>
          <Link
            href="/therapist/settings?setup=preferences"
            className="inline-flex text-sm font-semibold underline-offset-4 hover:underline"
          >
            Edit preferences
          </Link>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Dismiss setup complete message"
          className="self-end text-[var(--success-text)] hover:bg-[var(--success-border)]/15 hover:text-[var(--success-text)] sm:self-start"
          onClick={() => {
            setDismissed(true)
            const url = new URL(window.location.href)
            url.searchParams.delete('setup')
            window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </section>
  )
}
