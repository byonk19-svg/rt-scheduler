'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { buildScheduleUrl } from '@/lib/schedule-helpers'
import type { ShiftSlotValidationIssue } from '@/lib/schedule-rule-validation'

type AffectedShiftsDrawerProps = {
  issues: ShiftSlotValidationIssue[]
  cycleId: string
  viewMode: 'grid' | 'list' | 'calendar' | 'week'
  showUnavailable: boolean
}

const ISSUE_PRIORITY: Array<ShiftSlotValidationIssue['reasons'][number]> = [
  'missing_lead',
  'under_coverage',
  'over_coverage',
  'ineligible_lead',
  'multiple_leads',
]

function issueLabel(value: ShiftSlotValidationIssue['reasons'][number]): string {
  if (value === 'missing_lead') return 'Missing lead'
  if (value === 'under_coverage') return 'Under coverage'
  if (value === 'over_coverage') return 'Over coverage'
  if (value === 'ineligible_lead') return 'Ineligible lead'
  return 'Multiple leads'
}

function primaryReason(issue: ShiftSlotValidationIssue): ShiftSlotValidationIssue['reasons'][number] {
  for (const reason of ISSUE_PRIORITY) {
    if (issue.reasons.includes(reason)) return reason
  }
  return issue.reasons[0] ?? 'missing_lead'
}

export function AffectedShiftsDrawer({
  issues,
  cycleId,
  viewMode,
  showUnavailable,
}: AffectedShiftsDrawerProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const hasIssues = issues.length > 0

  return (
    <>
      <Button type="button" variant="link" className="h-auto px-0 text-xs" disabled={!hasIssues} onClick={() => setOpen(true)}>
        View affected shifts
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="top-0 right-0 left-auto h-dvh max-h-dvh w-full max-w-xl translate-x-0 translate-y-0 rounded-none border-l p-0 data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right data-[state=open]:duration-300 data-[state=closed]:duration-200"
          showCloseButton
        >
          <div className="h-full overflow-y-auto p-6">
            <DialogHeader>
              <DialogTitle>Affected shifts</DialogTitle>
              <DialogDescription>
                Select an issue to jump to that calendar slot.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-2">
              {hasIssues ? (
                issues.map((issue) => {
                  const reason = primaryReason(issue)
                  const labels = issue.reasons.map((item) => issueLabel(item)).join(', ')
                  return (
                    <button
                      key={issue.slotKey}
                      type="button"
                      className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-left hover:bg-secondary"
                      onClick={() => {
                        router.push(
                          buildScheduleUrl(cycleId, viewMode, {
                            show_unavailable: showUnavailable ? 'true' : undefined,
                            filter: reason,
                            focus: 'slot',
                            focus_slot: issue.slotKey,
                          })
                        )
                        setOpen(false)
                      }}
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {issue.date} {issue.shiftType}
                        </p>
                        <p className="text-xs text-muted-foreground">{labels}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">Jump</span>
                    </button>
                  )
                })
              ) : (
                <p className="text-sm text-muted-foreground">No affected shifts.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
