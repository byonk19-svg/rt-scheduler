'use client'

import { PreliminaryRequestHistory } from '@/components/preliminary/PreliminaryRequestHistory'
import { PreliminaryShiftCard } from '@/components/preliminary/PreliminaryShiftCard'
import type {
  PreliminaryCellMarkView,
  PreliminaryHistoryItem,
  PreliminaryShiftCard as PreliminaryShiftCardModel,
  PreliminaryTeamScheduleShift,
} from '@/lib/preliminary-schedule/types'

type PreliminaryScheduleViewProps = {
  snapshotId: string
  cycleLabel: string
  cycleStartDate: string | null
  cycleEndDate: string | null
  snapshotSentAt: string
  currentUserId: string
  currentUserRole: string | null
  currentUserShiftType: 'day' | 'night' | null
  highlightedShiftId?: string | null
  cards: PreliminaryShiftCardModel[]
  historyItems: PreliminaryHistoryItem[]
  teamShifts: PreliminaryTeamScheduleShift[]
  cellMarks: PreliminaryCellMarkView[]
  claimAction: (formData: FormData) => void | Promise<void>
  requestChangeAction: (formData: FormData) => void | Promise<void>
  createCellMarkAction: (formData: FormData) => void | Promise<void>
  cancelCellMarkAction: (formData: FormData) => void | Promise<void>
  reviewCellMarkAction: (formData: FormData) => void | Promise<void>
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

function formatShiftDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function formatShiftType(value: 'day' | 'night') {
  return value === 'day' ? 'Day' : 'Night'
}

function markDescription(mark: PreliminaryCellMarkView) {
  return mark.markType === 'mark_off' ? 'Marked out scheduled day' : 'Wants to work this day'
}

type TeamOverviewItem = {
  key: string
  shift: PreliminaryTeamScheduleShift | null
  shiftDate: string
  shiftType: 'day' | 'night'
  marks: PreliminaryCellMarkView[]
}

export function PreliminaryScheduleView({
  snapshotId,
  cycleLabel,
  cycleStartDate,
  cycleEndDate,
  snapshotSentAt,
  currentUserId,
  currentUserRole,
  currentUserShiftType,
  highlightedShiftId = null,
  cards,
  historyItems,
  teamShifts,
  cellMarks,
  claimAction,
  requestChangeAction,
  createCellMarkAction,
  cancelCellMarkAction,
  reviewCellMarkAction,
  cancelAction,
  successMessage,
  errorMessage,
}: PreliminaryScheduleViewProps) {
  const canWriteOpenPreference =
    currentUserRole !== 'manager' && Boolean(currentUserShiftType && cycleStartDate && cycleEndDate)

  const usedOverviewMarkIds = new Set<string>()
  const teamOverviewItems: TeamOverviewItem[] = teamShifts.map((shift) => {
    const marks = cellMarks.filter((mark) => {
      if (mark.shiftId === shift.shiftId) return true
      return (
        mark.shiftId == null &&
        mark.shiftDate === shift.shiftDate &&
        mark.shiftType === shift.shiftType
      )
    })

    for (const mark of marks) {
      usedOverviewMarkIds.add(mark.id)
    }

    return {
      key: shift.shiftId,
      shift,
      shiftDate: shift.shiftDate,
      shiftType: shift.shiftType,
      marks,
    }
  })

  for (const mark of cellMarks) {
    if (usedOverviewMarkIds.has(mark.id)) continue

    teamOverviewItems.push({
      key: `mark-${mark.id}`,
      shift: null,
      shiftDate: mark.shiftDate,
      shiftType: mark.shiftType,
      marks: [mark],
    })
  }

  teamOverviewItems.sort((left, right) => {
    if (left.shiftDate === right.shiftDate) {
      return left.shiftType.localeCompare(right.shiftType)
    }
    return left.shiftDate.localeCompare(right.shiftDate)
  })

  const groupedTeamOverviewItems = teamOverviewItems.reduce<
    Array<{ weekStart: string; weekLabel: string; items: TeamOverviewItem[] }>
  >((groups, item) => {
    const weekStart = getWeekStartKey(item.shiftDate)
    const existing = groups.find((group) => group.weekStart === weekStart)
    if (existing) {
      existing.items.push(item)
      return groups
    }

    groups.push({
      weekStart,
      weekLabel: formatWeekLabel(weekStart),
      items: [item],
    })
    return groups
  }, [])

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
          {cycleLabel} - sent {formatSentAt(snapshotSentAt)}
        </p>
      </div>

      <div className="px-6">
        <section className="rounded-xl border border-border bg-card px-4 py-4 shadow-tw-sm">
          <h2 className="text-sm font-semibold text-foreground">Team schedule overview</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            You can review the full preliminary schedule here. You can only change your own
            assignment or claim open shifts.
          </p>
          <div className="mt-4 space-y-5">
            {groupedTeamOverviewItems.map((group) => (
              <div key={group.weekStart} className="space-y-2">
                <div className="flex items-center gap-3">
                  <p className="text-[0.72rem] font-bold uppercase tracking-[0.12em] text-foreground/60">
                    {group.weekLabel}
                  </p>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="space-y-2">
                  {group.items.map((item) => (
                    <div key={item.key} className="border-b border-border-light py-3 last:border-0">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <span className="text-sm text-muted-foreground">
                            {formatShiftDate(item.shiftDate)}
                            {' - '}
                            {formatShiftType(item.shiftType)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2 text-right">
                          <p className="text-sm font-semibold text-foreground">
                            {item.shift?.assignedName ?? 'No draft row yet'}
                            {item.shift?.isCurrentUser ? ' - You' : ''}
                          </p>
                          {item.shift ? (
                            <span className="rounded-full bg-[var(--warning-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--warning-text)]">
                              Tentative Assignment
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {item.marks.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.marks.map((mark) => (
                            <span
                              key={mark.id}
                              className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1 text-xs font-semibold text-foreground"
                            >
                              <span
                                aria-hidden="true"
                                className={
                                  mark.markType === 'mark_off'
                                    ? 'text-sm decoration-[var(--error)] decoration-2 line-through'
                                    : 'text-sm text-[var(--info-text)]'
                                }
                              >
                                1
                              </span>
                              <span>
                                Pencil mark: {markDescription(mark)} by {mark.requesterName}
                              </span>
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

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

        {canWriteOpenPreference ? (
          <section className="mt-5 rounded-xl border border-border bg-card px-4 py-4 shadow-tw-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Write a 1 on another day</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pick any {formatShiftType(currentUserShiftType as 'day' | 'night').toLowerCase()}{' '}
                  shift in this preliminary schedule.
                </p>
              </div>
            </div>
            <form
              action={createCellMarkAction}
              className="mt-4 grid gap-3 md:grid-cols-[12rem_1fr_auto]"
            >
              <input type="hidden" name="snapshot_id" value={snapshotId} />
              <input type="hidden" name="mark_type" value="add_work" />
              <input type="hidden" name="shift_type" value={currentUserShiftType ?? ''} />
              <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                Date
                <input
                  type="date"
                  name="date"
                  min={cycleStartDate ?? undefined}
                  max={cycleEndDate ?? undefined}
                  required
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm font-normal text-foreground outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                Optional note
                <input
                  type="text"
                  name="note"
                  maxLength={160}
                  placeholder="Anything the manager should know"
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm font-normal text-foreground outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                />
              </label>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="inline-flex h-10 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground outline-none transition hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  Write 1
                </button>
              </div>
            </form>
          </section>
        ) : null}

        {cellMarks.length > 0 ? (
          <section className="mt-5 rounded-xl border border-border bg-card px-4 py-4 shadow-tw-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Pending pencil marks</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Staff marks stay visible here until a manager reviews them.
                </p>
              </div>
            </div>
            <div className="mt-4 divide-y divide-border-light">
              {cellMarks.map((mark) => (
                <div key={mark.id} className="grid gap-3 py-3 md:grid-cols-[2.5rem_1fr_auto]">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background text-lg font-bold"
                    aria-label={markDescription(mark)}
                  >
                    <span
                      className={
                        mark.markType === 'mark_off'
                          ? 'text-foreground decoration-[var(--error)] decoration-2 line-through'
                          : 'text-[var(--info-text)]'
                      }
                    >
                      1
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {mark.requesterName}
                      {mark.isCurrentUser ? ' - You' : ''} - {formatShiftDate(mark.shiftDate)} -{' '}
                      {formatShiftType(mark.shiftType)}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                      {markDescription(mark)}
                    </p>
                    {mark.note ? (
                      <p className="mt-1 text-xs text-muted-foreground">{mark.note}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    {mark.canCancel ? (
                      <form action={cancelCellMarkAction}>
                        <input type="hidden" name="mark_id" value={mark.id} />
                        <button
                          type="submit"
                          className="inline-flex h-8 items-center rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground outline-none transition hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        >
                          Remove
                        </button>
                      </form>
                    ) : null}
                    {mark.canReview ? (
                      <>
                        <form action={reviewCellMarkAction}>
                          <input type="hidden" name="mark_id" value={mark.id} />
                          <input type="hidden" name="decision" value="approved" />
                          <button
                            type="submit"
                            className="inline-flex h-8 items-center rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground outline-none transition hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                          >
                            Approve
                          </button>
                        </form>
                        <form action={reviewCellMarkAction}>
                          <input type="hidden" name="mark_id" value={mark.id} />
                          <input type="hidden" name="decision" value="denied" />
                          <button
                            type="submit"
                            className="inline-flex h-8 items-center rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground outline-none transition hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
                          >
                            Deny
                          </button>
                        </form>
                        <form action={reviewCellMarkAction}>
                          <input type="hidden" name="mark_id" value={mark.id} />
                          <input type="hidden" name="decision" value="dismissed" />
                          <button
                            type="submit"
                            className="inline-flex h-8 items-center rounded-md border border-transparent px-2.5 text-xs font-medium text-muted-foreground outline-none transition hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
                          >
                            Dismiss
                          </button>
                        </form>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <div className="mt-5 space-y-10">
          {cards.length === 0 ? (
            <div className="rounded-xl border border-border bg-card px-6 py-10 text-center shadow-tw-sm">
              <p className="text-sm font-semibold text-foreground">
                No preliminary items need your attention right now.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Open shifts and your tentative assignments appear here while the preliminary
                schedule is live.
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
                      cycleStartDate={cycleStartDate}
                      cycleEndDate={cycleEndDate}
                      card={card}
                      currentUserId={currentUserId}
                      highlighted={highlightedShiftId === card.shiftId}
                      claimAction={claimAction}
                      requestChangeAction={requestChangeAction}
                      createCellMarkAction={createCellMarkAction}
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
