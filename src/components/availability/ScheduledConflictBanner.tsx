'use client'

import Link from 'next/link'
import { X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import type { ConflictItem } from '@/lib/availability-scheduled-conflict'

type Props = {
  conflicts: ConflictItem[]
  onDismiss: () => void
}

function formatConflictDate(value: string): string {
  const parsed = new Date(`${value}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return value

  const weekday = parsed.toLocaleDateString('en-US', { weekday: 'short' })
  const month = parsed.toLocaleDateString('en-US', { month: 'short' })
  const day = parsed.toLocaleDateString('en-US', { day: 'numeric' })
  return `${weekday} ${month} ${day}`
}

export function ScheduledConflictBanner({ conflicts, onDismiss }: Props) {
  const [dismissed, setDismissed] = useState(false)

  const sortedConflicts = useMemo(
    () => [...conflicts].sort((a, b) => a.date.localeCompare(b.date)),
    [conflicts]
  )

  if (dismissed || sortedConflicts.length === 0) return null

  return (
    <div className="rounded-xl border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-4 py-3 text-[var(--warning-text)]">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-sm font-semibold">
            You marked Need Off on dates that already have a scheduled shift.
          </p>
          <ul className="space-y-1 text-sm">
            {sortedConflicts.map((conflict) => (
              <li key={`${conflict.date}:${conflict.shiftType}`}>
                {formatConflictDate(conflict.date)}
              </li>
            ))}
          </ul>
          <Link
            href="/coverage"
            className="text-sm font-semibold underline-offset-4 hover:underline"
          >
            Review in Coverage →
          </Link>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Dismiss scheduled conflict warning"
          className="text-[var(--warning-text)] hover:bg-[var(--warning-border)]/15 hover:text-[var(--warning-text)]"
          onClick={() => {
            setDismissed(true)
            onDismiss()
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
