'use client'

import { Search } from 'lucide-react'

import type { EmployeeDirectoryTab } from '@/lib/employee-directory'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'

type EmployeeDirectoryFiltersProps = {
  employmentFilter: 'all' | 'full_time' | 'part_time' | 'prn'
  fmlaOnly: boolean
  includeInactive: boolean
  leadOnly: boolean
  searchText: string
  tab: EmployeeDirectoryTab
  onEmploymentFilterChange: (value: 'all' | 'full_time' | 'part_time' | 'prn') => void
  onFmlaOnlyChange: (value: boolean) => void
  onIncludeInactiveChange: (value: boolean) => void
  onLeadOnlyChange: (value: boolean) => void
  onSearchTextChange: (value: string) => void
  onTabChange: (value: EmployeeDirectoryTab) => void
}

export function EmployeeDirectoryFilters({
  employmentFilter,
  fmlaOnly,
  includeInactive,
  leadOnly,
  searchText,
  tab,
  onEmploymentFilterChange,
  onFmlaOnlyChange,
  onIncludeInactiveChange,
  onLeadOnlyChange,
  onSearchTextChange,
  onTabChange,
}: EmployeeDirectoryFiltersProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-border/90 bg-secondary/10 px-3 py-2.5">
        <div className="flex items-center gap-1">
          <span className="text-xs font-semibold text-muted-foreground">Shift:</span>
          {(['all', 'day', 'night'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onTabChange(value)}
              className={cn(
                'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                tab === value
                  ? 'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
                  : 'border-transparent text-muted-foreground hover:bg-secondary'
              )}
            >
              {value === 'all' ? 'All' : value === 'day' ? 'Day' : 'Night'}
            </button>
          ))}
        </div>
        <div className="hidden h-4 w-px bg-border sm:block" />
        <div className="flex items-center gap-1">
          <span className="text-xs font-semibold text-muted-foreground">Status:</span>
          <button
            type="button"
            onClick={() => onIncludeInactiveChange(false)}
            className={cn(
              'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
              !includeInactive
                ? 'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
                : 'border-transparent text-muted-foreground hover:bg-secondary'
            )}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => onIncludeInactiveChange(true)}
            className={cn(
              'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
              includeInactive
                ? 'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
                : 'border-transparent text-muted-foreground hover:bg-secondary'
            )}
          >
            All
          </button>
        </div>
        <div className="hidden h-4 w-px bg-border sm:block" />
        <div className="flex items-center gap-1">
          <span className="text-xs font-semibold text-muted-foreground">Type:</span>
          {(['all', 'full_time', 'part_time', 'prn'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onEmploymentFilterChange(value)}
              className={cn(
                'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                employmentFilter === value
                  ? 'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
                  : 'border-transparent text-muted-foreground hover:bg-secondary'
              )}
            >
              {value === 'all'
                ? 'All'
                : value === 'full_time'
                  ? 'FT'
                  : value === 'part_time'
                    ? 'PT'
                    : 'PRN'}
            </button>
          ))}
        </div>
        <div className="hidden h-4 w-px bg-border sm:block" />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs font-medium">
            <input
              type="checkbox"
              checked={leadOnly}
              onChange={(event) => onLeadOnlyChange(event.target.checked)}
              className="h-4 w-4 accent-[var(--primary)]"
            />
            Lead
          </label>
          <label className="flex items-center gap-1.5 text-xs font-medium">
            <input
              type="checkbox"
              checked={fmlaOnly}
              onChange={(event) => onFmlaOnlyChange(event.target.checked)}
              className="h-4 w-4 accent-[var(--primary)]"
            />
            FMLA
          </label>
        </div>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchText}
          onChange={(event) => onSearchTextChange(event.target.value)}
          placeholder="Search name or email"
          className="w-full pl-9"
        />
      </div>
    </div>
  )
}
