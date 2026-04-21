'use client'

import { type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'

type TeamDirectorySectionKey =
  | 'managers'
  | 'dayLeads'
  | 'dayTherapists'
  | 'nightLeads'
  | 'nightTherapists'
  | 'inactive'

export function TeamDirectoryGroupSection({
  sectionKey,
  title,
  count,
  isOpen,
  onToggle,
  showSelectionControls,
  allSelected,
  onToggleSelectAll,
  children,
}: {
  sectionKey: TeamDirectorySectionKey
  title: string
  count: number
  isOpen: boolean
  onToggle: (sectionKey: TeamDirectorySectionKey, nextOpen: boolean) => void
  showSelectionControls: boolean
  allSelected: boolean
  onToggleSelectAll: (checked: boolean) => void
  children: ReactNode
}) {
  if (count === 0) return null
  const summaryId = `team-directory-${sectionKey}-summary`
  const panelId = `team-directory-${sectionKey}-panel`

  return (
    <section className="border-b border-border/70 pb-1 last:border-b-0">
      <div className="flex items-center gap-2 px-2 py-1.5">
        {showSelectionControls ? (
          <input
            type="checkbox"
            className="h-11 w-11 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring sm:h-6 sm:w-6"
            checked={allSelected}
            onChange={(event) => onToggleSelectAll(event.target.checked)}
            aria-label={`Select all in ${title}`}
          />
        ) : null}
        <button
          type="button"
          id={summaryId}
          aria-controls={panelId}
          aria-expanded={isOpen}
          onClick={() => onToggle(sectionKey, !isOpen)}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md text-left hover:bg-muted/35 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              isOpen && 'rotate-180'
            )}
            aria-hidden
          />
          <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
        </button>
        <span className="rounded-full border border-border/70 bg-muted/25 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
          {count}
        </span>
      </div>
      <div
        id={panelId}
        role="region"
        aria-labelledby={summaryId}
        hidden={!isOpen}
        className="space-y-1 px-2 py-1"
      >
        {children}
      </div>
    </section>
  )
}
