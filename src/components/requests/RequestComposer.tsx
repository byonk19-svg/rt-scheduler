import { AlertCircle, ChevronLeft, Star } from 'lucide-react'

import type { MyShift, TeamMember } from '@/components/requests/request-page-model'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { RequestType, RequestVisibility } from '@/lib/request-workflow'

type RequestComposerProps = {
  eligibleMembers: TeamMember[]
  error: string | null
  message: string
  myShifts: MyShift[]
  requestType: RequestType
  requestVisibility: RequestVisibility
  search: string
  selectedMember: TeamMember | null
  selectedShift: string | null
  selectedShiftData: MyShift | null
  selectedShiftRequiresLeadEligibleReplacement: boolean
  step: 1 | 2 | 3
  stepTitle: string
  submitting: boolean
  swapWith: string | null
  onBack: () => void
  onMessageChange: (value: string) => void
  onNextStep: () => void
  onPrevStep: () => void
  onRequestTypeChange: (value: RequestType) => void
  onRequestVisibilityChange: (value: RequestVisibility) => void
  onSearchChange: (value: string) => void
  onSelectedShiftChange: (value: string | null) => void
  onSubmit: () => Promise<void>
  onSwapWithChange: (value: string | null) => void
}

export function RequestComposer({
  eligibleMembers,
  error,
  message,
  myShifts,
  requestType,
  requestVisibility,
  search,
  selectedMember,
  selectedShift,
  selectedShiftData,
  selectedShiftRequiresLeadEligibleReplacement,
  step,
  stepTitle,
  submitting,
  swapWith,
  onBack,
  onMessageChange,
  onNextStep,
  onPrevStep,
  onRequestTypeChange,
  onRequestVisibilityChange,
  onSearchChange,
  onSelectedShiftChange,
  onSubmit,
  onSwapWithChange,
}: RequestComposerProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/90 bg-[color-mix(in_oklch,var(--card)_92%,var(--secondary))] px-4 py-4 shadow-tw-double-panel sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={onBack}>
              <ChevronLeft className="mr-1 h-3.5 w-3.5" />
              Back
            </Button>
            <div className="flex items-center gap-2">
              {([1, 2, 3] as const).map((n) => (
                <span
                  key={n}
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold',
                    step >= n
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-muted-foreground'
                  )}
                >
                  {n}
                </span>
              ))}
            </div>
          </div>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Step {step} of 3
          </span>
        </div>
        <p className="mt-3 text-sm font-semibold text-foreground">{stepTitle}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Complete each step to submit your request for manager review.
        </p>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--error-border)] bg-[var(--error-subtle)] px-4 py-3 text-sm font-medium text-[var(--error-text)]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-5">
          {step === 1 ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-bold text-foreground">Step 1: Request details</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Choose request type and one of your published shifts.
                </p>
              </div>

              <div className="flex gap-2">
                {(['swap', 'pickup'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => onRequestTypeChange(type)}
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
                <p className="text-xs font-semibold text-foreground">Request visibility</p>
                <div className="flex gap-2">
                  {(['team', 'direct'] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => onRequestVisibilityChange(value)}
                      className={cn(
                        'rounded-lg border px-4 py-2 text-xs font-semibold capitalize transition-colors',
                        requestVisibility === value
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border bg-card text-muted-foreground hover:bg-secondary'
                      )}
                    >
                      {value === 'team' ? 'Team board' : 'Direct request'}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {requestVisibility === 'direct'
                    ? 'Direct requests stay private between you, the selected teammate, and managers.'
                    : 'Team board requests are visible to the full published-schedule board.'}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground" htmlFor="selected-shift">
                  Select shift
                </label>
                <select
                  id="selected-shift"
                  value={selectedShift ?? ''}
                  onChange={(event) => onSelectedShiftChange(event.target.value || null)}
                  className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <option value="">Choose an upcoming shift...</option>
                  {myShifts.map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {shift.date} - {shift.type}
                      {shift.isLead ? ' (Lead)' : ''}
                    </option>
                  ))}
                </select>
                {myShifts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No published shifts are available for new requests right now. Swaps and pickups
                    stay paused while a schedule is reopened in preliminary.
                  </p>
                ) : null}
              </div>

              {selectedShiftData ? (
                <div className="rounded-lg border border-border bg-muted/50 px-3 py-2.5">
                  <p className="text-sm font-semibold text-foreground">
                    {selectedShiftData.date} - {selectedShiftData.type}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedShiftData.dow}
                    {selectedShiftData.isLead ? ' · Lead assignment' : ''}
                  </p>
                </div>
              ) : null}

              {selectedShiftRequiresLeadEligibleReplacement ? (
                <div className="flex items-start gap-2 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-3 py-2.5">
                  <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--warning-text)]" />
                  <p className="text-xs font-semibold text-[var(--warning-text)]">
                    This is the only lead assignment on this shift. Your replacement must be lead
                    eligible.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 2 ? (
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
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder="Search by name..."
                  className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 placeholder:text-muted-foreground"
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
                      onClick={() => onSwapWithChange(member.id)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                        swapWith === member.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-card hover:bg-secondary'
                      )}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--attention)]">
                        <span className="text-xs font-bold text-accent-foreground">
                          {member.avatar}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">{member.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {member.shift}
                          {member.isLead ? ' · Lead eligible' : ''}
                        </p>
                      </div>
                      {member.isLead ? (
                        <Star className="h-3.5 w-3.5 text-[var(--attention)]" />
                      ) : null}
                    </button>
                  ))
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                {requestVisibility === 'direct'
                  ? 'Pick the teammate you want to send this request to.'
                  : requestType === 'swap'
                    ? 'Selecting a swap partner is optional. Leave blank to post an open swap.'
                    : 'Pickup requests usually do not need a specific teammate.'}
              </p>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-bold text-foreground">Step 3: Final message</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Add context before posting your request.
                </p>
              </div>

              <div className="space-y-1 rounded-lg border border-border bg-muted/50 px-3 py-3">
                <p className="text-xs font-semibold capitalize text-foreground">
                  Type: {requestType}
                </p>
                <p className="text-xs text-muted-foreground">
                  Shift:{' '}
                  {selectedShiftData
                    ? `${selectedShiftData.date} - ${selectedShiftData.type}`
                    : 'Not selected'}
                </p>
                {requestVisibility === 'direct' ? (
                  <p className="text-xs text-muted-foreground">
                    With: {selectedMember ? selectedMember.name : 'No specific teammate'}
                  </p>
                ) : null}
                <p className="text-xs capitalize text-muted-foreground">
                  Visibility: {requestVisibility === 'direct' ? 'Direct request' : 'Team board'}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground" htmlFor="request-message">
                  Message
                </label>
                <textarea
                  id="request-message"
                  value={message}
                  onChange={(event) => onMessageChange(event.target.value)}
                  rows={4}
                  placeholder="Add details for your manager and team..."
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 placeholder:text-muted-foreground"
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <Button variant="outline" size="sm" onClick={onPrevStep}>
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>
          {step < 3 ? (
            <Button size="sm" onClick={onNextStep}>
              Continue
            </Button>
          ) : (
            <Button size="sm" disabled={submitting} onClick={() => void onSubmit()}>
              {submitting ? 'Submitting...' : 'Submit request'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
