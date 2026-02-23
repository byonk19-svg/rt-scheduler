'use client'

import type * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type FormSubmitButtonProps = React.ComponentProps<typeof Button> & {
  pendingText?: string
}

type FormMenuSubmitButtonProps = React.ComponentProps<'button'> & {
  pendingText?: string
}

export function FormSubmitButton({
  children,
  pendingText,
  disabled,
  ...props
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus()
  const isDisabled = Boolean(disabled) || pending

  return (
    <Button {...props} disabled={isDisabled}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {pending ? (pendingText ?? children) : children}
    </Button>
  )
}

export function FormMenuSubmitButton({
  children,
  pendingText,
  className,
  disabled,
  ...props
}: FormMenuSubmitButtonProps) {
  const { pending } = useFormStatus()
  const isDisabled = Boolean(disabled) || pending

  return (
    <button
      {...props}
      disabled={isDisabled}
      className={cn('inline-flex items-center gap-2', className)}
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      <span>{pending ? (pendingText ?? children) : children}</span>
    </button>
  )
}
