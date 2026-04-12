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

function getWeekStartKey(value: string) {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  const start = new Date(parsed)
  start.setDate(parsed.getDate() - parsed.getDay())
  return start.toISOString().slice(0, 10)
}

function formatWeekLabel(value: string) {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return `Week of ${value}`
  return `Week of ${parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
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

  const groupedCards = cards.reduce<
    Array<{ weekStart: string; weekLabel: string; items: PreliminaryShiftCardModel[] }>
  >((groups, card) => {
    const weekStart = getWeekStartKey(card.shiftDate)
    const existing = groups.find((group) => group.weekStart === weekStart)
    if (existing) {
      existing.items.push(card)
      return groups
    }

    groups.push({
      weekStart,
      weekLabel: formatWeekLabel(weekStart),
      items: [card],
    })
    return groups
  }, [])

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

        <div className="space-y-10">
          {cards.length === 0 ? (
            <div className="rounded-xl border border-border bg-card px-6 py-10 text-center shadow-tw-sm">
              <p className="text-sm font-semibold text-foreground">
                No preliminary items need your attention right now.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Open help-needed shifts and your tentative assignments will appear here while the
                preliminary schedule is live.
              </p>
            </div>
          ) : (
            groupedCards.map((group) => (
              <section key={group.weekStart} className="space-y-3">
                <div className="flex items-center gap-3 pb-0.5 pt-3">
                  <p className="text-[0.78rem] font-bold uppercase tracking-[0.12em] text-foreground/60">
                    {group.weekLabel}
                  </p>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="grid gap-3">
                  {group.items.map((card) => (
                    <PreliminaryShiftCard
                      key={card.shiftId}
                      snapshotId={snapshotId}
                      card={card}
                      claimAction={claimAction}
                      requestChangeAction={requestChangeAction}
                    />
                  ))}
                </div>
              </section>
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
