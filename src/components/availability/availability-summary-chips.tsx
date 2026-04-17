import { cn } from '@/lib/utils'

type AvailabilitySummaryChip = {
  label: string
  count: number
  href: string
  tone?: 'neutral' | 'warning' | 'success' | 'info'
  active?: boolean
}

type AvailabilitySummaryChipsProps = {
  chips: AvailabilitySummaryChip[]
}

const toneClasses: Record<NonNullable<AvailabilitySummaryChip['tone']>, string> = {
  neutral: 'border-border/80 bg-card text-foreground hover:border-primary/35 hover:bg-primary/5',
  warning:
    'border-[var(--warning-border)]/70 bg-[var(--warning-subtle)]/70 text-[var(--warning-text)] hover:border-[var(--warning-border)]',
  success:
    'border-[var(--success-border)]/80 bg-[var(--success-subtle)]/65 text-[var(--success-text)] hover:border-[var(--success-border)]',
  info: 'border-[var(--info-border)]/80 bg-[var(--info-subtle)]/70 text-[var(--info-text)] hover:border-[var(--info-border)]',
}

export function AvailabilitySummaryChips({ chips }: AvailabilitySummaryChipsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => {
        const tone = chip.tone ?? 'neutral'
        return (
          <a
            key={`${chip.label}-${chip.href}`}
            href={chip.href}
            className={cn(
              'group inline-flex min-w-[8.5rem] items-center justify-between gap-3 rounded-full border px-3.5 py-2 text-sm transition-colors',
              toneClasses[tone],
              chip.active && 'ring-2 ring-primary/15'
            )}
          >
            <span className="font-medium">{chip.label}</span>
            <span
              className={cn(
                'inline-flex min-w-7 items-center justify-center rounded-full border border-current/15 px-2 py-0.5 text-xs font-semibold',
                tone === 'neutral'
                  ? 'bg-foreground/[0.04] text-foreground'
                  : 'bg-background/70 text-current'
              )}
            >
              {chip.count}
            </span>
          </a>
        )
      })}
    </div>
  )
}
