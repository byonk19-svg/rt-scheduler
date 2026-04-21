import { Search } from 'lucide-react'

import { FilterPill } from '@/components/shift-board/shift-board-primitives'
import { cn } from '@/lib/utils'

export function ShiftBoardTabs({
  activeTab,
  onSelectTab,
}: {
  activeTab: 'open' | 'history'
  onSelectTab: (tab: 'open' | 'history') => void
}) {
  return (
    <div className="fade-up flex gap-1" style={{ animationDelay: '0.08s' }}>
      {(
        [
          { id: 'open' as const, label: 'Open Posts' },
          { id: 'history' as const, label: 'History' },
        ] as const
      ).map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onSelectTab(tab.id)}
          className={cn(
            'h-9 rounded-lg border px-4 text-sm font-semibold transition-colors',
            activeTab === tab.id
              ? 'border-primary bg-primary/5 text-primary'
              : 'border-border bg-card text-muted-foreground hover:bg-secondary'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export function ShiftBoardFilterBar({
  isStaffRole,
  scope,
  onScopeChange,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
}: {
  isStaffRole: boolean
  scope: 'mine' | 'all'
  onScopeChange: (scope: 'mine' | 'all') => void
  search: string
  onSearchChange: (value: string) => void
  statusFilter: 'all' | 'pending' | 'approved' | 'denied'
  onStatusFilterChange: (status: 'all' | 'pending' | 'approved' | 'denied') => void
  typeFilter: 'all' | 'swap' | 'pickup'
  onTypeFilterChange: (type: 'all' | 'swap' | 'pickup') => void
}) {
  return (
    <div
      className="fade-up flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm"
      style={{ animationDelay: '0.1s' }}
    >
      {isStaffRole && (
        <div className="flex gap-1">
          <FilterPill
            label="My Requests"
            active={scope === 'mine'}
            onClick={() => onScopeChange('mine')}
          />
          <FilterPill
            label="All Posts"
            active={scope === 'all'}
            onClick={() => onScopeChange('all')}
          />
        </div>
      )}
      <div className="relative min-w-[200px] flex-1">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search by name, message, or shift..."
          className="h-9 w-full rounded-md border border-border bg-[var(--input-background)] pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </div>
      <div className="flex gap-1">
        {(['all', 'pending', 'approved', 'denied'] as const).map((status) => (
          <FilterPill
            key={status}
            label={status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
            active={statusFilter === status}
            onClick={() => onStatusFilterChange(status)}
          />
        ))}
      </div>
      <div className="flex gap-1">
        {(['all', 'swap', 'pickup'] as const).map((type) => (
          <FilterPill
            key={type}
            label={type === 'all' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1)}
            active={typeFilter === type}
            onClick={() => onTypeFilterChange(type)}
          />
        ))}
      </div>
    </div>
  )
}
