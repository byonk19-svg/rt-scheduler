import { cn } from '@/lib/utils'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type SubmissionComplianceRow = {
  cycleId: string
  label: string
  submittedCount: number
  totalActive: number
  compliancePercent: number
}

type Props = {
  rows: SubmissionComplianceRow[]
}

export function SubmissionComplianceTable({ rows }: Props) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-tw-sm">
      <div className="border-b border-border px-5 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          Submission compliance
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Therapist availability submissions per Schedule Block.
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <TableHead>Schedule Block</TableHead>
            <TableHead className="text-right">Submitted</TableHead>
            <TableHead>Rate</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const pct = row.compliancePercent
            const barClass =
              pct >= 100
                ? 'bg-[var(--success)]'
                : pct >= 60
                  ? 'bg-[var(--warning)]'
                  : 'bg-[var(--error)]'

            return (
              <TableRow key={row.cycleId}>
                <TableCell className="font-medium text-foreground">{row.label}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.submittedCount} / {row.totalActive}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-border">
                      <div
                        className={cn('h-full rounded-full transition-[width]', barClass)}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <span className="tabular-nums text-sm text-muted-foreground">{pct}%</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span
                    className={
                      row.submittedCount >= row.totalActive && row.totalActive > 0
                        ? 'inline-flex rounded-full border border-[var(--success-border)] bg-[var(--success-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--success-text)]'
                        : 'inline-flex rounded-full border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--warning-text)]'
                    }
                  >
                    {row.submittedCount >= row.totalActive && row.totalActive > 0
                      ? 'Complete'
                      : 'Pending'}
                  </span>
                </TableCell>
              </TableRow>
            )
          })}
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                No submission data yet.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </section>
  )
}
