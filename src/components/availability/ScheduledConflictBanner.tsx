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

function formatConflictDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return date

  const weekday = parsed.toLocaleDateString('en-US', { weekday: 'short' })
  const month = parsed.toLocaleDateString('en-US', { month: 'short' })
  const day = parsed.toLocaleDateString('en-US', { day: 'numeric' })
  return `${weekday} ${month} ${day}`
}

export function ScheduledConflictBanner({ conflicts, onDismiss }: Props) {
  const [dismissedKey, setDismissedKey] = useState<string | null>(null)

  const dismissKey = useMemo(
    () => conflicts.map((conflict) => `${conflict.date}:${conflict.shiftType}`).join('|'),
    [conflicts]
  )

  const sortedConflicts = useMemo(
    () => [...conflicts].sort((a, b) => a.date.localeCompare(b.date)),
    [conflicts]
  )

  if (sortedConflicts.length === 0 || dismissedKey === dismissKey) return null

  return (
    <div className="rounded-xl border border-[var(--warning-border)] bg-[var(--warning-subtle)] p-4 text-[var(--warning-text)]">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-sm font-semibold leading-tight">
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
            className="inline-flex text-sm font-semibold underline-offset-4 hover:underline"
          >
            Review in Coverage →
          </Link>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-[var(--warning-text)] hover:bg-[var(--warning-border)]/15 hover:text-[var(--warning-text)]"
          aria-label="Dismiss scheduled shift warning"
          onClick={() => {
            setDismissedKey(dismissKey)
            onDismiss()
          }}
        >
          <X aria-hidden />
        </Button>
      </div>
    </div>
  )
}
