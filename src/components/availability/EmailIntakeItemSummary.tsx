'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { EmailIntakePanelItemRow } from '@/components/availability/EmailIntakePanel'

const CONFIDENCE_REASON_LABELS: Record<string, string> = {
  employee_name_missing: 'Name not found',
  employee_match_ambiguous: 'Name match uncertain',
  cycle_match_missing: 'No schedule block matched',
  unresolved_lines_present: 'Unresolved text lines',
  low_request_count: 'Few dates found',
  name_match_ambiguous: 'Name match uncertain',
}

function formatStatusVariant(
  status: EmailIntakePanelItemRow['parseStatus']
): 'outline' | 'secondary' | 'destructive' | 'default' {
  if (status === 'auto_applied') return 'secondary'
  if (status === 'parsed') return 'default'
  if (status === 'failed') return 'destructive'
  return 'outline'
}

function buildPostApplyAvailabilityHref(cycleId: string, therapistId: string) {
  const search = new URLSearchParams()
  search.set('tab', 'intake')
  search.set('success', 'email_intake_applied')
  search.set('cycle', cycleId)
  search.set('therapist', therapistId)
  search.set('roster', 'has_requests')
  return `/availability?${search.toString()}`
}

function getItemNextStep(item: EmailIntakePanelItemRow): string {
  if (item.parseStatus === 'auto_applied') {
    return 'Already auto-applied to availability.'
  }
  if (!item.matchedTherapistId || !item.matchedCycleId) {
    return 'Match the therapist and schedule block before applying this item.'
  }
  if (item.parsedRequests.length === 0) {
    return 'No parsed dates were found. Review the source text before applying.'
  }
  return 'Ready to apply as an availability override.'
}

function EmailIntakeApplyDatesButton({
  item,
  applyEmailAvailabilityImportAction,
}: {
  item: EmailIntakePanelItemRow
  applyEmailAvailabilityImportAction: (
    formData: FormData
  ) => void | Promise<void> | Promise<{ ok: true; cycleId: string; therapistId: string }>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleClick() {
    if (!item.matchedCycleId || !item.matchedTherapistId) return
    startTransition(async () => {
      const fd = new FormData()
      fd.set('item_id', item.id)
      const result = await applyEmailAvailabilityImportAction(fd)
      if (
        result &&
        typeof result === 'object' &&
        'ok' in result &&
        result.ok &&
        'cycleId' in result &&
        'therapistId' in result
      ) {
        router.replace(
          buildPostApplyAvailabilityHref(String(result.cycleId), String(result.therapistId))
        )
        router.refresh()
      }
    })
  }

  return (
    <Button type="button" size="sm" disabled={pending} aria-busy={pending} onClick={handleClick}>
      Apply dates
    </Button>
  )
}

export function EmailIntakeItemSummary({
  item,
  applyEmailAvailabilityImportAction,
}: {
  item: EmailIntakePanelItemRow
  applyEmailAvailabilityImportAction: (
    formData: FormData
  ) => void | Promise<void> | Promise<{ ok: true; cycleId: string; therapistId: string }>
}) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">{item.sourceLabel}</p>
            <Badge variant={formatStatusVariant(item.parseStatus)}>{item.parseStatus}</Badge>
            <Badge variant="outline">{item.confidenceLevel} confidence</Badge>
            {item.manuallyEdited ? <Badge variant="outline">Edited</Badge> : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {item.extractedEmployeeName
              ? `Detected employee: ${item.extractedEmployeeName}`
              : 'Employee name not detected'}
          </p>
          <p className="text-xs text-muted-foreground">{getItemNextStep(item)}</p>
        </div>

        {item.matchedTherapistId && item.matchedCycleId && item.parsedRequests.length > 0 ? (
          <EmailIntakeApplyDatesButton
            item={item}
            applyEmailAvailabilityImportAction={applyEmailAvailabilityImportAction}
          />
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>
          Therapist:{' '}
          <span className="font-medium text-foreground">
            {item.matchedTherapistName ?? 'Needs match'}
          </span>
        </span>
        <span className="text-border/90" aria-hidden="true">
          /
        </span>
        <span>
          Cycle:{' '}
          <span className="font-medium text-foreground">
            {item.matchedCycleLabel ?? 'Needs review'}
          </span>
        </span>
      </div>

      {item.confidenceReasons.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.confidenceReasons.map((reason) => (
            <Badge key={`${item.id}-${reason}`} variant="outline">
              {CONFIDENCE_REASON_LABELS[reason] ?? reason}
            </Badge>
          ))}
        </div>
      ) : null}
    </>
  )
}
