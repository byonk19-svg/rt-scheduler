'use client'

import { Star } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { RequestType, TeamMember } from '@/components/requests/request-types'

export function RequestFormTeammateStep({
  eligibleMembers,
  requestType,
  search,
  selectedShiftRequiresLeadEligibleReplacement,
  setSearch,
  setSwapWith,
  swapWith,
}: {
  eligibleMembers: TeamMember[]
  requestType: RequestType
  search: string
  selectedShiftRequiresLeadEligibleReplacement: boolean
  setSearch: (value: string) => void
  setSwapWith: (value: string | null) => void
  swapWith: string | null
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-bold text-foreground">Step 2: Choose teammate</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Team members are filtered by shift type
          {selectedShiftRequiresLeadEligibleReplacement ? ' and lead eligibility' : ''}.
        </p>
      </div>

      {selectedShiftRequiresLeadEligibleReplacement ? (
        <div className="flex items-center gap-1.5 rounded-md border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-3 py-1.5">
          <Star className="h-3 w-3 text-[var(--warning-text)]" />
          <p className="text-xs font-semibold text-[var(--warning-text)]">
            Lead filter active - showing lead-eligible staff only
          </p>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-foreground" htmlFor="member-search">
          Search teammates
        </label>
        <input
          id="member-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name..."
          className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none"
        />
      </div>

      <div className="space-y-2">
        {eligibleMembers.length === 0 ? (
          <p className="rounded-md border border-border bg-muted/50 px-3 py-3 text-xs text-muted-foreground">
            No eligible teammates found for this shift.
          </p>
        ) : (
          eligibleMembers.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => setSwapWith(member.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                swapWith === member.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-card hover:bg-secondary'
              )}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--attention)]">
                <span className="text-xs font-bold text-accent-foreground">{member.avatar}</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{member.name}</p>
                <p className="text-xs text-muted-foreground">
                  {member.shift}
                  {member.isLead ? ' - Lead eligible' : ''}
                </p>
              </div>
              {member.isLead ? <Star className="h-3.5 w-3.5 text-[var(--attention)]" /> : null}
            </button>
          ))
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {requestType === 'swap'
          ? 'Selecting a swap partner is optional. Leave blank to post an open swap.'
          : 'Pickup requests usually do not need a specific teammate.'}
      </p>
    </div>
  )
}
