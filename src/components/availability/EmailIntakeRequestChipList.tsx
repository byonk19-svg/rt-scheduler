'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

import { Button } from '@/components/ui/button'
import type { EmailIntakePanelItemRow } from '@/components/availability/EmailIntakePanel'

function formatRequestLabel(request: EmailIntakePanelItemRow['parsedRequests'][number]): string {
  const parsed = new Date(`${request.date}T00:00:00`)
  const label = Number.isNaN(parsed.getTime())
    ? request.date
    : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const shiftSuffix =
    request.shift_type === 'both' ? '' : request.shift_type === 'day' ? ' (day)' : ' (night)'
  return `${label} ${request.override_type === 'force_off' ? 'off' : 'work'}${shiftSuffix}`
}

function EmailIntakeRequestChipRow({
  item,
  request,
  updateEmailIntakeItemRequestAction,
}: {
  item: EmailIntakePanelItemRow
  request: EmailIntakePanelItemRow['parsedRequests'][number]
  updateEmailIntakeItemRequestAction: (
    formData: FormData
  ) => void | Promise<void> | Promise<{ ok: true }>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function runAction(buildFormData: () => FormData) {
    startTransition(async () => {
      const fd = buildFormData()
      const result = await updateEmailIntakeItemRequestAction(fd)
      if (result && typeof result === 'object' && 'ok' in result && result.ok) {
        router.refresh()
      }
    })
  }

  function handleToggle() {
    runAction(() => {
      const fd = new FormData()
      fd.set('item_id', item.id)
      fd.set('date', request.date)
      fd.set('override_type', request.override_type)
      fd.set('shift_type', request.shift_type)
      return fd
    })
  }

  function handleRemove() {
    const label = formatRequestLabel(request)
    if (
      !window.confirm(
        `Remove ${label} from this item? To rebuild all parsed dates from the original message or attachment, use Reparse on the email.`
      )
    ) {
      return
    }
    runAction(() => {
      const fd = new FormData()
      fd.set('mode', 'remove')
      fd.set('item_id', item.id)
      fd.set('date', request.date)
      fd.set('override_type', request.override_type)
      fd.set('shift_type', request.shift_type)
      return fd
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        aria-busy={pending}
        title="Switch between day off and available to work"
        onClick={handleToggle}
        className={
          request.override_type === 'force_off'
            ? 'h-7 border-destructive/30 bg-destructive/10 px-2 text-xs text-destructive hover:bg-destructive/15 hover:text-destructive'
            : 'h-7 border-info-border bg-info-subtle px-2 text-xs text-info-text hover:bg-info-subtle/80 hover:text-info-text'
        }
      >
        {formatRequestLabel(request)}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        className="h-7 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        aria-label={`Remove ${formatRequestLabel(request)} from parsed list`}
        onClick={handleRemove}
      >
        Remove
      </Button>
    </div>
  )
}

export function EmailIntakeRequestChipList({
  item,
  updateEmailIntakeItemRequestAction,
}: {
  item: EmailIntakePanelItemRow
  updateEmailIntakeItemRequestAction: (
    formData: FormData
  ) => void | Promise<void> | Promise<{ ok: true }>
}) {
  if (item.parsedRequests.length === 0) return null

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {item.parsedRequests.map((request) => (
        <EmailIntakeRequestChipRow
          key={`${item.id}-${request.date}-${request.override_type}-${request.shift_type}`}
          item={item}
          request={request}
          updateEmailIntakeItemRequestAction={updateEmailIntakeItemRequestAction}
        />
      ))}
    </div>
  )
}
