'use client'

import type { ComponentProps } from 'react'

import { Button } from '@/components/ui/button'

type PrintButtonProps = Omit<ComponentProps<typeof Button>, 'type' | 'onClick' | 'children'> & {
  label?: string
}

export function PrintButton({ label = 'Print schedule', ...props }: PrintButtonProps) {
  return (
    <Button type="button" onClick={() => window.print()} {...props}>
      {label}
    </Button>
  )
}
