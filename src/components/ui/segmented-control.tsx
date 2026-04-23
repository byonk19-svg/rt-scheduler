'use client'

import { useCallback, type KeyboardEvent } from 'react'

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
  className?: string
  optionClassName?: string
  getOptionTestId?: (value: T) => string | undefined
}

export function SegmentedControl<T extends string>({
  ariaLabel,
  options,
  value,
  onChange,
  className,
  optionClassName,
  getOptionTestId,
}: SegmentedControlProps<T>) {
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  )

  const moveSelection = useCallback(
    (nextIndex: number) => {
      const next = options[nextIndex]
      if (next) onChange(next.value)
    },
    [onChange, options]
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (options.length === 0) return

      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          event.preventDefault()
          moveSelection((index + 1) % options.length)
          break
        case 'ArrowLeft':
        case 'ArrowUp':
          event.preventDefault()
          moveSelection((index - 1 + options.length) % options.length)
          break
        case 'Home':
          event.preventDefault()
          moveSelection(0)
          break
        case 'End':
          event.preventDefault()
          moveSelection(options.length - 1)
          break
        default:
          break
      }
    },
    [moveSelection, options.length]
  )

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex rounded-full border border-border/80 bg-background/90 p-1 shadow-sm',
        className
      )}
    >
      {options.map((option, index) => {
        const isActive = option.value === value

        return (
          <button
            key={option.value}
            type="button"
            data-testid={getOptionTestId?.(option.value)}
            role="radio"
            aria-checked={isActive}
            tabIndex={isActive || index === activeIndex ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              'min-h-11 rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
              optionClassName
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
