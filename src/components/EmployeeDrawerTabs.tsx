'use client'

import { cn } from '@/lib/utils'

type DrawerTab = 'profile' | 'scheduling' | 'overrides'

const DRAWER_TABS: Array<{ value: DrawerTab; label: string }> = [
  { value: 'profile', label: 'Profile' },
  { value: 'scheduling', label: 'Scheduling' },
  { value: 'overrides', label: 'Overrides' },
]

export function EmployeeDrawerTabs({
  drawerTab,
  onChange,
}: {
  drawerTab: DrawerTab
  onChange: (value: DrawerTab) => void
}) {
  return (
    <div
      className="sticky top-0 z-10 flex border-b border-border bg-card"
      role="tablist"
      aria-label="Employee drawer sections"
    >
      {DRAWER_TABS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={drawerTab === tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            'flex-1 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
            drawerTab === tab.value
              ? 'border-[var(--warning)] text-[var(--warning-text)]'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
