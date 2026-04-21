'use client'

import { cn } from '@/lib/utils'

type AvailabilitySecondaryTab = 'roster' | 'inbox'

type AvailabilitySecondaryHeaderProps = {
  open: boolean
  activeTab: AvailabilitySecondaryTab
  submittedCount: number
  awaitingCount: number
  requestCount: number
  rosterTabId: string
  inboxTabId: string
  rosterPanelId: string
  inboxPanelId: string
  onOpenChange: (open: boolean) => void
  onTabChange: (tab: AvailabilitySecondaryTab) => void
}

export function AvailabilitySecondaryHeader({
  open,
  activeTab,
  submittedCount,
  awaitingCount,
  requestCount,
  rosterTabId,
  inboxTabId,
  rosterPanelId,
  inboxPanelId,
  onOpenChange,
  onTabChange,
}: AvailabilitySecondaryHeaderProps) {
  if (!open) {
    return (
      <div className="rounded-[1.5rem] border border-border/70 bg-card px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Response roster and inbox</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Open the secondary workspace when you need to review responses or handle requests.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-medium text-muted-foreground">
              <span className="rounded-full border border-border/70 bg-background px-2 py-0.5">
                {awaitingCount} awaiting
              </span>
              <span className="rounded-full border border-border/70 bg-background px-2 py-0.5">
                {submittedCount} submitted
              </span>
              <span className="rounded-full border border-border/70 bg-background px-2 py-0.5">
                {requestCount} requests
              </span>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-border/70 bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted/35 sm:min-h-10"
            onClick={() => onOpenChange(true)}
          >
            Show response roster and inbox
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative z-[1] flex flex-wrap items-start justify-between gap-2 border-b border-border/70 bg-card px-4 py-3">
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold text-foreground">Response roster and inbox</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Follow up on responses and requests without leaving the planner.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
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
            onClick={() => onTabChange('roster')}
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
            onClick={() => onTabChange('inbox')}
          >
            Request inbox
          </button>
        </div>
        <button
          type="button"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-border/70 bg-background px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted/35 hover:text-foreground sm:min-h-10"
          onClick={() => onOpenChange(false)}
        >
          Hide secondary workspace
        </button>
      </div>
    </div>
  )
}
