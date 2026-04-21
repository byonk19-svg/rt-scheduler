'use client'

import { AlertCircle, ChevronLeft } from 'lucide-react'

import { RequestFormStepPanel } from '@/components/requests/RequestFormStepPanel'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { MyShift, RequestType, TeamMember } from '@/components/requests/request-types'

export function RequestFormFlow({
  error,
  eligibleMembers,
  handleBack,
  handleNextStep,
  handlePrevStep,
  handleSubmit,
  message,
  myShifts,
  requestType,
  search,
  selectedMember,
  selectedShift,
  selectedShiftData,
  selectedShiftRequiresLeadEligibleReplacement,
  setMessage,
  setRequestType,
  setSearch,
  setSelectedShift,
  setSwapWith,
  step,
  submitting,
  swapWith,
}: {
  error: string | null
  eligibleMembers: TeamMember[]
  handleBack: () => void
  handleNextStep: () => void
  handlePrevStep: () => void
  handleSubmit: () => void
  message: string
  myShifts: MyShift[]
  requestType: RequestType
  search: string
  selectedMember: TeamMember | null
  selectedShift: string | null
  selectedShiftData: MyShift | null
  selectedShiftRequiresLeadEligibleReplacement: boolean
  setMessage: (value: string) => void
  setRequestType: (value: RequestType) => void
  setSearch: (value: string) => void
  setSelectedShift: (value: string | null) => void
  setSwapWith: (value: string | null) => void
  step: 1 | 2 | 3
  submitting: boolean
  swapWith: string | null
}) {
  const stepTitle =
    step === 1 ? 'Request details' : step === 2 ? 'Choose teammate' : 'Final message'

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/90 bg-[color-mix(in_oklch,var(--card)_92%,var(--secondary))] px-4 py-4 shadow-tw-double-panel sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleBack}>
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
        <RequestFormStepPanel
          eligibleMembers={eligibleMembers}
          message={message}
          myShifts={myShifts}
          requestType={requestType}
          search={search}
          selectedMember={selectedMember}
          selectedShift={selectedShift}
          selectedShiftData={selectedShiftData}
          selectedShiftRequiresLeadEligibleReplacement={
            selectedShiftRequiresLeadEligibleReplacement
          }
          setMessage={setMessage}
          setRequestType={setRequestType}
          setSearch={setSearch}
          setSelectedShift={setSelectedShift}
          setSwapWith={setSwapWith}
          step={step}
          swapWith={swapWith}
        />

        <div className="flex justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <Button variant="outline" size="sm" onClick={handlePrevStep}>
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>
          {step < 3 ? (
            <Button size="sm" onClick={handleNextStep}>
              Continue
            </Button>
          ) : (
            <Button size="sm" disabled={submitting} onClick={handleSubmit}>
              {submitting ? 'Submitting...' : 'Submit request'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
