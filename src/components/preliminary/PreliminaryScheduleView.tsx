'use client'

import { PreliminaryRequestHistory } from '@/components/preliminary/PreliminaryRequestHistory'
import { PreliminaryShiftCard } from '@/components/preliminary/PreliminaryShiftCard'
import type {
  PreliminaryHistoryItem,
  PreliminaryShiftCard as PreliminaryShiftCardModel,
} from '@/lib/preliminary-schedule/types'

type PreliminaryScheduleViewProps = {
  snapshotId: string
  cycleLabel: string
  snapshotSentAt: string
  currentUserId: string
  cards: PreliminaryShiftCardModel[]
  historyItems: PreliminaryHistoryItem[]
  claimAction: (formData: FormData) => void | Promise<void>
  requestChangeAction: (formData: FormData) => void | Promise<void>
  cancelAction: (formData: FormData) => void | Promise<void>
  successMessage?: string | null
  errorMessage?: string | null
}

function formatSentAt(value: string) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function PreliminaryScheduleView({
  snapshotId,
  cycleLabel,
  snapshotSentAt,
  currentUserId,
  cards,
  historyItems,
  claimAction,
  requestChangeAction,
  cancelAction,
  successMessage,
  errorMessage,
}: PreliminaryScheduleViewProps) {
  void currentUserId

  return (
    <div className="space-y-5">
      <div className="border-b border-border bg-card px-6 pb-4 pt-5">
        <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">
          Preliminary Schedule
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {cycleLabel} · sent {formatSentAt(snapshotSentAt)}
        </p>
      </div>

      <div className="px-6">
        {successMessage && (
          <div className="mb-3 rounded-md border border-[var(--success-border)] bg-[var(--success-subtle)] px-3 py-2 text-xs font-semibold text-[var(--success-text)]">
            {successMessage}
          </div>
        )}
        {errorMessage && (
          <div className="mb-3 rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-xs font-semibold text-[var(--error-text)]">
            {errorMessage}
          </div>
        )}

        <div className="grid gap-3">
          {cards.length === 0 ? (
            <div className="rounded-xl border border-border bg-card px-6 py-10 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <p className="text-sm font-semibold text-foreground">
                No preliminary items need your attention right now.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Open help-needed shifts and your tentative assignments will appear here while the
                preliminary schedule is live.
              </p>
            </div>
          ) : (
            cards.map((card) => (
              <PreliminaryShiftCard
                key={card.shiftId}
                snapshotId={snapshotId}
                card={card}
                claimAction={claimAction}
                requestChangeAction={requestChangeAction}
              />
            ))
          )}
        </div>

        <div className="mt-5">
          <PreliminaryRequestHistory items={historyItems} cancelAction={cancelAction} />
        </div>
      </div>
    </div>
  )
}
