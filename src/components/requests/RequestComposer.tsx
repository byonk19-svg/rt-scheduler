import {
  AlertCircle,
  ArrowRightLeft,
  BadgeCheck,
  ChevronLeft,
  ShieldAlert,
  Sparkles,
  UserRoundSearch,
} from 'lucide-react'

import type { MyShift, TeamMember } from '@/components/requests/request-page-model'
import { getRequestComposerDisplayState } from '@/components/requests/request-composer-steps'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { RequestType, RequestVisibility } from '@/lib/request-workflow'

type RequestComposerProps = {
  eligibleMembers: TeamMember[]
  error: string | null
  message: string
  messageNeedsReview: boolean
  myShifts: MyShift[]
  requestType: RequestType
  requestVisibility: RequestVisibility
  search: string
  selectedMember: TeamMember | null
  selectedShift: string | null
  selectedShiftData: MyShift | null
  selectedShiftRequiresLeadEligibleReplacement: boolean
  step: 1 | 2 | 3
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

function verdictMeta(verdict: TeamMember['verdict']) {
  switch (verdict) {
    case 'coverage_safe':
      return {
        label: 'Coverage-safe',
        className:
          'border-[var(--success-border)] bg-[var(--success-subtle)] text-[var(--success-text)]',
        icon: <BadgeCheck className="h-3.5 w-3.5" />,
      }
    case 'needs_manager_review':
      return {
        label: 'Needs manager review',
        className:
          'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]',
        icon: <ShieldAlert className="h-3.5 w-3.5" />,
      }
    default:
      return {
        label: 'Not allowed',
        className: 'border-border bg-muted text-muted-foreground',
        icon: <AlertCircle className="h-3.5 w-3.5" />,
      }
  }
}

export function RequestComposer({
  eligibleMembers,
  error,
  message,
  messageNeedsReview,
  myShifts,
  requestType,
  requestVisibility,
  search,
  selectedMember,
  selectedShift,
  selectedShiftData,
  selectedShiftRequiresLeadEligibleReplacement,
  step,
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
  const stepState = getRequestComposerDisplayState(requestVisibility, requestType, step)
  const reviewStep = stepState.steps.find((item) => item.id === 3) ?? stepState.currentStep
  const isSwap = requestType === 'swap'
  const isDirectSwap = isSwap && requestVisibility === 'direct'
  const autoSelectedShift = myShifts.length === 1 && selectedShiftData
  const canContinue =
    step === 1
      ? selectedShift !== null
      : step === 2
        ? requestVisibility !== 'direct' || swapWith !== null
        : true

  const safeCandidates = eligibleMembers.filter((member) => member.verdict === 'coverage_safe')
  const reviewCandidates = eligibleMembers.filter(
    (member) => member.verdict === 'needs_manager_review'
  )
  const hiddenCandidates = eligibleMembers.filter((member) => member.verdict === 'not_allowed')
  const showSearch = eligibleMembers.length >= 7

  const selectedVerdict = verdictMeta(selectedMember?.verdict)

  return (
    <div className="space-y-5">
      <div className="rounded-[28px] border border-border/70 bg-[linear-gradient(180deg,color-mix(in_oklch,var(--card)_92%,white),color-mix(in_oklch,var(--card)_96%,var(--secondary)))] px-5 py-5 shadow-tw-double-panel sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" onClick={onBack}>
              <ChevronLeft className="mr-1 h-3.5 w-3.5" />
              Back
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              {stepState.steps.map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  <span
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-bold',
                      stepState.currentStep.displayStep >= item.displayStep
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-muted-foreground'
                    )}
                  >
                    {item.displayStep}
                  </span>
                  <span
                    className={cn(
                      'text-xs font-semibold',
                      stepState.currentStep.id === item.id
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    )}
                  >
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Step {stepState.currentStep.displayStep} of {stepState.totalSteps}
          </span>
        </div>

        <div className="mt-4 max-w-3xl">
          <p className="font-heading text-2xl font-bold tracking-tight text-foreground">
            {isSwap
              ? requestVisibility === 'direct'
                ? 'Find the best way to swap this shift'
                : 'Post an open swap request'
              : 'Ask for pickup coverage'}
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {isSwap
              ? requestVisibility === 'direct'
                ? 'Ask a teammate about a shift swap, see whether the exchange looks safe, then send it for review.'
                : 'Post your shift for swap review when you do not have a teammate in mind yet.'
              : requestVisibility === 'direct'
                ? 'Ask a specific teammate to cover this shift, then send it for manager review.'
                : 'Post this shift to the board so interested teammates can respond.'}
          </p>
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--error-border)] bg-[var(--error-subtle)] px-4 py-3 text-sm font-medium text-[var(--error-text)]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      <div className="rounded-[24px] border border-border/70 bg-card px-5 py-5 shadow-sm sm:px-6">
        {step === 1 ? (
          <div className="space-y-5">
            <div>
              <p className="text-base font-semibold text-foreground">
                Which shift are you trying to change?
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Start with your shift, then we can look for the clearest next move.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {(['swap', 'pickup'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => onRequestTypeChange(type)}
                  className={cn(
                    'rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
                    requestType === type
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-muted-foreground hover:bg-secondary'
                  )}
                >
                  {type === 'swap' ? 'Swap this shift' : 'Need pickup coverage'}
                </button>
              ))}
            </div>

            {isSwap ? (
              <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                <p className="text-sm font-semibold text-foreground">How do you want to start?</p>
                <div className="mt-3 space-y-3">
                  <button
                    type="button"
                    onClick={() => onRequestVisibilityChange('direct')}
                    className={cn(
                      'w-full rounded-2xl border px-4 py-4 text-left transition-colors',
                      requestVisibility === 'direct'
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card hover:bg-secondary'
                    )}
                  >
                    <p className="text-sm font-semibold text-foreground">Ask a specific teammate</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      See whether the swap looks safe before you send it.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => onRequestVisibilityChange('team')}
                    className={cn(
                      'w-full rounded-2xl border px-4 py-4 text-left transition-colors',
                      requestVisibility === 'team'
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card hover:bg-secondary'
                    )}
                  >
                    <p className="text-sm font-semibold text-foreground">
                      Post an open swap instead
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Use this when you do not have a teammate in mind yet.
                    </p>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Request path</p>
                <div className="flex flex-wrap gap-2">
                  {(['direct', 'team'] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => onRequestVisibilityChange(value)}
                      className={cn(
                        'rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
                        requestVisibility === value
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-card text-muted-foreground hover:bg-secondary'
                      )}
                    >
                      {value === 'direct' ? 'Ask a specific teammate' : 'Post to the board'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {autoSelectedShift ? (
              <div className="rounded-2xl border border-[var(--info-border)] bg-[var(--info-subtle)]/45 px-4 py-4">
                <p className="text-sm font-semibold text-foreground">
                  Your shift is already selected
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  You only have one eligible upcoming shift for this request.
                </p>
                <div className="mt-3 rounded-xl border border-border/70 bg-card px-3 py-3">
                  <p className="text-sm font-semibold text-foreground">
                    {selectedShiftData.date} · {selectedShiftData.type}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedShiftData.dow}
                    {selectedShiftData.isLead ? ' · Lead assignment' : ''}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground" htmlFor="selected-shift">
                  Select shift
                </label>
                <select
                  id="selected-shift"
                  value={selectedShift ?? ''}
                  onChange={(event) => onSelectedShiftChange(event.target.value || null)}
                  className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <option value="">Choose one of your upcoming shifts...</option>
                  {myShifts.map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {shift.date} · {shift.type}
                      {shift.isLead ? ' (Lead)' : ''}
                    </option>
                  ))}
                </select>
                {myShifts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No published shifts are available for new requests right now.
                  </p>
                ) : null}
              </div>
            )}

            {selectedShiftRequiresLeadEligibleReplacement ? (
              <div className="flex items-start gap-2 rounded-2xl border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-4 py-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning-text)]" />
                <p className="text-sm font-medium text-[var(--warning-text)]">
                  This is the only lead assignment on this shift. Safer swap options will favor
                  lead-qualified teammates.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-5">
            {isSwap ? (
              <>
                <div className="max-w-3xl">
                  <p className="text-base font-semibold text-foreground">
                    Who do you want to ask first?
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    We sorted teammates by the clearest direct options first. Pick one to see what
                    the swap would do.
                  </p>
                </div>

                {showSearch ? (
                  <div className="space-y-2">
                    <label
                      className="text-sm font-semibold text-foreground"
                      htmlFor="teammate-search"
                    >
                      Search teammates
                    </label>
                    <input
                      id="teammate-search"
                      value={search}
                      onChange={(event) => onSearchChange(event.target.value)}
                      placeholder="Search by teammate name..."
                      className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 placeholder:text-muted-foreground"
                    />
                  </div>
                ) : null}

                <div className="space-y-6">
                  <section className="space-y-3">
                    <div className="flex items-center gap-2">
                      <UserRoundSearch className="h-4 w-4 text-primary" />
                      <p className="text-sm font-semibold text-foreground">Best direct options</p>
                    </div>
                    {safeCandidates.length === 0 ? (
                      <div className="rounded-2xl border border-border/70 bg-muted/15 px-4 py-4">
                        <p className="text-sm font-semibold text-foreground">
                          No strong direct swap options for this shift right now.
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          You can still ask a teammate who needs manager review, or post an open
                          swap instead.
                        </p>
                      </div>
                    ) : (
                      safeCandidates.map((member) => (
                        <TeammateCard
                          key={member.id}
                          member={member}
                          selected={swapWith === member.id}
                          onSelect={() => onSwapWithChange(member.id)}
                        />
                      ))
                    )}
                  </section>

                  {reviewCandidates.length > 0 ? (
                    <section className="space-y-3">
                      <p className="text-sm font-semibold text-foreground">
                        Still possible, but needs manager review
                      </p>
                      {reviewCandidates.map((member) => (
                        <TeammateCard
                          key={member.id}
                          member={member}
                          selected={swapWith === member.id}
                          onSelect={() => onSwapWithChange(member.id)}
                        />
                      ))}
                    </section>
                  ) : null}

                  <div className="rounded-2xl border border-dashed border-border bg-muted/10 px-4 py-4">
                    <p className="text-sm font-semibold text-foreground">
                      Don&apos;t have a teammate in mind?
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      You can keep this shift and message, then post an open swap instead.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3"
                      onClick={() => onRequestVisibilityChange('team')}
                    >
                      <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" />
                      Post an open swap instead
                    </Button>
                  </div>

                  {hiddenCandidates.length > 0 ? (
                    <details className="rounded-2xl border border-border/70 bg-card px-4 py-4">
                      <summary className="cursor-pointer text-sm font-semibold text-foreground">
                        Why not these other teammates?
                      </summary>
                      <div className="mt-3 space-y-3">
                        {hiddenCandidates.map((member) => (
                          <div
                            key={member.id}
                            className="rounded-xl border border-border bg-muted/20 px-3 py-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-foreground">{member.name}</p>
                              <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                                {member.shift}
                                {member.isLead ? ' · Lead-qualified' : ''}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {member.availabilityReason ?? 'Not available for this swap.'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-base font-semibold text-foreground">Who do you want to ask?</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Pick a teammate to ask directly before manager review.
                  </p>
                </div>
                {eligibleMembers.length === 0 ? (
                  <div className="rounded-2xl border border-border/70 bg-muted/15 px-4 py-4 text-sm text-muted-foreground">
                    No eligible teammates are available for this direct pickup right now.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {eligibleMembers.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => onSwapWithChange(member.id)}
                        className={cn(
                          'flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-4 text-left transition-colors',
                          swapWith === member.id
                            ? 'border-primary bg-primary/5 shadow-sm'
                            : 'border-border bg-card hover:bg-secondary'
                        )}
                      >
                        <div>
                          <p className="text-sm font-semibold text-foreground">{member.name}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {member.shift}
                            {member.isLead ? ' · Lead-qualified' : ''}
                          </p>
                        </div>
                        <span
                          className={cn(
                            'rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                            swapWith === member.id
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-card text-muted-foreground'
                          )}
                        >
                          {swapWith === member.id ? 'Selected' : 'Choose'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-5">
            <div className="max-w-3xl">
              <p className="text-base font-semibold text-foreground">
                Step {reviewStep.displayStep}: {reviewStep.label}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Double-check the request before you send it.
              </p>
            </div>

            {isDirectSwap && selectedShiftData && selectedMember ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <SwapDiagramCard
                    title="Before"
                    name="You"
                    shiftLabel={`${selectedShiftData.date} · ${selectedShiftData.type}`}
                    detail={selectedShiftData.isLead ? 'Lead assignment' : 'Current assignment'}
                  />
                  <SwapDiagramCard
                    title="After"
                    name={selectedMember.name}
                    shiftLabel={`${selectedShiftData.date} · ${selectedShiftData.type}`}
                    detail={
                      selectedMember.verdict === 'coverage_safe'
                        ? 'Coverage-safe swap'
                        : 'Needs manager review'
                    }
                  />
                </div>

                <div className={cn('rounded-2xl border px-4 py-4', selectedVerdict.className)}>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    {selectedVerdict.icon}
                    {selectedVerdict.label}
                  </div>
                  <p className="mt-2 text-sm">
                    {selectedMember.consequence ??
                      'Coverage-safe based on current schedule coverage.'}
                  </p>
                  {selectedMember.nextMove ? (
                    <p className="mt-2 text-sm opacity-90">{selectedMember.nextMove}</p>
                  ) : null}
                  <p className="mt-3 text-xs opacity-80">
                    Final approval still depends on manager review.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-border/70 bg-muted/15 px-4 py-4">
                <p className="text-sm font-semibold text-foreground">
                  {isSwap ? 'Open swap review' : 'Pickup request review'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isSwap
                    ? 'You have not chosen a teammate yet. Manager review will depend on who can cover both sides of the swap.'
                    : 'This request will be reviewed after it is posted.'}
                </p>
              </div>
            )}

            <div className="rounded-2xl border border-border/70 bg-card px-4 py-4">
              <p className="text-sm font-semibold text-foreground">Request summary</p>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <p>
                  <span className="font-semibold text-foreground">Shift:</span>{' '}
                  {selectedShiftData
                    ? `${selectedShiftData.date} · ${selectedShiftData.type}`
                    : 'Not selected'}
                </p>
                <p>
                  <span className="font-semibold text-foreground">Path:</span>{' '}
                  {isSwap
                    ? requestVisibility === 'direct'
                      ? 'Ask a specific teammate'
                      : 'Post an open swap'
                    : requestVisibility === 'direct'
                      ? 'Ask a specific teammate'
                      : 'Post to the board'}
                </p>
                {selectedMember ? (
                  <p>
                    <span className="font-semibold text-foreground">Teammate:</span>{' '}
                    {selectedMember.name}
                  </p>
                ) : null}
              </div>
            </div>

            {messageNeedsReview ? (
              <div className="rounded-2xl border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-4 py-3 text-sm text-[var(--warning-text)]">
                You changed teammates. Double-check your message before sending.
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground" htmlFor="request-message">
                Message
              </label>
              <textarea
                id="request-message"
                value={message}
                onChange={(event) => onMessageChange(event.target.value)}
                rows={4}
                placeholder="Add details for your teammate and manager..."
                className="w-full rounded-2xl border border-border bg-card px-3 py-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 placeholder:text-muted-foreground"
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex justify-between gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 shadow-sm">
        <Button variant="outline" size="sm" onClick={onPrevStep}>
          {step === 1 ? 'Cancel' : 'Back'}
        </Button>
        {step < 3 ? (
          <Button size="sm" disabled={!canContinue} onClick={onNextStep}>
            Continue
          </Button>
        ) : (
          <Button size="sm" disabled={submitting} onClick={() => void onSubmit()}>
            {submitting ? 'Sending...' : 'Submit request'}
          </Button>
        )}
      </div>
    </div>
  )
}

function TeammateCard({
  member,
  selected,
  onSelect,
}: {
  member: TeamMember
  selected: boolean
  onSelect: () => void
}) {
  const verdict = verdictMeta(member.verdict)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full rounded-3xl border px-4 py-4 text-left transition-colors',
        selected
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border bg-card hover:bg-secondary'
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-foreground">{member.name}</p>
            {member.isBestOption ? (
              <span className="rounded-full border border-primary/25 bg-primary text-[11px] font-semibold text-primary-foreground px-2.5 py-1">
                Best option
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
              {member.shift}
              {member.isLead ? ' · Lead-qualified' : ''}
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                verdict.className
              )}
            >
              {verdict.icon}
              {verdict.label}
            </span>
          </div>
        </div>
        <span
          className={cn(
            'mt-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
            selected
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-card text-muted-foreground'
          )}
        >
          {selected ? 'Selected' : 'Choose'}
        </span>
      </div>

      {member.currentShiftLabel ? (
        <p className="mt-3 text-sm text-muted-foreground">{member.currentShiftLabel}</p>
      ) : null}
      {member.consequence ? (
        <p className="mt-2 text-sm text-foreground/90">{member.consequence}</p>
      ) : null}
      {member.nextMove ? (
        <p className="mt-2 text-sm text-muted-foreground">{member.nextMove}</p>
      ) : null}
    </button>
  )
}

function SwapDiagramCard({
  title,
  name,
  shiftLabel,
  detail,
}: {
  title: string
  name: string
  shiftLabel: string
  detail: string
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </p>
      <p className="mt-3 text-base font-semibold text-foreground">{name}</p>
      <p className="mt-1 text-sm text-muted-foreground">{shiftLabel}</p>
      <p className="mt-2 text-sm text-foreground/80">{detail}</p>
    </div>
  )
}
