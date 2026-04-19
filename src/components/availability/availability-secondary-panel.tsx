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
  const rosterTabId = 'availability-secondary-tab-roster'
  const inboxTabId = 'availability-secondary-tab-inbox'
  const rosterPanelId = 'availability-secondary-panel-roster'
  const inboxPanelId = 'availability-secondary-panel-inbox'

  return (
    <section aria-label="Availability secondary workflows" className="flex flex-col">
      <div className="relative z-[1] flex flex-wrap items-start justify-between gap-2 border-b border-border/70 bg-card px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground">Secondary workflow</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Follow up on responses and requests without leaving the planner.
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Secondary workflow panels"
          className="relative z-[2] inline-flex shrink-0 rounded-full border border-border/70 bg-muted/[0.08] p-0.5"
        >
          <button
            id={rosterTabId}
            type="button"
            role="tab"
            aria-selected={activeTab === 'roster'}
            aria-controls={rosterPanelId}
            tabIndex={activeTab === 'roster' ? 0 : -1}
            className={cn(
              'relative min-h-11 rounded-full px-3 py-2 text-sm font-semibold transition-colors sm:min-h-10 sm:px-2.5 sm:py-1 sm:text-[11px]',
              activeTab === 'roster'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setActiveTab('roster')}
          >
            Response roster
          </button>
          <button
            id={inboxTabId}
            type="button"
            role="tab"
            aria-selected={activeTab === 'inbox'}
            aria-controls={inboxPanelId}
            tabIndex={activeTab === 'inbox' ? 0 : -1}
            className={cn(
              'relative min-h-11 rounded-full px-3 py-2 text-sm font-semibold transition-colors sm:min-h-10 sm:px-2.5 sm:py-1 sm:text-[11px]',
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

      <div
        id={rosterPanelId}
        role="tabpanel"
        aria-labelledby={rosterTabId}
        hidden={activeTab !== 'roster'}
        className="min-h-0"
      >
        {activeTab === 'roster' ? roster : null}
      </div>
      <div
        id={inboxPanelId}
        role="tabpanel"
        aria-labelledby={inboxTabId}
        hidden={activeTab !== 'inbox'}
        className="min-h-0"
      >
        {activeTab === 'inbox' ? inbox : null}
      </div>
    </section>
  )
}
