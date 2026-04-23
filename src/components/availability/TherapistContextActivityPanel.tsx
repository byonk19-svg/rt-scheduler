'use client'

import { useState } from 'react'

import { FormSubmitButton } from '@/components/form-submit-button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type AvailabilityEntryRow = {
  id: string
  date: string
  entryType: 'force_off' | 'force_on'
  reason: string | null
  createdAt: string
  updatedAt?: string
}

type PlannerOverrideRecord = {
  id: string
  date: string
  override_type: 'force_off' | 'force_on'
  removable?: boolean
  derivedFromPattern?: boolean
}

type TherapistContextActivityPanelProps = {
  requestRows: AvailabilityEntryRow[]
  savedPlannerRows: PlannerOverrideRecord[]
  deleteManagerPlannerDateAction: (formData: FormData) => void | Promise<void>
  selectedCycleId: string
  selectedTherapistId: string
}

function formatDateTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDateLabel(value: string) {
  const parsed = new Date(`${value}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function TherapistContextActivityPanel({
  requestRows,
  savedPlannerRows,
  deleteManagerPlannerDateAction,
  selectedCycleId,
  selectedTherapistId,
}: TherapistContextActivityPanelProps) {
  const [tab, setTab] = useState<'context' | 'saved'>('context')

  return (
    <>
      <div className="flex gap-1 border-b border-border/70 px-4 py-2">
        <button
          type="button"
          className={cn(
            'h-11 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors',
            tab === 'context'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
          onClick={() => setTab('context')}
        >
          Recent requests
        </button>
        <button
          type="button"
          className={cn(
            'h-11 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors',
            tab === 'saved'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
          onClick={() => setTab('saved')}
        >
          Saved planner dates
        </button>
      </div>

      <div className="max-h-[280px] overflow-y-auto px-4 py-2.5">
        {tab === 'context' ? (
          requestRows.length > 0 ? (
            <div className="space-y-1.5">
              {requestRows.map((row) => (
                <div
                  key={row.id}
                  className="rounded-[1rem] border border-border/60 bg-background/80 px-3 py-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {formatDateLabel(row.date)}
                    </p>
                    <Badge
                      variant="outline"
                      className={cn(
                        row.entryType === 'force_off'
                          ? 'border-[var(--warning-border)] text-[var(--warning-text)]'
                          : 'border-[var(--info-border)] text-[var(--info-text)]'
                      )}
                    >
                      {row.entryType === 'force_off' ? 'Need off' : 'Request to work'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.reason?.trim() || 'No note attached'}
                  </p>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Updated {formatDateTime(row.updatedAt ?? row.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No therapist requests are saved for this cycle yet.
            </p>
          )
        ) : savedPlannerRows.length > 0 ? (
          <div className="space-y-1.5">
            {savedPlannerRows.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between gap-3 rounded-[1rem] border border-border/60 bg-background/80 px-3 py-2.5"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {formatDateLabel(row.date)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.override_type === 'force_on' ? 'Will work' : 'Cannot work'}
                    {row.derivedFromPattern ? ' · Weekly default' : ''}
                  </p>
                </div>
                {row.removable === false ? (
                  <span className="text-xs text-muted-foreground">Default</span>
                ) : (
                  <form action={deleteManagerPlannerDateAction}>
                    <input type="hidden" name="override_id" value={row.id} />
                    <input type="hidden" name="cycle_id" value={selectedCycleId} />
                    <input type="hidden" name="therapist_id" value={selectedTherapistId} />
                    <FormSubmitButton
                      type="submit"
                      variant="ghost"
                      size="sm"
                      pendingText="Removing..."
                      className="text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      Remove
                    </FormSubmitButton>
                  </form>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No saved planner dates for this therapist and cycle.
          </p>
        )}
      </div>
    </>
  )
}
