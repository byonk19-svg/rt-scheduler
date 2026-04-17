import { cn } from '@/lib/utils'

type StatTone = 'default' | 'critical' | 'success' | 'warning'

type StatCardValue = {
  label: string
  value: string
  detail: string
  tone?: StatTone
}

const TONE_STYLES: Record<StatTone, string> = {
  default: 'border-border/80 bg-card/90',
  critical: 'border-[var(--error-border)] bg-[var(--error-subtle)]/55',
  success: 'border-[var(--success-border)] bg-[var(--success-subtle)]/55',
  warning: 'border-[var(--warning-border)] bg-[var(--warning-subtle)]/60',
}

export function StatCards({ cards }: { cards: readonly StatCardValue[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <section
          key={card.label}
          className={cn(
            'rounded-2xl border px-4 py-4 shadow-sm',
            TONE_STYLES[card.tone ?? 'default']
          )}
          aria-label={card.label}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {card.label}
          </p>
          <div className="mt-3 flex items-end justify-between gap-4">
            <p className="text-3xl font-semibold tracking-[-0.05em] text-foreground">
              {card.value}
            </p>
            <p className="pb-1 text-xs font-medium text-muted-foreground">{card.detail}</p>
          </div>
        </section>
      ))}
    </div>
  )
}
