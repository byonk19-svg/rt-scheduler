'use client'

import type { PreliminaryShiftCard as PreliminaryShiftCardModel } from '@/lib/preliminary-schedule/types'

type PreliminaryShiftCardProps = {
  snapshotId: string
  card: PreliminaryShiftCardModel
  currentUserId: string
  highlighted?: boolean
  claimAction: (formData: FormData) => void | Promise<void>
  requestChangeAction: (formData: FormData) => void | Promise<void>
  directEditAction: (formData: FormData) => void | Promise<void>
}

function formatShiftLabel(date: string, shiftType: 'day' | 'night') {
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return `${date} - ${shiftType === 'day' ? 'Day' : 'Night'}`
  }

  return (
    parsed.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }) + ` - ${shiftType === 'day' ? 'Day' : 'Night'}`
  )
}

function stateLabel(state: PreliminaryShiftCardModel['state']) {
  switch (state) {
    case 'open':
      return 'Open'
    case 'pending_claim':
      return 'Pending claim'
    case 'pending_change':
      return 'Pending change'
    default:
      return 'Tentative'
  }
}

function stateClasses(state: PreliminaryShiftCardModel['state']) {
  if (state === 'open') {
    return 'border-[var(--info-border)] bg-[var(--info-subtle)] text-[var(--info-text)]'
  }
  if (state === 'pending_claim' || state === 'pending_change') {
    return 'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
  }
  return 'border-[var(--success-border)] bg-[var(--success-subtle)] text-[var(--success-text)]'
}

export function PreliminaryShiftCard({
  snapshotId,
  card,
  currentUserId,
  highlighted = false,
  claimAction,
  requestChangeAction,
  directEditAction,
}: PreliminaryShiftCardProps) {
  const isReservedByCurrentUser = card.reservedById === currentUserId
  const actionable =
    card.canClaim ||
    card.canRequestChange ||
    card.directAction === 'add_here' ||
    card.directAction === 'remove_me' ||
    card.directAction === 'express_interest'

  return (
    <article
      id={`preliminary-shift-${card.shiftId}`}
      className={`rounded-xl border bg-card px-4 py-4 shadow-tw-sm ${
        highlighted
          ? 'border-[var(--info-border)] ring-2 ring-[var(--info-border)]/40'
          : 'border-border'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">
              {formatShiftLabel(card.shiftDate, card.shiftType)}
            </p>
            <span
              className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${stateClasses(
                card.state
              )}`}
            >
              {stateLabel(card.state)}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {card.assignedName
              ? `${card.assignedName}${card.shiftRole === 'lead' ? ' · Lead' : ''}`
              : 'Help needed'}
          </p>
          {card.state === 'pending_claim' && card.assignedName ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {isReservedByCurrentUser
                ? 'Your claim is pending manager approval.'
                : 'Pending manager approval.'}
            </p>
          ) : null}
        </div>
      </div>

      {actionable ? (
        <form
          action={
            card.directAction === 'add_here' || card.directAction === 'remove_me'
              ? directEditAction
              : card.canClaim || card.directAction === 'express_interest'
                ? claimAction
                : requestChangeAction
          }
          className="mt-3 space-y-2"
        >
          <input type="hidden" name="snapshot_id" value={snapshotId} />
          <input type="hidden" name="shift_id" value={card.shiftId} />
          {(card.directAction === 'add_here' || card.directAction === 'remove_me') && (
            <input type="hidden" name="direct_action" value={card.directAction} />
          )}
          <label htmlFor={`shift-note-${card.shiftId}`} className="sr-only">
            Optional note
          </label>
          {card.directAction !== 'add_here' && card.directAction !== 'remove_me' ? (
            <textarea
              id={`shift-note-${card.shiftId}`}
              name="note"
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              placeholder={
                card.canClaim
                  ? 'Optional note for the manager'
                  : 'Optional reason for the change request'
              }
            />
          ) : null}
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground outline-none transition hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {card.directActionLabel ?? (card.canClaim ? 'Claim shift' : 'Request change')}
          </button>
        </form>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          {card.state === 'pending_claim'
            ? isReservedByCurrentUser
              ? 'Your claim is pending manager approval. You can cancel it from request history.'
              : 'Another therapist already has a pending claim on this slot.'
            : card.state === 'pending_change'
              ? 'This shift already has a pending change request.'
              : 'No action needed.'}
        </p>
      )}
    </article>
  )
}
