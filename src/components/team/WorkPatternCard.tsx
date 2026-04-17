import { cn } from '@/lib/utils'

type Props = {
  worksDow: number[]
  offsDow: number[]
  weekendRotation: string | null
  worksDowMode: string
}

const DOW_OPTIONS = [
  { label: 'Su', value: 0 },
  { label: 'Mo', value: 1 },
  { label: 'Tu', value: 2 },
  { label: 'We', value: 3 },
  { label: 'Th', value: 4 },
  { label: 'Fr', value: 5 },
  { label: 'Sa', value: 6 },
]

function getWeekendRotationLabel(value: string | null): string | null {
  if (value === 'every_other') return 'Every other weekend'
  if (value === 'none') return 'Every weekend'
  return null
}

export function WorkPatternCard({ worksDow, offsDow, weekendRotation, worksDowMode }: Props) {
  const weekendLabel = getWeekendRotationLabel(weekendRotation)
  const modeLabel = worksDowMode === 'soft' ? 'Soft' : 'Hard'

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {DOW_OPTIONS.map((day) => (
          <span
            key={day.value}
            className={cn(
              'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs font-semibold',
              worksDow.includes(day.value) &&
                'bg-[var(--success-subtle)] text-[var(--success-text)]',
              !worksDow.includes(day.value) &&
                offsDow.includes(day.value) &&
                'bg-[var(--error-subtle)] text-[var(--error-text)]',
              !worksDow.includes(day.value) &&
                !offsDow.includes(day.value) &&
                'bg-[var(--muted)] text-[var(--muted-foreground)]'
            )}
          >
            {day.label}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <span
          title="Hard = must work these days. Soft = preferred but flexible."
          className="inline-flex items-center rounded-full border border-border/70 bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground"
        >
          {modeLabel}
        </span>
        {weekendLabel ? (
          <span className="inline-flex items-center rounded-full border border-border/70 bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            {weekendLabel}
          </span>
        ) : null}
      </div>
    </div>
  )
}
