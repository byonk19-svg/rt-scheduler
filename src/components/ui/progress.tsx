'use client'

import * as React from 'react'
import { Progress as ProgressPrimitive } from 'radix-ui'

import { cn } from '@/lib/utils'

function Progress({
  className,
  indicatorClassName,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  indicatorClassName?: string
}) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      className={cn(
        'relative h-4 w-full overflow-hidden rounded-full bg-muted/90 ring-1 ring-border/50',
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          'h-full w-full flex-1 rounded-full bg-primary transition-all duration-500',
          indicatorClassName
        )}
        style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
