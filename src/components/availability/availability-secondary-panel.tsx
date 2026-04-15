'use client'

import { useState, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

type AvailabilitySecondaryTab = 'roster' | 'inbox'

type AvailabilitySecondaryPanelProps = {
  roster: ReactNode
  inbox: ReactNode
  defaultTab?: AvailabilitySecondaryTab
}

export function AvailabilitySecondaryPanel({
  roster,
  inbox,
  defaultTab = 'roster',
}: AvailabilitySecondaryPanelProps) {
  const [activeTab, setActiveTab] = useState<AvailabilitySecondaryTab>(defaultTab)

  return (
    <section aria-label="Availability secondary workflows" className="flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/70 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground">Secondary workflow</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Follow up on responses and requests without leaving the planner.
          </p>
        </div>
        <div className="inline-flex shrink-0 rounded-full border border-border/70 bg-muted/[0.08] p-0.5">
          <button
            type="button"
            className={cn(
              'rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors',
              activeTab === 'roster'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setActiveTab('roster')}
          >
            Response roster
          </button>
          <button
            type="button"
            className={cn(
              'rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors',
              activeTab === 'inbox'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setActiveTab('inbox')}
          >
            Request inbox
          </button>
        </div>
      </div>

      <div className="min-h-0">{activeTab === 'roster' ? roster : inbox}</div>
    </section>
  )
}
