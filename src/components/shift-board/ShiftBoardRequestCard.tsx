import { CalendarDays } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  STATUS_META,
  TYPE_META,
  type ProfileLookupRow,
  type ShiftBoardRequest,
  type ShiftRole,
  type ShiftType,
} from '@/components/shift-board/types'

export function ShiftBoardRequestCard({
  req,
  canReview,
  saving,
  error,
  therapists,
  scheduledOnDate,
  shiftRole,
  swapPartnerId,
  onSwapPartnerChange,
  overrideReason,
  onOverrideReasonChange,
  onForceApprove,
  onAction,
  onViewShift,
  delay = 0,
}: {
  req: ShiftBoardRequest
  canReview: boolean
  saving: boolean
  error?: string
  therapists: ProfileLookupRow[]
  scheduledOnDate: Map<string, ShiftType>
  shiftRole: ShiftRole | null
  swapPartnerId: string
  onSwapPartnerChange: (id: string) => void
  overrideReason: string
  onOverrideReasonChange: (reason: string) => void
  onForceApprove: () => void
  onAction: (action: 'approve' | 'deny') => void
  onViewShift: () => void
  delay?: number
}) {
  const statusMeta = STATUS_META[req.status]
  const typeMeta = TYPE_META[req.type]
  const isPending = req.status === 'pending'
  const needsPartner = req.type === 'swap' && !req.swapWithId && isPending && canReview
  const needsLeadPartner = shiftRole === 'lead'
  const eligibleTherapists =
    scheduledOnDate.size > 0
      ? therapists.filter((t) => {
          if (!req.shiftType) return scheduledOnDate.has(t.id)
          return scheduledOnDate.get(t.id) === req.shiftType
        })
      : therapists
  const isOverrideableError = error?.startsWith('override:')
  const overrideMessage = isOverrideableError ? error!.slice('override:'.length).trim() : null
  const displayError = isOverrideableError ? null : error

  return (
    <div
      className={cn(
        'fade-up rounded-xl border bg-card p-4 transition-shadow hover:shadow-sm',
        isPending ? 'border-[var(--warning-border)] shadow-sm' : 'border-border'
      )}
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--attention)]">
          <span className="text-xs font-bold text-accent-foreground">{req.avatar}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{req.poster}</span>
            <span
              className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
              style={{
                color: typeMeta.color,
                background: typeMeta.bg,
                borderColor: typeMeta.border,
              }}
            >
              {typeMeta.label}
            </span>
            <span
              className="ml-auto rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
              style={{
                color: statusMeta.color,
                background: statusMeta.bg,
                borderColor: statusMeta.border,
              }}
            >
              {statusMeta.label}
            </span>
            <span className="text-xs font-medium text-muted-foreground">{req.posted}</span>
          </div>

          <div className="mb-2 inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/60 px-2 py-1">
            <CalendarDays className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">{req.shift}</span>
          </div>

          <p className="text-sm leading-relaxed text-muted-foreground">{req.message}</p>
          {req.swapWithName && (
            <p className="mt-1 text-xs text-muted-foreground">
              Swap with: <span className="font-medium text-foreground">{req.swapWithName}</span>
            </p>
          )}
          {req.status === 'denied' && req.overrideReason && (
            <p className="mt-1.5 rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-2.5 py-1.5 text-xs text-[var(--error-text)]">
              Reason: {req.overrideReason}
            </p>
          )}
        </div>
      </div>

      {needsPartner && (
        <div className="mt-3 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-3 py-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-semibold text-[var(--warning-text)]">
              Select swap partner
            </label>
            {needsLeadPartner && (
              <span className="rounded-full bg-[var(--warning)] px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                Lead shift - lead-eligible only
              </span>
            )}
          </div>
          {eligibleTherapists.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No therapists with a shift on this date found.
            </p>
          ) : (
            <select
              value={swapPartnerId}
              onChange={(e) => onSwapPartnerChange(e.target.value)}
              disabled={saving}
              className="h-8 w-full rounded-md border border-border bg-card px-2 text-sm text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none disabled:opacity-60"
            >
              <option value="">-- Choose a therapist --</option>
              {eligibleTherapists.map((t) => {
                const isLeadEligible = t.is_lead_eligible === true
                const disabled = needsLeadPartner && !isLeadEligible
                const shiftTypeLabel = scheduledOnDate.get(t.id)
                const label = [
                  t.full_name ?? t.id,
                  shiftTypeLabel ? `- ${shiftTypeLabel === 'day' ? 'Day' : 'Night'}` : '',
                  isLeadEligible ? '(Lead)' : '',
                ]
                  .filter(Boolean)
                  .join(' ')
                return (
                  <option key={t.id} value={t.id} disabled={disabled}>
                    {label}
                    {disabled ? ' (not lead eligible)' : ''}
                  </option>
                )
              })}
            </select>
          )}
        </div>
      )}

      {isPending && canReview && (
        <div className="mt-3 flex gap-2 border-t border-border pt-3">
          <Button
            size="sm"
            className="min-h-9 flex-1"
            disabled={saving || (needsPartner && !swapPartnerId)}
            onClick={() => onAction('approve')}
          >
            {saving ? 'Saving...' : 'Approve'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="min-h-9 flex-1 border-[var(--error-border)] text-[var(--error-text)] hover:bg-[var(--error-subtle)]"
            disabled={saving}
            onClick={() => onAction('deny')}
          >
            Deny
          </Button>
          <Button size="sm" variant="outline" onClick={onViewShift}>
            View shift
          </Button>
        </div>
      )}

      {displayError && (
        <p
          role="alert"
          className="mt-2 rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-xs text-[var(--error-text)]"
        >
          {displayError}
        </p>
      )}

      {isOverrideableError && canReview && (
        <div className="mt-3 rounded-lg border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2.5">
          <p className="mb-2 text-xs font-semibold text-[var(--error-text)]">{overrideMessage}</p>
          <label className="mb-1 block text-xs font-medium text-[var(--error-text)]">
            Override reason <span className="font-normal opacity-70">(required)</span>
          </label>
          <input
            type="text"
            value={overrideReason}
            onChange={(e) => onOverrideReasonChange(e.target.value)}
            placeholder="e.g. backup lead confirmed separately"
            disabled={saving}
            className="mb-2 h-8 w-full rounded-md border border-border bg-card px-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none disabled:opacity-60"
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
      )}

      {(!isPending || !canReview) && (
        <div className="mt-3 flex justify-end border-t border-border pt-3">
          <Button size="sm" variant="outline" onClick={onViewShift}>
            View shift
          </Button>
        </div>
      )}
    </div>
  )
}
