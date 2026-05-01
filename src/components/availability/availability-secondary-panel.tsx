'use client'

import { useState, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

type AvailabilitySecondaryTab = 'roster' | 'inbox'

type AvailabilitySecondaryPanelProps = {
  roster: ReactNode
  inbox: ReactNode
  defaultTab?: AvailabilitySecondaryTab
  activeTab?: AvailabilitySecondaryTab
  onTabChange?: (tab: AvailabilitySecondaryTab) => void
}

export function AvailabilitySecondaryPanel({
  roster,
  inbox,
  defaultTab = 'roster',
  activeTab,
  onTabChange,
}: AvailabilitySecondaryPanelProps) {
  const [uncontrolledActiveTab, setUncontrolledActiveTab] =
    useState<AvailabilitySecondaryTab>(defaultTab)

  const resolvedActiveTab = activeTab ?? uncontrolledActiveTab

  function handleTabChange(nextTab: AvailabilitySecondaryTab) {
    if (!activeTab) {
      setUncontrolledActiveTab(nextTab)
    }
    onTabChange?.(nextTab)
  }

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
              'min-h-11 rounded-full px-3 py-2 text-sm font-semibold transition-colors sm:min-h-10 sm:px-2.5 sm:py-1 sm:text-[11px]',
              resolvedActiveTab === 'roster'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => handleTabChange('roster')}
          >
            Response roster
          </button>
          <button
            type="button"
            className={cn(
              'min-h-11 rounded-full px-3 py-2 text-sm font-semibold transition-colors sm:min-h-10 sm:px-2.5 sm:py-1 sm:text-[11px]',
              resolvedActiveTab === 'inbox'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => handleTabChange('inbox')}
          >
            Request inbox
          </button>
        </div>
      </div>

      <div className="min-h-0">{resolvedActiveTab === 'roster' ? roster : inbox}</div>
    </section>
  )
}
