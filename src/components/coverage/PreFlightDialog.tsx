'use client'

import { Loader2, Sparkles, TriangleAlert } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Step = 'loading' | 'results' | 'error'

type PreFlightResult = {
  unfilledSlots: number
  missingLeadSlots: number
  forcedMustWorkMisses: number
  details: Array<{ date: string; shiftType: 'day' | 'night' }>
}

type Props = {
  open: boolean
  onClose: () => void
  cycleId: string
  onConfirm: () => void
}

function formatDetailDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function PreFlightDialog({ open, onClose, cycleId, onConfirm }: Props) {
  const [step, setStep] = useState<Step>('loading')
  const [result, setResult] = useState<PreFlightResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    let active = true

    async function load() {
      setStep('loading')
      setResult(null)
      setError(null)

      try {
        const response = await fetch('/api/schedule/pre-flight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ cycleId }),
        })

        const payload = (await response.json().catch(() => null)) as
          | PreFlightResult
          | { error?: string }
          | null

        if (!response.ok) {
          throw new Error(
            !Array.isArray(payload) && payload?.error ? payload.error : 'Could not load pre-flight report.'
          )
        }

        if (!active) return
        setResult(payload as PreFlightResult)
        setStep('results')
      } catch (loadError) {
        if (!active) return
        setError(loadError instanceof Error ? loadError.message : 'Could not load pre-flight report.')
        setStep('error')
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [cycleId, open])

  const hasIssues = useMemo(
    () => Boolean(result && (result.unfilledSlots > 0 || result.missingLeadSlots > 0)),
    [result]
  )

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="max-w-[34rem] overflow-hidden border-border/80 bg-card p-0 shadow-tw-modal-lg">
        <div className="teamwise-grid-bg-subtle teamwise-aurora-bg border-b border-border/70 px-5 py-4 sm:px-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--info-border)] bg-[var(--info-subtle)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--info-text)]">
            <Sparkles className="h-3.5 w-3.5" />
            Pre-flight
          </div>
          <DialogHeader className="mt-3 text-left">
            <DialogTitle className="font-heading text-[1.45rem] font-bold tracking-[-0.04em] text-foreground">
              Draft pre-flight report
            </DialogTitle>
            <DialogDescription className="max-w-[30rem] text-sm leading-relaxed text-muted-foreground">
              Review likely coverage blockers before generating the draft.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-5 py-5 sm:px-6">
          {step === 'loading' ? (
            <div className="flex items-center gap-3 rounded-[20px] border border-border/80 bg-card/90 p-4 shadow-tw-panel-inner-soft">
              <Loader2 className="h-4 w-4 animate-spin text-[var(--info-text)]" />
              <p className="text-sm font-medium text-foreground">Checking constraints...</p>
            </div>
          ) : null}

          {step === 'results' && result ? (
            <>
              {result.unfilledSlots === 0 && result.missingLeadSlots === 0 ? (
                <div className="rounded-[20px] border border-[var(--success-border)] bg-[var(--success-subtle)] p-4">
                  <p className="text-sm font-semibold text-[var(--success-text)]">
                    No constraint issues found
                  </p>
                  <p className="mt-1 text-sm text-[var(--success-text)]/90">
                    The draft can proceed without predicted unfilled or missing-lead slots.
                  </p>
                </div>
              ) : null}

              {hasIssues ? (
                <div className="rounded-[20px] border border-[var(--warning-border)] bg-[var(--warning-subtle)] p-4">
                  <p className="text-sm font-semibold text-[var(--warning-text)]">
                    Constraint issues found
                  </p>
                  <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
                    <div className="rounded-xl border border-[var(--warning-border)]/70 bg-card/70 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--warning-text)]">
                        Unfilled slots
                      </p>
                      <p className="mt-1 text-lg font-semibold text-foreground">
                        {result.unfilledSlots}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[var(--warning-border)]/70 bg-card/70 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--warning-text)]">
                        Missing lead slots
                      </p>
                      <p className="mt-1 text-lg font-semibold text-foreground">
                        {result.missingLeadSlots}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[var(--warning-border)]/70 bg-card/70 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--warning-text)]">
                        Forced-date misses
                      </p>
                      <p className="mt-1 text-lg font-semibold text-foreground">
                        {result.forcedMustWorkMisses}
                      </p>
                    </div>
                  </div>
                  {result.details.length > 0 ? (
                    <ul className="mt-4 space-y-1.5">
                      {result.details.map((detail) => (
                        <li
                          key={`${detail.date}-${detail.shiftType}`}
                          className="flex items-center gap-2 text-sm text-foreground"
                        >
                          <TriangleAlert className="h-4 w-4 text-[var(--warning-text)]" />
                          <span>
                            {formatDetailDate(detail.date)} â€¢ {detail.shiftType} shift
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}

          {step === 'error' ? (
            <div className="rounded-[20px] border border-[var(--error-border)] bg-[var(--error-subtle)] p-4">
              <p className="text-sm font-semibold text-[var(--error-text)]">Pre-flight failed</p>
              <p className="mt-1 text-sm text-[var(--error-text)]/90">
                {error ?? 'Could not load pre-flight report.'}
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter className="border-t border-border/70 bg-muted/15 px-5 py-4 sm:px-6">
          <Button variant="outline" size="sm" onClick={onClose} className="min-w-[7rem]">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onConfirm()
              onClose()
            }}
            className="min-w-[8.5rem] gap-1.5 shadow-tw-primary-glow"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generate draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
