'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { EmailIntakePanelRow } from '@/components/availability/EmailIntakePanel'

function formatDateTime(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatStatusVariant(
  status: EmailIntakePanelRow['batchStatus']
): 'outline' | 'secondary' | 'destructive' | 'default' {
  if (status === 'applied') return 'secondary'
  if (status === 'parsed') return 'default'
  if (status === 'failed') return 'destructive'
  return 'outline'
}

function statChipClass(
  type: 'review' | 'failed' | 'applied' | 'default',
  count: number
): string | null {
  if (count === 0) return null
  if (type === 'review') return 'border-warning-border bg-warning-subtle text-warning-text'
  if (type === 'failed') return 'border-destructive/40 bg-destructive/10 text-destructive'
  if (type === 'applied') return 'border-success-border bg-success-subtle text-success-text'
  return 'border-border/70'
}

type EmailIntakeBatchHeaderProps = {
  row: EmailIntakePanelRow
  deleteEmailIntakeAction?: (formData: FormData) => void | Promise<void>
  reparseEmailIntakeAction?: (formData: FormData) => void | Promise<void>
}

export function EmailIntakeBatchHeader({
  row,
  deleteEmailIntakeAction,
  reparseEmailIntakeAction,
}: EmailIntakeBatchHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-foreground">
            {row.fromName ? `${row.fromName} ` : ''}
            <span className="text-sm font-normal text-muted-foreground">{row.fromEmail}</span>
          </p>
          <Badge variant={formatStatusVariant(row.batchStatus)}>{row.batchStatus}</Badge>
        </div>
        <p className="text-sm text-foreground">{row.subject ?? 'No subject'}</p>
        <p className="text-xs text-muted-foreground">Received {formatDateTime(row.receivedAt)}</p>
      </div>
      <div className="flex flex-col items-end gap-2">
        <div className="flex flex-wrap justify-end gap-2 text-xs text-muted-foreground">
          {[
            {
              label: `${row.itemCount} items`,
              className: statChipClass('default', row.itemCount),
            },
            {
              label: `${row.autoAppliedCount} auto-applied`,
              className: statChipClass('applied', row.autoAppliedCount),
            },
            {
              label: `${row.needsReviewCount} needs review`,
              className: statChipClass('review', row.needsReviewCount),
            },
            {
              label: `${row.failedCount} failed`,
              className: statChipClass('failed', row.failedCount),
            },
          ]
            .filter((chip) => chip.className)
            .map((chip) => (
              <span
                key={`${row.id}-${chip.label}`}
                className={`rounded-md border px-2 py-1 ${chip.className}`}
              >
                {chip.label}
              </span>
            ))}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <form action={reparseEmailIntakeAction}>
            <input type="hidden" name="intake_id" value={row.id} />
            <Button size="sm" type="submit" variant="outline">
              Reparse
            </Button>
          </form>
          <form action={deleteEmailIntakeAction}>
            <input type="hidden" name="intake_id" value={row.id} />
            <Button size="sm" type="submit" variant="destructive">
              Delete
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
