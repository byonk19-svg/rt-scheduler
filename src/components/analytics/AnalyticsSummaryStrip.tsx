import { cn } from '@/lib/utils'

type CycleFillRateRow = { fillPercent: number }
type SubmissionRow = { compliancePercent: number; submittedCount: number; totalActive: number }
type MissRow = { missed: boolean }

type Props = {
  fillRates: CycleFillRateRow[]
  submissionCompliance: SubmissionRow[]
  forcedDateMisses: MissRow[]
}

export function AnalyticsSummaryStrip({
  fillRates,
  submissionCompliance,
  forcedDateMisses,
}: Props) {
  const avgFill =
    fillRates.length > 0
      ? Math.round(fillRates.reduce((sum, r) => sum + r.fillPercent, 0) / fillRates.length)
      : null

  const completeCycles = submissionCompliance.filter(
    (r) => r.submittedCount >= r.totalActive && r.totalActive > 0
  ).length
  const totalCycles = submissionCompliance.length

  const missCount = forcedDateMisses.filter((r) => r.missed).length
  const requestCount = forcedDateMisses.length

  if (avgFill === null && totalCycles === 0 && requestCount === 0) return null

  return (
    <div className="flex flex-wrap divide-x divide-border rounded-xl border border-border bg-card shadow-tw-sm">
      {avgFill !== null ? (
        <Stat
          label="Avg fill rate"
          value={`${avgFill}%`}
          detail={`across ${fillRates.length} Schedule ${fillRates.length === 1 ? 'Block' : 'Blocks'}`}
          valueClass={
            avgFill >= 80
              ? 'text-[var(--success-text)]'
              : avgFill >= 50
                ? 'text-[var(--warning-text)]'
                : 'text-[var(--error-text)]'
          }
        />
      ) : null}
      {totalCycles > 0 ? (
        <Stat
          label="Submission compliance"
          value={`${completeCycles} / ${totalCycles}`}
          detail="Schedule Blocks fully submitted"
          valueClass={
            completeCycles === totalCycles
              ? 'text-[var(--success-text)]'
              : completeCycles === 0
                ? 'text-[var(--error-text)]'
                : undefined
          }
        />
      ) : null}
      {requestCount > 0 ? (
        <Stat
          label="Need to Work misses"
          value={`${missCount} / ${requestCount}`}
          detail="requested dates missed"
          valueClass={
            missCount === 0
              ? 'text-[var(--success-text)]'
              : missCount > requestCount / 2
                ? 'text-[var(--error-text)]'
                : 'text-[var(--warning-text)]'
          }
        />
      ) : null}
    </div>
  )
}

function Stat({
  label,
  value,
  detail,
  valueClass,
}: {
  label: string
  value: string
  detail: string
  valueClass?: string
}) {
  return (
    <div className="px-5 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <p className={cn('mt-1 text-xl font-bold tabular-nums text-foreground', valueClass)}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}
