'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'

type BulkActionBarProps = {
  selectedCount: number
  onClear: () => void
  onApply: (action: string, value?: string) => void
}

export function BulkActionBar({ selectedCount, onClear, onApply }: BulkActionBarProps) {
  const [employment, setEmployment] = useState<'full_time' | 'part_time' | 'prn'>('full_time')

  if (selectedCount <= 0) return null

  return (
    <div
      className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 rounded-lg border border-border bg-card px-4 py-3 shadow-tw-sm"
      role="region"
      aria-label="Bulk actions for selected team members"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{selectedCount} selected</span>
          <Button type="button" size="sm" variant="outline" className="text-xs" onClick={onClear}>
            Clear
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="text-xs"
            onClick={() => onApply('set_fmla_on')}
          >
            Set FMLA on
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="text-xs"
            onClick={() => onApply('set_fmla_off')}
          >
            Set FMLA off
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="text-xs"
            onClick={() => onApply('set_inactive')}
          >
            Set inactive
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="text-xs"
            onClick={() => onApply('set_active')}
          >
            Set active
          </Button>
          <div className="flex flex-wrap items-center gap-1.5 border-l border-border pl-2">
            <select
              value={employment}
              onChange={(e) => setEmployment(e.target.value as 'full_time' | 'part_time' | 'prn')}
              className="h-9 rounded-md border border-border bg-card px-2 text-xs text-foreground"
              aria-label="Employment type for bulk update"
            >
              <option value="full_time">Full-time</option>
              <option value="part_time">Part-time</option>
              <option value="prn">PRN</option>
            </select>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => onApply('set_employment_type', employment)}
            >
              Apply
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
