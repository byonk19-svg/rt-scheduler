import { StatusBadge } from '@/components/ui/status-badge'

export type AvailabilityStatusSummaryRow = {
  therapistId: string
  therapistName: string
  overridesCount?: number
}

type AvailabilityStatusSummaryProps = {
  submittedRows: AvailabilityStatusSummaryRow[]
  missingRows: AvailabilityStatusSummaryRow[]
}

function pluralizeTherapists(count: number): string {
  return `${count} therapist${count === 1 ? '' : 's'}`
}

export function AvailabilityStatusSummary({
  submittedRows,
  missingRows,
}: AvailabilityStatusSummaryProps) {
  return (
    <section className="space-y-3" aria-labelledby="availability-response-heading">
      <div className="space-y-1">
        <h2
          id="availability-response-heading"
          className="text-lg font-medium leading-none text-foreground"
        >
          Check responses
        </h2>
        <p className="text-sm text-muted-foreground">
          Focus on missing responses first, then expand the submitted roster only if you need it.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <section className="rounded-2xl border border-[var(--warning-border)] bg-[var(--warning-subtle)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[var(--warning-text)]">Not submitted yet</p>
              <p className="text-sm text-[var(--warning-text)]/85">
                {missingRows.length > 0
                  ? `${pluralizeTherapists(missingRows.length)} still need to respond`
                  : 'Everyone has submitted availability for this cycle.'}
              </p>
            </div>
            <StatusBadge variant="warning">{missingRows.length}</StatusBadge>
          </div>

          {missingRows.length > 0 ? (
            <div className="space-y-2">
              {missingRows.map((row) => (
                <div
                  key={row.therapistId}
                  className="rounded-md border border-white/70 bg-white/80 px-3 py-2 text-sm font-medium text-foreground"
                >
                  {row.therapistName}
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-border/70 bg-muted/10 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Submitted</p>
              <p className="text-sm text-muted-foreground">
                {submittedRows.length > 0
                  ? `${pluralizeTherapists(submittedRows.length)} have already submitted`
                  : 'No one has submitted availability for this cycle yet.'}
              </p>
            </div>
            <StatusBadge variant="success">{submittedRows.length}</StatusBadge>
          </div>

          {submittedRows.length > 0 ? (
            <details className="group rounded-lg border border-border/70 bg-card/80 px-3 py-2">
              <summary className="cursor-pointer list-none text-sm font-medium text-foreground marker:content-none">
                Show all {submittedRows.length} submitted therapists
              </summary>
              <div className="mt-3 space-y-2 border-t border-border/70 pt-3">
                {submittedRows.map((row) => (
                  <div
                    key={row.therapistId}
                    className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background px-3 py-2"
                  >
                    <span className="text-sm font-medium text-foreground">{row.therapistName}</span>
                    <span className="text-xs text-muted-foreground">
                      {(row.overridesCount ?? 0) > 0
                        ? `${row.overridesCount} date${row.overridesCount === 1 ? '' : 's'}`
                        : 'No dates yet'}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </section>
      </div>
    </section>
  )
}
