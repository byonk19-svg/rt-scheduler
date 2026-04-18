'use client'

import { cn } from '@/lib/utils'

type SegmentedOption<T extends string> = {
  label: string
  value: T
}

type SegmentedControlProps<T extends string> = {
  ariaLabel: string
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
}

export function SegmentedControl<T extends string>({
  ariaLabel,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex rounded-full border border-border/80 bg-background/90 p-1 shadow-sm"
    >
      {options.map((option) => {
        const isActive = option.value === value

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              'min-h-11 rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
