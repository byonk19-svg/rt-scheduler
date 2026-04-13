'use client'

import { type ReactNode, useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

type ConfirmDestructiveButtonProps = {
  /** Server action accepting FormData */
  action: (formData: FormData) => Promise<void>
  /** Hidden form fields included when the action is called */
  fields: Record<string, string>
  /** Content rendered inside the trigger button */
  triggerLabel: ReactNode
  /** CSS classes applied to the trigger button element */
  triggerClassName?: string
  /** Dialog heading */
  title: string
  /** Dialog body — describe what will happen and whether it can be undone */
  description: string
  /** Label for the confirm button. Default: "Confirm" */
  confirmLabel?: string
  /** Visual treatment of the confirm button. Default: "destructive" */
  confirmVariant?: 'destructive' | 'warning'
}

/**
 * Wraps a server action behind a confirmation dialog.
 *
 * Use for irreversible or consequential form actions so managers can't trigger
 * them by accident. The action is called inside `startTransition` so redirects
 * inside the server action (the normal Next.js pattern) propagate naturally.
 *
 * The dialog locks while the action is pending — the user cannot close it or
 * submit again until navigation occurs.
 */
export function ConfirmDestructiveButton({
  action,
  fields,
  triggerLabel,
  triggerClassName,
  title,
  description,
  confirmLabel = 'Confirm',
  confirmVariant = 'destructive',
}: ConfirmDestructiveButtonProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    const formData = new FormData()
    for (const [key, value] of Object.entries(fields)) {
      formData.append(key, value)
    }
    startTransition(async () => {
      await action(formData)
    })
  }

  return (
    <>
      <button
        type="button"
        className={cn(triggerClassName, isPending && 'opacity-50 pointer-events-none')}
        onClick={() => setOpen(true)}
        disabled={isPending}
        aria-haspopup="dialog"
      >
        {triggerLabel}
      </button>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!isPending) setOpen(nextOpen)
        }}
      >
        <DialogContent showCloseButton={!isPending} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              variant={confirmVariant === 'destructive' ? 'destructive' : 'outline'}
              size="sm"
              className={cn(
                confirmVariant === 'warning' &&
                  'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)] hover:opacity-80'
              )}
              onClick={handleConfirm}
              disabled={isPending}
              aria-busy={isPending}
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
