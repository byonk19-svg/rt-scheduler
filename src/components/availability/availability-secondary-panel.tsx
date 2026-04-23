'use client'

import { useState, type ReactNode } from 'react'

import { AvailabilitySecondaryHeader } from '@/components/availability/AvailabilitySecondaryHeader'

type AvailabilitySecondaryTab = 'roster' | 'inbox'

type AvailabilitySecondaryPanelProps = {
  roster: ReactNode
  inbox: ReactNode
  submittedCount?: number
  awaitingCount?: number
  requestCount?: number
  defaultOpen?: boolean
  defaultTab?: AvailabilitySecondaryTab
}

export function AvailabilitySecondaryPanel({
  roster,
  inbox,
  submittedCount = 0,
  awaitingCount = 0,
  requestCount = 0,
  defaultOpen = false,
  defaultTab = 'roster',
}: AvailabilitySecondaryPanelProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [activeTab, setActiveTab] = useState<AvailabilitySecondaryTab>(defaultTab)
  const rosterTabId = 'availability-secondary-tab-roster'
  const inboxTabId = 'availability-secondary-tab-inbox'
  const rosterPanelId = 'availability-secondary-panel-roster'
  const inboxPanelId = 'availability-secondary-panel-inbox'

  if (!open) {
    return (
      <section aria-label="Availability secondary workflows" className="flex flex-col">
        <AvailabilitySecondaryHeader
          open={open}
          activeTab={activeTab}
          submittedCount={submittedCount}
          awaitingCount={awaitingCount}
          requestCount={requestCount}
          rosterTabId={rosterTabId}
          inboxTabId={inboxTabId}
          rosterPanelId={rosterPanelId}
          inboxPanelId={inboxPanelId}
          onOpenChange={setOpen}
          onTabChange={setActiveTab}
        />
      </section>
    )
  }

  return (
    <section aria-label="Availability secondary workflows" className="flex flex-col">
      <AvailabilitySecondaryHeader
        open={open}
        activeTab={activeTab}
        submittedCount={submittedCount}
        awaitingCount={awaitingCount}
        requestCount={requestCount}
        rosterTabId={rosterTabId}
        inboxTabId={inboxTabId}
        rosterPanelId={rosterPanelId}
        inboxPanelId={inboxPanelId}
        onOpenChange={setOpen}
        onTabChange={setActiveTab}
      />

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
