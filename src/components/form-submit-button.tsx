'use client'

import type * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'

type FormSubmitButtonProps = React.ComponentProps<typeof Button> & {
  pendingText?: string
}

export function FormSubmitButton({
  children,
  pendingText,
  disabled,
  type = 'submit',
  ...props
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus()
  const isDisabled = Boolean(disabled) || pending

  return (
    <Button {...props} type={type} disabled={isDisabled}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {pending ? (pendingText ?? children) : children}
    </Button>
  )
}
