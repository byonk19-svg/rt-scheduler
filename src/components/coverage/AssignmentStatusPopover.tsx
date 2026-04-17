'use client'

import type { ReactNode } from 'react'
import { Check, CircleCheck, Clock, PhoneCall, PhoneIncoming, PhoneOff } from 'lucide-react'

import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  COVERAGE_STATUS_OPTIONS,
  getCoverageStatusLabel,
  type CoverageUiStatus,
} from '@/lib/coverage/status-ui'
import { useMediaQuery } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'

/** Tailwind `md` (768px): prefer bottom sheet–style popover so content stays in viewport. */
const BELOW_MD_MEDIA = '(max-width: 767px)'

const STATUS_ICONS: Record<CoverageUiStatus, typeof CircleCheck> = {
  active: CircleCheck,
  leave_early: Clock,
  cancelled: PhoneOff,
  call_in: PhoneIncoming,
  oncall: PhoneCall,
}

const STATUS_CLASSES: Record<
  CoverageUiStatus,
  { selected: string; text: string; pill: string }
> = {
  active: {
    selected: 'border-[var(--success-border)] bg-[var(--success-subtle)] text-[var(--success-text)]',
    text: 'text-[var(--success-text)]',
    pill: 'bg-[var(--success-subtle)] text-[var(--success-text)]',
  },
  leave_early: {
    selected: 'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]',
    text: 'text-[var(--warning-text)]',
    pill: 'bg-[var(--warning-subtle)] text-[var(--warning-text)]',
  },
  cancelled: {
    selected: 'border-[var(--error-border)] bg-[var(--error-subtle)] text-[var(--error-text)]',
    text: 'text-[var(--error-text)]',
    pill: 'bg-[var(--error-subtle)] text-[var(--error-text)]',
  },
  call_in: {
    selected: 'border-[var(--error-border)] bg-[var(--error-subtle)] text-[var(--error-text)]',
    text: 'text-[var(--error-text)]',
    pill: 'bg-[var(--error-subtle)] text-[var(--error-text)]',
  },
  oncall: {
    selected: 'border-[var(--info-border)] bg-[var(--info-subtle)] text-[var(--info-text)]',
    text: 'text-[var(--info-text)]',
    pill: 'bg-[var(--info-subtle)] text-[var(--info-text)]',
  },
}

export function statusPillClassName(status: CoverageUiStatus): string {
  return STATUS_CLASSES[status].pill
}

type AssignmentStatusPopoverProps = {
  therapistName: string
  currentStatus: CoverageUiStatus
  isLead?: boolean
  disabled?: boolean
  triggerTestId: string
  onChangeStatus: (nextStatus: CoverageUiStatus) => void
  children: ReactNode
}

export function AssignmentStatusPopover({
  therapistName,
  currentStatus,
  isLead = false,
  disabled = false,
  triggerTestId,
  onChangeStatus,
  children,
}: AssignmentStatusPopoverProps) {
  const isNarrowViewport = useMediaQuery(BELOW_MD_MEDIA)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          data-testid={triggerTestId}
          className="pointer-events-auto relative z-20 inline-flex min-h-10 max-w-full touch-manipulation items-center gap-1 rounded-md px-0.5 py-1 text-left transition-colors hover:text-foreground sm:min-h-0 sm:px-0 sm:py-0"
          onClick={(event) => event.stopPropagation()}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={isNarrowViewport ? 'bottom' : 'right'}
        align={isNarrowViewport ? 'center' : 'start'}
        sideOffset={isNarrowViewport ? 8 : 4}
        collisionPadding={12}
        className="w-64 max-w-[min(16rem,calc(100vw-1.5rem))] rounded-[24px] border-border/70 p-2.5 shadow-tw-popover"
        data-testid="coverage-status-popover"
        onClick={(event) => event.stopPropagation()}
      >
        <PopoverHeader className="border-b border-border/70 px-2 pb-2.5">
          <div className="flex items-center gap-2">
            <PopoverTitle className="text-sm font-semibold text-foreground">
              {therapistName}
            </PopoverTitle>
            {isLead && (
              <span className="rounded-md border border-[var(--info-border)] bg-[var(--info-subtle)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--info-text)]">
                Lead
              </span>
            )}
          </div>
        </PopoverHeader>

        <div className="mt-1.5 space-y-1">
          {COVERAGE_STATUS_OPTIONS.map((option) => {
            const Icon = STATUS_ICONS[option.value]
            const selected = option.value === currentStatus
            return (
              <button
                key={option.value}
                type="button"
                disabled={selected}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-[18px] border px-3 py-2.5 text-left text-sm font-medium transition-colors',
                  selected
                    ? STATUS_CLASSES[option.value].selected
                    : 'border-transparent text-foreground/80 hover:bg-muted/60'
                )}
                onClick={(event) => {
                  event.stopPropagation()
                  onChangeStatus(option.value)
                }}
              >
                <Icon className={cn('h-4 w-4 shrink-0', STATUS_CLASSES[option.value].text)} />
                <span className="flex-1">{option.label}</span>
                {selected && <Check className="h-4 w-4 shrink-0" />}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function StatusPill({ status }: { status: CoverageUiStatus }) {
  if (status === 'active') return null

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]',
        statusPillClassName(status)
      )}
    >
      {getCoverageStatusLabel(status)}
    </span>
  )
}
