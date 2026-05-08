import {
  AlertCircle,
  ArrowRightLeft,
  BadgeCheck,
  Bookmark,
  CalendarDays,
  CheckCircle2,
  Info,
  Search,
  Send,
  ShieldAlert,
} from 'lucide-react'

import type { MyShift, TeamMember } from '@/components/requests/request-page-model'
import { getRequestComposerDisplayState } from '@/components/requests/request-composer-steps'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { RequestType, RequestVisibility } from '@/lib/request-workflow'

export type SwapRequestPath = 'direct' | 'team_suggested' | 'team_open'

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
  swapPath: SwapRequestPath
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
  onSwapPathChange: (value: SwapRequestPath) => void
  onSwapWithChange: (value: string | null) => void
}

function verdictMeta(verdict: TeamMember['verdict']) {
  switch (verdict) {
    case 'coverage_safe':
      return {
        label: 'Coverage-safe',
        shortLabel: 'Coverage-safe',
        className:
          'border-[var(--success-border)] bg-[var(--success-subtle)] text-[var(--success-text)]',
        dotClassName: 'bg-[var(--success-text)]',
        icon: <BadgeCheck className="h-3.5 w-3.5" />,
      }
    case 'needs_manager_review':
      return {
        label: 'Needs manager review',
        shortLabel: 'Needs review',
        className:
          'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]',
        dotClassName: 'bg-[var(--warning-text)]',
        icon: <ShieldAlert className="h-3.5 w-3.5" />,
      }
    default:
      return {
        label: 'Not available',
        shortLabel: 'Not available',
        className: 'border-border bg-muted text-muted-foreground',
        dotClassName: 'bg-muted-foreground',
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
  swapPath,
  swapWith,
  onMessageChange,
  onNextStep,
  onPrevStep,
  onRequestTypeChange,
  onRequestVisibilityChange,
  onSearchChange,
  onSelectedShiftChange,
  onSubmit,
  onSwapPathChange,
  onSwapWithChange,
}: RequestComposerProps) {
  const isSwap = requestType === 'swap'
  const isDirectSwap = isSwap && requestVisibility === 'direct'
  const isTeamSuggestedSwap = isSwap && swapPath === 'team_suggested'
  const isOpenTeamSwap = isSwap && swapPath === 'team_open'
  const showsTeammateStep =
    requestVisibility === 'direct' || (isSwap && swapPath === 'team_suggested')
  const stepState = getRequestComposerDisplayState(
    requestVisibility,
    requestType,
    step,
    showsTeammateStep
  )
  const canContinue =
    step === 1
      ? selectedShift !== null
      : step === 2
        ? !showsTeammateStep || swapWith !== null
        : true
  const canSubmit = selectedShift !== null && (!showsTeammateStep || swapWith !== null)

  const safeCandidates = eligibleMembers.filter((member) => member.verdict === 'coverage_safe')
  const reviewCandidates = eligibleMembers.filter(
    (member) => member.verdict === 'needs_manager_review'
  )
  const hiddenCandidates = eligibleMembers.filter((member) => member.verdict === 'not_allowed')
  const visibleTeammateStep = selectedShiftData && showsTeammateStep
  const selectedVerdict = verdictMeta(selectedMember?.verdict)
  const filteredCount = eligibleMembers.length
  const messageCount = message.length
  const visibleShiftChoices = myShifts.slice(0, 10)

  const title = isSwap ? 'Trade shift' : 'Give up shift'
  const subtitle = isSwap
    ? 'Pick the shift you want to trade and choose whether to ask a specific teammate or post to Open Shifts.'
    : 'Pick the shift you need covered, ask a specific teammate or post to Open Shifts, and send it for review.'

  return (
    <div className="relative left-1/2 w-[min(calc(100vw-5rem),1760px)] -translate-x-1/2 space-y-6 max-lg:left-auto max-lg:w-full max-lg:translate-x-0">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(520px,760px)] lg:items-center">
        <div className="flex min-w-0 items-start gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-[var(--success-border)] bg-[var(--success-subtle)] text-[var(--success-text)]">
            <ArrowRightLeft className="h-8 w-8" />
          </div>
          <div className="max-w-xl">
            <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
              {title}
            </h1>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{subtitle}</p>
          </div>
        </div>

        <StepRail steps={stepState.steps} currentDisplayStep={stepState.currentStep.displayStep} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(380px,430px)]">
        <div className="space-y-3">
          {error ? (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--error-border)] bg-[var(--error-subtle)] px-4 py-3 text-sm font-medium text-[var(--error-text)]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : null}

          <section className="rounded-lg border border-border bg-card px-6 py-5 shadow-sm">
            <div className="grid gap-3">
              <div>
                <p className="text-xl font-bold tracking-tight text-foreground">1. Your shift</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Which shift are you trying to change?
                </p>
              </div>
              <div className="grid w-full max-w-sm grid-cols-2 rounded-lg border border-border bg-muted/30 p-1">
                <SegmentButton
                  selected={requestType === 'swap'}
                  onClick={() => onRequestTypeChange('swap')}
                >
                  Trade shift
                </SegmentButton>
                <SegmentButton
                  selected={requestType === 'pickup'}
                  onClick={() => onRequestTypeChange('pickup')}
                >
                  Give up shift
                </SegmentButton>
              </div>
            </div>

            {isSwap ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                <PathButton
                  ariaLabel="Ask a specific teammate"
                  selected={swapPath === 'direct'}
                  onClick={() => onSwapPathChange('direct')}
                >
                  Ask a specific teammate
                </PathButton>
                <PathButton
                  ariaLabel="Suggest a teammate on the board"
                  selected={swapPath === 'team_suggested'}
                  onClick={() => onSwapPathChange('team_suggested')}
                >
                  Suggest teammate
                </PathButton>
                <PathButton
                  ariaLabel="Post an open swap instead"
                  selected={swapPath === 'team_open'}
                  onClick={() => onSwapPathChange('team_open')}
                >
                  Open Shifts
                </PathButton>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-1.5">
                <PathButton
                  ariaLabel="Ask a specific teammate"
                  selected={requestVisibility === 'direct'}
                  onClick={() => onRequestVisibilityChange('direct')}
                >
                  Ask a specific teammate
                </PathButton>
                <PathButton
                  ariaLabel="Post to the board"
                  selected={requestVisibility === 'team'}
                  onClick={() => onRequestVisibilityChange('team')}
                >
                  Open Shifts
                </PathButton>
              </div>
            )}

            <div className="mt-5 grid auto-cols-[minmax(126px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2">
              {visibleShiftChoices.map((shift) => (
                <ShiftChoiceCard
                  key={shift.id}
                  selected={selectedShift === shift.id}
                  shift={shift}
                  onSelect={() => onSelectedShiftChange(shift.id)}
                />
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-lg border border-[var(--success-border)] bg-[var(--success-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--success-text)]">
                All upcoming
              </span>
              <span className="inline-flex rounded-lg border border-border bg-muted/20 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                Lead shifts
              </span>
              <span className="inline-flex rounded-lg border border-border bg-muted/20 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                Weekends
              </span>
            </div>

            <div className="mt-4 max-w-md space-y-2 md:hidden">
              {myShifts.length === 1 && selectedShiftData ? (
                <p className="rounded-lg border border-[var(--info-border)] bg-[var(--info-subtle)] px-3 py-2 text-sm font-semibold text-[var(--info-text)]">
                  Your shift is already selected
                </p>
              ) : null}
              <label className="text-sm font-semibold text-foreground" htmlFor="selected-shift">
                Select shift
              </label>
              <select
                id="selected-shift"
                value={selectedShift ?? ''}
                onChange={(event) => onSelectedShiftChange(event.target.value || null)}
                className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="">Choose one of your upcoming shifts...</option>
                {myShifts.map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {shift.date} - {shift.type}
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

            {selectedShiftRequiresLeadEligibleReplacement ? (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-4 py-3">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning-text)]" />
                <p className="text-sm font-medium text-[var(--warning-text)]">
                  This is the only lead assignment on this shift. Safer options favor lead-qualified
                  teammates.
                </p>
              </div>
            ) : null}
          </section>

          {visibleTeammateStep ? (
            <section className="rounded-lg border border-border bg-card shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
                <div>
                  <p className="text-xl font-bold tracking-tight text-foreground">
                    2. Choose a teammate to ask
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {isTeamSuggestedSwap
                      ? 'Who should managers try first?'
                      : requestType === 'pickup'
                        ? 'Who do you want to ask?'
                        : 'Who do you want to ask first?'}
                  </p>
                </div>
                <div className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <BadgeCheck className="h-3.5 w-3.5 text-[var(--success-text)]" />
                  Coverage-safe trades keep staffing balanced.
                </div>
              </div>

              <div className="grid gap-3 border-b border-border px-5 py-4 lg:grid-cols-[minmax(220px,1fr)_180px_180px_170px]">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder="Search teammates by name..."
                    className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 placeholder:text-muted-foreground"
                  />
                </label>
                <FilterPill label="Any shift type" />
                <FilterPill label="Coverage-safe first" />
                <FilterPill label="Sort: Best match" />
              </div>

              <div className="px-5 py-4">
                {filteredCount === 0 ? (
                  <div className="rounded-lg border border-border bg-muted/15 px-4 py-5 text-sm text-muted-foreground">
                    No teammates match that search.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-border">
                    {requestType === 'pickup' ? (
                      <TeammateSection
                        title="Available teammates"
                        members={eligibleMembers}
                        selectedId={swapWith}
                        onSelect={onSwapWithChange}
                      />
                    ) : (
                      <>
                        <TeammateSection
                          title="Best direct options"
                          members={safeCandidates}
                          selectedId={swapWith}
                          onSelect={onSwapWithChange}
                          emptyText="No strong direct swap options for this shift right now."
                        />
                        {reviewCandidates.length > 0 ? (
                          <TeammateSection
                            title="Worth checking"
                            members={reviewCandidates}
                            selectedId={swapWith}
                            onSelect={onSwapWithChange}
                          />
                        ) : null}
                        {hiddenCandidates.length > 0 ? (
                          <TeammateSection
                            title="Pickup only"
                            members={hiddenCandidates}
                            selectedId={swapWith}
                            onSelect={onSwapWithChange}
                          />
                        ) : null}
                      </>
                    )}
                  </div>
                )}
              </div>
            </section>
          ) : null}

          {selectedShiftData && !showsTeammateStep ? (
            <section className="rounded-lg border border-border bg-card px-5 py-5 shadow-sm">
              <p className="text-xl font-bold tracking-tight text-foreground">
                2. Review board request
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {isOpenTeamSwap
                  ? 'This open swap goes to the team board for manager review.'
                  : 'This pickup request goes to the team board so available teammates can respond.'}
              </p>
            </section>
          ) : null}
        </div>

        <RequestPreview
          canSubmit={canSubmit}
          isDirectSwap={isDirectSwap}
          isOpenTeamSwap={isOpenTeamSwap}
          isTeamSuggestedSwap={isTeamSuggestedSwap}
          message={message}
          messageCount={messageCount}
          messageNeedsReview={messageNeedsReview}
          requestType={requestType}
          selectedMember={selectedMember}
          selectedShiftData={selectedShiftData}
          selectedVerdict={selectedVerdict}
          submitting={submitting}
          onMessageChange={onMessageChange}
          onNextStep={onNextStep}
          onPrevStep={onPrevStep}
          onSubmit={onSubmit}
          step={step}
          canContinue={canContinue}
        />
      </div>
    </div>
  )
}

function StepRail({
  currentDisplayStep,
  steps,
}: {
  currentDisplayStep: number
  steps: Array<{ displayStep: number; label: string }>
}) {
  return (
    <div className="px-2 py-2">
      <div className="grid gap-3 md:grid-cols-3">
        {steps.map((item, index) => {
          const active = currentDisplayStep >= item.displayStep
          return (
            <div key={item.displayStep} className="flex items-center gap-3">
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-bold',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-muted text-muted-foreground'
                )}
              >
                {item.displayStep}
              </span>
              <span
                className={cn(
                  'text-sm font-medium',
                  active ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {toStepLabel(item.label)}
              </span>
              {index < steps.length - 1 ? (
                <span className="hidden h-px flex-1 bg-border md:block" />
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SegmentButton({
  children,
  onClick,
  selected,
}: {
  children: React.ReactNode
  onClick: () => void
  selected: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'min-w-32 rounded-md px-4 py-2 text-sm font-semibold transition-colors',
        selected
          ? 'bg-card text-primary shadow-sm ring-1 ring-primary/30'
          : 'text-muted-foreground hover:bg-card/70 hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}

function PathButton({
  ariaLabel,
  children,
  onClick,
  selected,
}: {
  ariaLabel: string
  children: React.ReactNode
  onClick: () => void
  selected: boolean
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        'rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors',
        selected
          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
          : 'border-border bg-card text-muted-foreground hover:bg-secondary'
      )}
    >
      {children}
    </button>
  )
}

function ShiftChoiceCard({
  onSelect,
  selected,
  shift,
}: {
  onSelect: () => void
  selected: boolean
  shift: MyShift
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'min-h-24 rounded-xl border px-4 py-3 text-left transition-colors',
        selected
          ? 'border-primary bg-[var(--success-subtle)]/50 shadow-sm'
          : 'border-border bg-card hover:bg-secondary/50'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {shift.dow.slice(0, 3)}
          </p>
          <p className="mt-1 text-base font-bold text-foreground">{shift.date}</p>
        </div>
        {selected ? <CheckCircle2 className="h-4 w-4 text-[var(--success-text)]" /> : null}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">{shift.type}</span>
        {shift.isLead ? (
          <span className="rounded-full border border-[var(--success-border)] bg-[var(--success-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--success-text)]">
            Lead
          </span>
        ) : null}
      </div>
    </button>
  )
}

function FilterPill({ label }: { label: string }) {
  return (
    <div className="flex h-10 items-center rounded-lg border border-border bg-muted/20 px-3 text-sm font-medium text-muted-foreground">
      {label}
    </div>
  )
}

function TeammateSection({
  emptyText,
  members,
  onSelect,
  selectedId,
  title,
}: {
  emptyText?: string
  members: TeamMember[]
  onSelect: (id: string) => void
  selectedId: string | null
  title: string
}) {
  return (
    <section>
      <div className="flex items-center gap-2 border-b border-border bg-muted/25 px-4 py-2">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
        <Info className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      {members.length === 0 ? (
        <div className="px-4 py-4 text-sm text-muted-foreground">
          {emptyText ?? 'No teammates available in this group.'}
        </div>
      ) : (
        members.map((member) => (
          <TeammateRow
            key={member.id}
            member={member}
            selected={selectedId === member.id}
            onSelect={() => onSelect(member.id)}
          />
        ))
      )}
    </section>
  )
}

function TeammateRow({
  member,
  onSelect,
  selected,
}: {
  member: TeamMember
  onSelect: () => void
  selected: boolean
}) {
  const verdict = verdictMeta(member.verdict)

  return (
    <button
      type="button"
      data-testid={`teammate-option-${member.id}`}
      onClick={onSelect}
      className={cn(
        'grid w-full gap-3 border-b border-border px-4 py-2.5 text-left transition-colors last:border-b-0 md:grid-cols-[minmax(180px,1fr)_minmax(130px,170px)_minmax(220px,1.2fr)_32px]',
        selected ? 'bg-[var(--success-subtle)]/45' : 'bg-card hover:bg-secondary/45'
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
          {member.avatar}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-foreground">{member.name}</p>
            {member.isBestOption ? (
              <span className="rounded-full bg-[var(--success-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--success-text)]">
                Best fit
              </span>
            ) : null}
            {member.isLead ? (
              <span className="rounded-full bg-[var(--warning-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--warning-text)]">
                Lead
              </span>
            ) : null}
          </div>
          <span
            className={cn(
              'mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold',
              verdict.className
            )}
          >
            {verdict.shortLabel}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CalendarDays className="h-4 w-4" />
        <span>{member.currentShiftLabel ?? `${member.shift} shift`}</span>
      </div>

      <div className="text-sm text-muted-foreground">
        <p className="font-medium text-foreground">
          {member.consequence ?? `Can help with this ${member.shift.toLowerCase()} request.`}
        </p>
        {member.nextMove || member.availabilityReason ? (
          <p className="mt-0.5 text-xs">{member.nextMove ?? member.availabilityReason}</p>
        ) : null}
      </div>

      <span
        className={cn(
          'mt-1 flex h-5 w-5 items-center justify-center rounded-full border md:justify-self-end',
          selected ? 'border-primary bg-primary' : 'border-border bg-card'
        )}
      >
        {selected ? <span className="h-2 w-2 rounded-full bg-primary-foreground" /> : null}
      </span>
    </button>
  )
}

function RequestPreview({
  canContinue,
  canSubmit,
  isDirectSwap,
  isOpenTeamSwap,
  isTeamSuggestedSwap,
  message,
  messageCount,
  messageNeedsReview,
  onMessageChange,
  onNextStep,
  onPrevStep,
  onSubmit,
  requestType,
  selectedMember,
  selectedShiftData,
  selectedVerdict,
  step,
  submitting,
}: {
  canContinue: boolean
  canSubmit: boolean
  isDirectSwap: boolean
  isOpenTeamSwap: boolean
  isTeamSuggestedSwap: boolean
  message: string
  messageCount: number
  messageNeedsReview: boolean
  onMessageChange: (value: string) => void
  onNextStep: () => void
  onPrevStep: () => void
  onSubmit: () => Promise<void>
  requestType: RequestType
  selectedMember: TeamMember | null
  selectedShiftData: MyShift | null
  selectedVerdict: ReturnType<typeof verdictMeta>
  step: 1 | 2 | 3
  submitting: boolean
}) {
  const showTradeCards = requestType === 'swap'
  const reviewReady = selectedShiftData && (!showTradeCards || selectedMember || isOpenTeamSwap)
  const submitLabel =
    step < 3
      ? 'Continue'
      : submitting
        ? 'Sending...'
        : requestType === 'swap'
          ? 'Submit request'
          : 'Submit request'

  return (
    <aside className="xl:sticky xl:top-16 xl:self-start">
      <div className="rounded-lg border border-border bg-card px-6 py-6 shadow-sm">
        <p className="text-xl font-bold tracking-tight text-foreground">Request preview</p>
        <p className="mt-1 text-sm text-muted-foreground">Here is what this request looks like.</p>

        {showTradeCards ? (
          <div className="mt-5 grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr] xl:grid-cols-[1fr_auto_1fr]">
            <PreviewShiftCard
              eyebrow="You give"
              name="Your shift"
              shiftLabel={
                selectedShiftData
                  ? `${selectedShiftData.date} - ${selectedShiftData.type}`
                  : 'Select a shift'
              }
              isLead={selectedShiftData?.isLead ?? false}
            />
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <PreviewShiftCard
              eyebrow={isOpenTeamSwap ? 'Manager finds' : 'You ask'}
              name={selectedMember?.name ?? (isOpenTeamSwap ? 'Open swap' : 'Choose teammate')}
              shiftLabel={
                selectedMember?.currentShiftLabel ?? selectedMember?.shift ?? 'Pick a teammate'
              }
              isLead={selectedMember?.isLead ?? false}
            />
          </div>
        ) : (
          <div className="mt-5">
            <PreviewShiftCard
              eyebrow="You give up"
              name="Pickup coverage"
              shiftLabel={
                selectedShiftData
                  ? `${selectedShiftData.date} - ${selectedShiftData.type}`
                  : 'Select a shift'
              }
              isLead={selectedShiftData?.isLead ?? false}
            />
          </div>
        )}

        <div className="mt-5 space-y-3">
          <div className="rounded-lg border border-border bg-muted/20 px-3 py-3">
            <p className="text-sm font-semibold text-foreground">Request summary</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {getPreviewPathLabel({
                isDirectSwap,
                isOpenTeamSwap,
                isTeamSuggestedSwap,
                requestType,
              })}
            </p>
          </div>
          <PreviewCheck complete={Boolean(selectedShiftData)} label="Selected shift" />
          <PreviewCheck
            complete={Boolean(selectedMember) || isOpenTeamSwap || requestType === 'pickup'}
            label={
              isOpenTeamSwap
                ? 'Open team-board swap'
                : requestType === 'pickup'
                  ? 'Pickup path selected'
                  : 'Selected teammate'
            }
          />
          <PreviewCheck
            complete={Boolean(reviewReady)}
            label={
              selectedMember?.verdict === 'needs_manager_review'
                ? 'Manager review needed'
                : 'Coverage check ready'
            }
            detail={
              selectedMember
                ? selectedVerdict.label
                : isOpenTeamSwap
                  ? 'Manager will review possible partners.'
                  : undefined
            }
          />
        </div>

        <div className="mt-5 space-y-2">
          <label className="text-sm font-semibold text-foreground" htmlFor="request-message">
            Message (optional)
          </label>
          <textarea
            id="request-message"
            value={message}
            onChange={(event) => onMessageChange(event.target.value)}
            rows={5}
            maxLength={250}
            placeholder={
              requestType === 'swap'
                ? 'Hey! Would you be up for trading this shift?'
                : 'Can someone cover this shift for me?'
            }
            className="w-full resize-none rounded-lg border border-border bg-card px-3 py-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 placeholder:text-muted-foreground"
          />
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{messageNeedsReview ? 'You changed teammates. Recheck this message.' : ' '}</span>
            <span>{messageCount}/250</span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {['Friendly', 'Flexible', 'Grateful', 'Professional'].map((tone) => (
            <span
              key={tone}
              className="rounded-full border border-border bg-muted/30 px-3 py-1 text-xs font-semibold text-muted-foreground"
            >
              {tone}
            </span>
          ))}
        </div>

        <div className="mt-5 space-y-2">
          {step < 3 ? (
            <Button className="w-full" disabled={!canContinue} onClick={onNextStep}>
              Continue
            </Button>
          ) : (
            <Button
              className="w-full"
              disabled={!canSubmit || submitting}
              onClick={() => void onSubmit()}
            >
              <Send className="h-4 w-4" />
              {submitLabel}
            </Button>
          )}
          <Button className="w-full" variant="outline" onClick={onPrevStep}>
            <Bookmark className="h-4 w-4" />
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>
        </div>

        <div className="mt-5 flex gap-3 rounded-lg border border-[var(--success-border)] bg-[var(--success-subtle)] px-4 py-3 text-sm text-[var(--success-text)]">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {isDirectSwap
              ? 'After your teammate accepts, your manager will review the swap.'
              : isTeamSuggestedSwap
                ? 'Your suggested partner goes to manager review with the request.'
                : 'A manager reviews board requests before the schedule changes.'}
          </p>
        </div>
      </div>
    </aside>
  )
}

function PreviewShiftCard({
  eyebrow,
  isLead,
  name,
  shiftLabel,
}: {
  eyebrow: string
  isLead: boolean
  name: string
  shiftLabel: string
}) {
  return (
    <div className="min-h-32 rounded-lg border border-border bg-card px-4 py-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {eyebrow}
      </p>
      <p className="mt-3 text-base font-bold text-foreground">{name}</p>
      <p className="mt-1 text-sm text-muted-foreground">{shiftLabel}</p>
      {isLead ? (
        <span className="mt-3 inline-flex rounded-full border border-[var(--success-border)] bg-[var(--success-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--success-text)]">
          Lead
        </span>
      ) : null}
    </div>
  )
}

function PreviewCheck({
  complete,
  detail,
  label,
}: {
  complete: boolean
  detail?: string
  label: string
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
          complete
            ? 'border-[var(--success-border)] bg-primary text-primary-foreground'
            : 'border-border bg-muted text-muted-foreground'
        )}
      >
        {complete ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
      </span>
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {detail ? <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p> : null}
      </div>
    </div>
  )
}

function getPreviewPathLabel({
  isDirectSwap,
  isOpenTeamSwap,
  isTeamSuggestedSwap,
  requestType,
}: {
  isDirectSwap: boolean
  isOpenTeamSwap: boolean
  isTeamSuggestedSwap: boolean
  requestType: RequestType
}) {
  if (requestType === 'pickup') {
    return 'Ask a specific teammate or post to Open Shifts for pickup coverage.'
  }

  if (isDirectSwap) {
    return 'Ask a specific teammate, then send the accepted swap to manager review.'
  }

  if (isTeamSuggestedSwap) {
    return 'Post to Open Shifts with a suggested teammate.'
  }

  if (isOpenTeamSwap) {
    return 'Post an open trade to Open Shifts for manager review.'
  }

  return 'Review and send this request.'
}

function toStepLabel(label: string) {
  if (label === 'Request details') return 'Choose your shift'
  if (label === 'Choose teammate') return 'Pick a teammate'
  return 'Review & send'
}
