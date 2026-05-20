'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowRight,
  ArrowRightLeft,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Crown,
  ShieldCheck,
  UserPlus,
  UsersRound,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { partitionPickupInterestQueue } from '@/lib/pickup-interest-presentation'
import { MIN_SHIFT_COVERAGE_PER_DAY } from '@/lib/scheduling-constants'
import type { ShiftRole, ShiftType } from '@/lib/shift-types'
import { cn } from '@/lib/utils'

import {
  countStaffForShift,
  formatShiftType,
  getPlainStateLabel,
  getRequestMessageForDisplay,
  getRequestTypeLabel,
  getStaffingTone,
  getStaffingVerdict,
  getStateTone,
  getToneClasses,
  isOpenSwapWithoutPartner,
  isPickupWithoutResponders,
  isReadyForManagerDecision,
  isWaitingOnTeammate,
  type ProfileLookupRow,
  type ShiftBoardRequest,
} from './shift-board-model'

export function ManagerRequestCard({
  req,
  canReview,
  onPickupInterest,
  saving,
  interactiveEnabled,
  error,
  therapists,
  scheduledOnDate,
  scheduledOnSwapDate,
  shiftRole,
  swapPartnerId,
  onSwapPartnerChange,
  selectedPickupInterestId,
  onSelectPickupInterest,
  overrideReason,
  onOverrideReasonChange,
  onForceApprove,
  onAction,
  onViewShift,
  delay = 0,
}: {
  req: ShiftBoardRequest
  canReview: boolean
  onPickupInterest: () => void
  saving: boolean
  interactiveEnabled: boolean
  error?: string
  therapists: ProfileLookupRow[]
  scheduledOnDate: Map<string, ShiftType>
  scheduledOnSwapDate: Map<string, ShiftType>
  shiftRole: ShiftRole | null
  swapPartnerId: string
  onSwapPartnerChange: (id: string) => void
  selectedPickupInterestId: string | null
  onSelectPickupInterest: (id: string) => void
  overrideReason: string
  onOverrideReasonChange: (reason: string) => void
  onForceApprove: () => void
  onAction: (action: 'approve' | 'deny', opts?: { selectedInterestId?: string | null }) => void
  onViewShift: () => void
  delay?: number
}) {
  const isPending = req.status === 'pending'
  const pickupQueue =
    req.type === 'pickup' && req.visibility === 'team'
      ? partitionPickupInterestQueue(req.interestCandidates)
      : null
  const showsPartnerPicker =
    req.type === 'swap' && req.visibility === 'team' && isPending && canReview
  const needsLeadPartner = shiftRole === 'lead'
  const awaitingDirectAcceptance =
    req.visibility === 'direct' && req.recipientResponse !== 'accepted'
  // Filter to therapists working the same date and shift type; fall back to full list if coverage not loaded.
  const eligibleTherapists =
    scheduledOnDate.size > 0
      ? therapists.filter((t) => {
          if (t.id === req.postedById) return false
          if (t.id === req.swapWithId) return true
          if (!req.shiftType) return scheduledOnDate.has(t.id)
          return scheduledOnDate.get(t.id) === req.shiftType
        })
      : therapists.filter((t) => t.id !== req.postedById)
  const isOverrideableError = error?.startsWith('override:')
  const overrideMessage = isOverrideableError ? error!.slice('override:'.length).trim() : null
  const displayError = isOverrideableError ? null : error
  const stateLabel = getPlainStateLabel(req)
  const selectedPickupCandidate =
    pickupQueue?.orderedCandidates.find((candidate) => candidate.id === selectedPickupInterestId) ??
    pickupQueue?.primaryCandidate ??
    pickupQueue?.orderedCandidates[0] ??
    null
  const directPickupResponderName =
    req.type === 'pickup' && req.visibility === 'direct' ? req.swapWithName : null
  const selectedResponderName = selectedPickupCandidate?.therapistName ?? directPickupResponderName
  const swapPartnerName =
    req.swapWithName ??
    therapists.find((therapist) => therapist.id === swapPartnerId)?.full_name ??
    null
  const displayMessage = getRequestMessageForDisplay(req.message)
  const validApprovalAvailable = canReview && isReadyForManagerDecision(req)
  const approveSwapAvailable =
    canReview &&
    req.type === 'swap' &&
    isPending &&
    !awaitingDirectAcceptance &&
    Boolean(swapPartnerId)
  const requestTone =
    req.type === 'swap' ? 'info' : stateLabel === 'No responders yet' ? 'muted' : 'success'
  const railClass =
    requestTone === 'info'
      ? 'bg-[var(--info)] text-white'
      : requestTone === 'success'
        ? 'bg-[var(--success)] text-white'
        : 'bg-muted text-muted-foreground'
  const typeLabel = getRequestTypeLabel(req)

  return (
    <div
      className="fade-up scroll-mt-24 overflow-hidden rounded-xl border border-l-4 border-border bg-card shadow-sm transition-shadow hover:shadow-md"
      style={{
        animationDelay: `${delay}s`,
        borderLeftColor:
          requestTone === 'info'
            ? 'var(--info)'
            : requestTone === 'success'
              ? 'var(--success)'
              : 'var(--muted-foreground)',
      }}
    >
      <div className="flex flex-col gap-2 border-b border-border bg-background px-3 py-2 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <span
            className={cn(
              'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full shadow-sm',
              railClass
            )}
          >
            {req.type === 'swap' ? (
              <ArrowRightLeft className="h-4 w-4" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
          </span>
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                  getToneClasses(req.type === 'swap' ? 'info' : 'success')
                )}
              >
                {typeLabel}
              </span>
              {req.requestKind === 'call_in' ? (
                <span className="rounded-full border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--warning-text)]">
                  Call In help
                </span>
              ) : null}
            </div>
            <p className="break-words font-heading text-base font-semibold text-foreground">
              {typeLabel} - {req.shift}
            </p>
            <p className="mt-1 break-words text-sm text-muted-foreground">
              {req.type === 'swap'
                ? `${req.poster}${swapPartnerName ? ` swaps with ${swapPartnerName}` : ' needs a partner'}`
                : `Requested by ${req.poster}`}{' '}
              - {req.status === 'pending' ? 'Posted' : 'Updated'} {req.posted}
            </p>
            {displayMessage ? (
              <p className="mt-2 line-clamp-2 break-words text-sm text-muted-foreground">
                {displayMessage}
              </p>
            ) : null}
          </div>
        </div>
        <span
          className={cn(
            'inline-flex shrink-0 self-start rounded-full border px-2 py-0.5 text-[11px] font-bold',
            stateLabel === 'Ready for decision'
              ? 'border-[var(--warning-border)] bg-background text-[var(--warning-text)]'
              : getToneClasses(getStateTone(req))
          )}
        >
          {stateLabel}
        </span>
      </div>

      <div className="grid gap-2.5 p-2.5 lg:grid-cols-[minmax(240px,0.9fr)_minmax(420px,1.45fr)_minmax(230px,0.75fr)]">
        <div>
          {awaitingDirectAcceptance ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {swapPartnerName ?? 'The teammate'} needs to respond before manager approval is
              available.
            </p>
          ) : null}
          {req.type === 'pickup' && pickupQueue ? (
            <ResponderQueue queue={pickupQueue} selectedId={selectedPickupCandidate?.id ?? null} />
          ) : null}
          {showsPartnerPicker ? (
            <div className="mt-3">
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                {req.swapWithId ? 'Review swap partner' : 'Choose swap partner'}
              </label>
              {needsLeadPartner ? (
                <p className="mb-2 text-xs text-[var(--warning-text)]">
                  Lead shift - choose a lead-eligible therapist.
                </p>
              ) : null}
              <select
                id={`swap-partner-${req.id}`}
                value={swapPartnerId}
                onChange={(event) => onSwapPartnerChange(event.target.value)}
                disabled={saving || !interactiveEnabled}
                className="h-9 w-full rounded-md border border-border bg-card px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
              >
                <option value="">Choose partner</option>
                {eligibleTherapists.map((therapist) => {
                  const isLeadEligible = therapist.is_lead_eligible === true
                  const disabled = needsLeadPartner && !isLeadEligible
                  const shiftTypeLabel = scheduledOnDate.get(therapist.id)
                  return (
                    <option key={therapist.id} value={therapist.id} disabled={disabled}>
                      {therapist.full_name ?? therapist.id}
                      {shiftTypeLabel ? ` - ${shiftTypeLabel === 'day' ? 'Day' : 'Night'}` : ''}
                      {isLeadEligible ? ' (Lead)' : ''}
                      {disabled ? ' (not lead eligible)' : ''}
                    </option>
                  )
                })}
              </select>
            </div>
          ) : null}
          {req.status === 'denied' && req.overrideReason ? (
            <p className="mt-3 rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-2.5 py-1.5 text-xs text-[var(--error-text)]">
              Reason: {req.overrideReason}
            </p>
          ) : null}
          <RequestHistorySummary req={req} selectedResponderName={selectedResponderName} />
        </div>

        <div>
          <ScheduleImpactPreview
            req={req}
            scheduledOnDate={scheduledOnDate}
            scheduledOnSwapDate={scheduledOnSwapDate}
            selectedResponderName={selectedResponderName}
            selectedResponderId={selectedPickupCandidate?.therapistId ?? null}
            swapPartnerName={swapPartnerName}
          />
        </div>

        <RequestActionColumn
          req={req}
          canReview={canReview}
          saving={saving}
          interactiveEnabled={interactiveEnabled}
          validApprovalAvailable={validApprovalAvailable}
          approveSwapAvailable={approveSwapAvailable}
          selectedResponderName={selectedResponderName}
          hasBackupResponder={Boolean(pickupQueue && pickupQueue.backupCandidates.length > 0)}
          onChoosePartner={() => {
            window.setTimeout(() => {
              document.getElementById(`swap-partner-${req.id}`)?.focus()
            }, 0)
          }}
          onChooseDifferentResponder={() => {
            const backup = pickupQueue?.backupCandidates[0]
            if (backup) onSelectPickupInterest(backup.id)
          }}
          onPickupInterest={onPickupInterest}
          onApprove={() =>
            onAction('approve', { selectedInterestId: selectedPickupCandidate?.id ?? null })
          }
          onDeny={() => onAction('deny')}
          onViewShift={onViewShift}
        />
      </div>

      {displayError ? (
        <p
          role="alert"
          className="mx-3 mb-3 rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-xs text-[var(--error-text)]"
        >
          {displayError}
        </p>
      ) : null}

      {isOverrideableError && canReview ? (
        <div className="mx-3 mb-3 rounded-lg border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2.5">
          <p className="mb-2 text-xs font-semibold text-[var(--error-text)]">{overrideMessage}</p>
          <label className="mb-1 block text-xs font-medium text-[var(--error-text)]">
            Override reason <span className="font-normal opacity-70">(required)</span>
          </label>
          <input
            type="text"
            value={overrideReason}
            onChange={(event) => onOverrideReasonChange(event.target.value)}
            placeholder="e.g. lead coverage verified separately"
            disabled={saving}
            className="mb-2 h-8 w-full rounded-md border border-border bg-card px-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
          />
          <Button
            size="sm"
            variant="destructive"
            disabled={saving || !overrideReason.trim()}
            onClick={onForceApprove}
            className="w-full"
          >
            {saving ? 'Saving...' : 'Force approve'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function ResponderQueue({
  queue,
  selectedId,
}: {
  queue: ReturnType<
    typeof partitionPickupInterestQueue<ShiftBoardRequest['interestCandidates'][number]>
  >
  selectedId: string | null
}) {
  if (queue.orderedCandidates.length === 0) {
    return <p className="mt-2 text-sm text-muted-foreground">No responders yet.</p>
  }

  return (
    <div className="mt-2 space-y-1">
      <p className="flex items-center gap-1.5 text-xs font-semibold leading-tight text-muted-foreground">
        <UsersRound className="h-3.5 w-3.5" aria-hidden />
        Responder queue - {queue.orderedCandidates.length}{' '}
        {queue.orderedCandidates.length === 1 ? 'responder' : 'responders'}
      </p>
      {queue.orderedCandidates.map((candidate, index) => {
        const selected = candidate.id === selectedId
        return (
          <div
            key={candidate.id}
            className={cn(
              'flex items-start gap-2 rounded-lg border px-2 py-1.5',
              selected
                ? 'border-l-4 border-[var(--success-border)] border-l-[var(--success)] bg-[var(--success-subtle)]/45'
                : 'border-border bg-muted/30'
            )}
          >
            <span
              className={cn(
                'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                selected
                  ? 'bg-[var(--success)] text-white'
                  : 'bg-muted-foreground/20 text-muted-foreground'
              )}
            >
              {index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className="block whitespace-normal break-words text-sm font-semibold leading-tight text-foreground"
                title={candidate.therapistName}
              >
                {candidate.therapistName}
              </span>
              <span
                title={selected ? 'selected pickup responder' : 'backup responder'}
                className={cn(
                  'mt-0.5 block text-[10px] font-bold uppercase leading-tight',
                  selected ? 'text-[var(--success-text)]' : 'text-muted-foreground'
                )}
              >
                {selected ? 'Selected pickup responder' : 'Backup responder'}
              </span>
            </span>
            {selected ? (
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]"
                aria-label="Selected responder"
              />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function RequestHistorySummary({
  req,
  selectedResponderName,
}: {
  req: ShiftBoardRequest
  selectedResponderName: string | null
}) {
  const [open, setOpen] = useState(false)
  const firstResponder = req.interestCandidates
    .slice()
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0]
  const hasResponderHistory = req.type === 'pickup' && firstResponder

  return (
    <div className="mt-2 border-t border-border/70 pt-1.5 text-[11px] text-muted-foreground">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-0.5 text-left font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
        aria-expanded={open}
      >
        <span>Request history</span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 transition-transform', open ? 'rotate-180' : '')}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="mt-1 rounded-md bg-muted/20 px-2.5 py-2">
          <p>Posted {req.posted}</p>
          {hasResponderHistory ? (
            <p className="mt-0.5">
              First response: {firstResponder.therapistName}
              {selectedResponderName ? `; selected pickup responder: ${selectedResponderName}` : ''}
            </p>
          ) : null}
          {req.type === 'swap' && req.swapWithName ? (
            <p className="mt-0.5">Swap partner: {req.swapWithName}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function ScheduleImpactPreview({
  req,
  scheduledOnDate,
  scheduledOnSwapDate,
  selectedResponderName,
  selectedResponderId,
  swapPartnerName,
}: {
  req: ShiftBoardRequest
  scheduledOnDate: Map<string, ShiftType>
  scheduledOnSwapDate: Map<string, ShiftType>
  selectedResponderName: string | null
  selectedResponderId: string | null
  swapPartnerName: string | null
}) {
  const currentStaff = countStaffForShift(scheduledOnDate, req.shiftType)
  const selectedAlreadyOnShift =
    Boolean(selectedResponderId && req.shiftType) &&
    scheduledOnDate.get(selectedResponderId ?? '') === req.shiftType
  const afterPickupStaff =
    selectedResponderName && !selectedAlreadyOnShift ? currentStaff + 1 : currentStaff
  const afterCoverage = getStaffingVerdict(afterPickupStaff)
  const swapStaff = countStaffForShift(scheduledOnSwapDate, req.swapShiftType ?? req.shiftType)
  const swapShiftLabel =
    req.swapShift ?? `${swapPartnerName ?? 'Partner'} ${formatShiftType(req.swapShiftType)} shift`
  const pickupKeepsCallIn = req.type === 'pickup'
  const pickupStaffingLine =
    afterPickupStaff > MIN_SHIFT_COVERAGE_PER_DAY
      ? 'Staffing stays above target.'
      : afterPickupStaff === MIN_SHIFT_COVERAGE_PER_DAY
        ? 'Staffing stays at target.'
        : 'Staffing remains below target.'

  if (isWaitingOnTeammate(req)) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-5 text-center">
        <Clock3 className="mx-auto h-4 w-4 text-muted-foreground" />
        <p className="mt-2 text-sm font-semibold text-foreground">
          Impact pending teammate response
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Manager approval will be available after {swapPartnerName ?? 'the teammate'} responds.
        </p>
      </div>
    )
  }

  if (req.type === 'swap') {
    return (
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          Schedule Impact
        </p>
        <p className="mb-2 text-xs text-muted-foreground">
          {req.poster} and {swapPartnerName ?? 'the selected partner'} trade assigned shifts;
          staffing count does not change.
        </p>
        <div className="grid gap-2 lg:grid-cols-[minmax(8rem,1fr)_auto_minmax(8rem,1fr)_minmax(16rem,1.15fr)]">
          <ImpactMiniCard
            eyebrow="Affected shift"
            title={req.shift}
            lines={[
              `Before: ${req.poster} on`,
              `After: ${swapPartnerName ?? 'Partner'} on`,
              `${currentStaff || MIN_SHIFT_COVERAGE_PER_DAY} scheduled / target ${MIN_SHIFT_COVERAGE_PER_DAY}`,
            ]}
            verdict="Staffing unchanged"
          />
          <span className="hidden items-center text-muted-foreground lg:flex">
            <ArrowRight className="h-4 w-4" />
          </span>
          <ImpactMiniCard
            eyebrow="Counterpart shift"
            title={swapShiftLabel}
            lines={[
              `Before: ${swapPartnerName ?? 'Partner'} on`,
              `After: ${req.poster} on`,
              `${swapStaff || MIN_SHIFT_COVERAGE_PER_DAY} scheduled / target ${MIN_SHIFT_COVERAGE_PER_DAY}`,
            ]}
            verdict="Staffing unchanged"
          />
          <div className="rounded-lg border border-border bg-background px-3 py-2.5 text-xs leading-normal text-muted-foreground">
            <p className="font-semibold text-foreground">Coverage summary</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <ImpactBadge>
                <ShieldCheck className="h-3 w-3" aria-hidden />
                No coverage risk
              </ImpactBadge>
              <ImpactBadge>Staffing unchanged</ImpactBadge>
              <ImpactBadge>
                <Crown className="h-3 w-3" aria-hidden />
                Lead covered
              </ImpactBadge>
            </div>
            <p className="mt-2 text-[11px] leading-normal">
              Both shifts remain at or above minimum staffing.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        Schedule Impact
      </p>
      <div className="rounded-lg border border-border bg-background px-3 py-2.5">
        <p className="text-sm font-semibold leading-snug text-foreground">
          {selectedResponderName ?? 'The selected responder'} will be added to {req.shift}.
        </p>
        <p className="mt-1 text-sm leading-snug text-muted-foreground">
          {pickupKeepsCallIn
            ? `The original call-in remains on the schedule. ${pickupStaffingLine}`
            : `The selected responder is added separately. ${pickupStaffingLine}`}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {afterPickupStaff} scheduled / target {MIN_SHIFT_COVERAGE_PER_DAY}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <ImpactBadge tone={getStaffingTone(afterCoverage)}>
            {afterCoverage === 'Below minimum' ? 'Below minimum' : 'Target met'}
          </ImpactBadge>
          <ImpactBadge>
            <Crown className="h-3 w-3" aria-hidden />
            Lead covered
          </ImpactBadge>
          <ImpactBadge tone={getStaffingTone(afterCoverage)}>
            {afterCoverage === 'Below minimum' ? 'Coverage risk' : 'No coverage risk'}
          </ImpactBadge>
        </div>
      </div>
    </div>
  )
}

function ImpactBadge({
  children,
  tone = 'success',
}: {
  children: ReactNode
  tone?: 'success' | 'error'
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold',
        getToneClasses(tone)
      )}
    >
      {children}
    </span>
  )
}

function ImpactMiniCard({
  eyebrow,
  title,
  lines,
  verdict,
  tone = 'success',
}: {
  eyebrow: string
  title: string
  lines: string[]
  verdict: string
  tone?: 'success' | 'error'
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-2">
      <p className="text-[10px] font-bold uppercase leading-tight tracking-wide text-muted-foreground">
        {eyebrow}
      </p>
      <p className="mt-1 text-xs font-bold leading-tight text-foreground">{title}</p>
      <div className="mt-1 space-y-0.5">
        {lines.map((line) => (
          <p
            key={line}
            className="flex items-center gap-1.5 text-[11px] leading-tight text-muted-foreground"
          >
            {line === 'Lead covered' ? <Crown className="h-3 w-3" /> : null}
            {line}
          </p>
        ))}
      </div>
      <span
        className={cn(
          'mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold leading-tight',
          getToneClasses(tone)
        )}
      >
        {verdict}
      </span>
    </div>
  )
}

function getActionNote(req: ShiftBoardRequest, selectedResponderName: string | null): string {
  if (isWaitingOnTeammate(req)) {
    return `Approval unlocks after ${req.swapWithName ?? 'the teammate'} responds.`
  }
  if (isOpenSwapWithoutPartner(req)) {
    return 'Choose the teammate before manager approval is available.'
  }
  if (isPickupWithoutResponders(req)) {
    return 'No responder has volunteered yet; fill the shift manually or keep watching.'
  }
  if (req.type === 'swap') {
    return 'Ready because staffing remains safe after the exchange.'
  }
  if (req.type === 'pickup') {
    return `Ready because ${selectedResponderName ?? 'the selected responder'} is selected and coverage remains safe.`
  }
  return `Ready because ${selectedResponderName ?? 'the selected responder'} is selected for this shift.`
}

function DecisionSummary({ children }: { children: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/10 px-2.5 py-2 text-[11px] leading-snug text-muted-foreground">
      <p className="mb-0.5 font-semibold text-foreground">Decision summary</p>
      <p>{children}</p>
    </div>
  )
}

function RequestActionColumn({
  req,
  canReview,
  saving,
  interactiveEnabled,
  validApprovalAvailable,
  approveSwapAvailable,
  selectedResponderName,
  hasBackupResponder,
  onChoosePartner,
  onChooseDifferentResponder,
  onPickupInterest,
  onApprove,
  onDeny,
  onViewShift,
}: {
  req: ShiftBoardRequest
  canReview: boolean
  saving: boolean
  interactiveEnabled: boolean
  validApprovalAvailable: boolean
  approveSwapAvailable: boolean
  selectedResponderName: string | null
  hasBackupResponder: boolean
  onChoosePartner: () => void
  onChooseDifferentResponder: () => void
  onPickupInterest: () => void
  onApprove: () => void
  onDeny: () => void
  onViewShift: () => void
}) {
  const disabled = saving || !interactiveEnabled
  const actionNote = getActionNote(req, selectedResponderName)
  if (!canReview) {
    return (
      <div className="flex flex-col gap-2 p-2.5 lg:sticky lg:top-20 lg:self-start">
        {req.type === 'pickup' && req.visibility === 'team' ? (
          <Button
            size="sm"
            variant="outline"
            disabled={!interactiveEnabled}
            onClick={onPickupInterest}
          >
            {req.hasMyInterest ? 'Withdraw interest' : 'Respond'}
          </Button>
        ) : null}
        <Button size="sm" variant="outline" onClick={onViewShift}>
          View shift
        </Button>
      </div>
    )
  }

  if (isWaitingOnTeammate(req)) {
    return (
      <div className="flex flex-col gap-2 p-2.5 lg:sticky lg:top-20 lg:self-start">
        <DecisionSummary>{actionNote}</DecisionSummary>
        <Button size="sm" onClick={onViewShift}>
          View request
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-[var(--error-border)] text-[var(--error-text)]"
          disabled={disabled}
          onClick={onDeny}
        >
          Cancel request
        </Button>
      </div>
    )
  }

  if (isOpenSwapWithoutPartner(req) && !approveSwapAvailable) {
    return (
      <div className="flex flex-col gap-2 p-2.5 lg:sticky lg:top-20 lg:self-start">
        <DecisionSummary>{actionNote}</DecisionSummary>
        <Button size="sm" disabled={disabled} onClick={onChoosePartner}>
          Choose partner
        </Button>
        <Button size="sm" variant="outline" onClick={onViewShift}>
          View shifts
        </Button>
      </div>
    )
  }

  if (isPickupWithoutResponders(req)) {
    return (
      <div className="flex flex-col gap-2 p-2.5 lg:sticky lg:top-20 lg:self-start">
        <DecisionSummary>{actionNote}</DecisionSummary>
        <Button size="sm" onClick={onViewShift}>
          View open post
        </Button>
        <Button size="sm" variant="outline" onClick={onViewShift}>
          Add coverage manually
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 p-2.5 lg:sticky lg:top-20 lg:self-start">
      <DecisionSummary>{actionNote}</DecisionSummary>
      {validApprovalAvailable || approveSwapAvailable ? (
        <Button
          size="sm"
          disabled={disabled}
          onClick={onApprove}
          className="whitespace-normal leading-tight"
        >
          {saving ? 'Saving...' : req.type === 'swap' ? 'Approve swap' : 'Approve pickup'}
        </Button>
      ) : null}
      {req.type === 'pickup' && hasBackupResponder ? (
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={onChooseDifferentResponder}
          className="whitespace-normal leading-tight"
        >
          Change responder
        </Button>
      ) : null}
      {isPendingRequest(req) ? (
        <Button
          size="sm"
          variant="outline"
          className="border-[var(--error-border)] text-[var(--error-text)]"
          disabled={disabled}
          onClick={onDeny}
        >
          Deny request
        </Button>
      ) : null}
      <Button size="sm" variant="outline" onClick={onViewShift}>
        {req.type === 'swap' ? 'View shifts' : 'View shift'}
      </Button>
    </div>
  )
}

function isPendingRequest(req: ShiftBoardRequest): boolean {
  return req.status === 'pending'
}
