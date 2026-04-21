'use client'

import { Star } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { MyShift, RequestType } from '@/components/requests/request-types'

export function RequestFormDetailsStep({
  myShifts,
  requestType,
  selectedShift,
  selectedShiftData,
  selectedShiftRequiresLeadEligibleReplacement,
  setRequestType,
  setSelectedShift,
}: {
  myShifts: MyShift[]
  requestType: RequestType
  selectedShift: string | null
  selectedShiftData: MyShift | null
  selectedShiftRequiresLeadEligibleReplacement: boolean
  setRequestType: (value: RequestType) => void
  setSelectedShift: (value: string | null) => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-bold text-foreground">Step 1: Request details</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Choose request type and your shift.</p>
      </div>

      <div className="flex gap-2">
        {(['swap', 'pickup'] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setRequestType(type)}
            className={cn(
              'rounded-lg border px-4 py-2 text-xs font-semibold capitalize transition-colors',
              requestType === type
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border bg-card text-muted-foreground hover:bg-secondary'
            )}
          >
            {type}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-foreground" htmlFor="selected-shift">
          Select shift
        </label>
        <select
          id="selected-shift"
          value={selectedShift ?? ''}
          onChange={(e) => setSelectedShift(e.target.value || null)}
          className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <option value="">Choose an upcoming shift</option>
          {myShifts.map((shift) => (
            <option key={shift.id} value={shift.id}>
              {shift.date} - {shift.type}
              {shift.isLead ? ' (Lead)' : ''}
            </option>
          ))}
        </select>
      </div>

      {selectedShiftData ? (
        <div className="rounded-lg border border-border bg-muted/50 px-3 py-2.5">
          <p className="text-sm font-semibold text-foreground">
            {selectedShiftData.date} - {selectedShiftData.type}
          </p>
          <p className="text-xs text-muted-foreground">
            {selectedShiftData.dow}
            {selectedShiftData.isLead ? ' - Lead assignment' : ''}
          </p>
        </div>
      ) : null}

      {selectedShiftRequiresLeadEligibleReplacement ? (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-3 py-2.5">
          <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--warning-text)]" />
          <p className="text-xs font-semibold text-[var(--warning-text)]">
            This is the only lead assignment on this shift. Your replacement must be lead eligible.
          </p>
        </div>
      ) : null}
    </div>
  )
}
